import { test, expect, type Page } from "@playwright/test";
import { createDirectorShot } from "@actbyme/shared";
import { safeAuthReturnTo } from "../lib/auth/return-to";
test.use({ actionTimeout: 15000 });
async function expectRenderedScene(page: Page) {
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        if (!canvas.dataset.engine) return 0;
        const context = canvas.getContext("webgl2");
        if (!context || !canvas.width || !canvas.height) return 0;
        const pixel = new Uint8Array(4),
          colors = new Set<string>();
        for (let row = 1; row < 6; row++)
          for (let column = 1; column < 8; column++) {
            context.readPixels(
              Math.floor((canvas.width * column) / 8),
              Math.floor((canvas.height * row) / 6),
              1,
              1,
              context.RGBA,
              context.UNSIGNED_BYTE,
              pixel,
            );
            colors.add(Array.from(pixel).join(","));
          }
        return colors.size;
      }),
    )
    .toBeGreaterThan(8);
}
async function login(page: Page, id: string, initialSession = true) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "director-test@studio.test",
    app_metadata: { role: "CLIENT" },
    user_metadata: {},
  };
  if (initialSession)
    await page.addInitScript(
      ({ user }) =>
        localStorage.setItem(
          "sb-studio-test-auth-token",
          JSON.stringify({
            access_token: "studio-token",
            refresh_token: "studio-refresh",
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user,
          }),
        ),
      { user },
    );
  await page.route("https://studio-test.supabase.co/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/token")
        ? {
            access_token: "studio-token",
            refresh_token: "studio-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user,
          }
        : user,
    }),
  );
  await page.route("http://127.0.0.1:4401/**", async (route) => {
    if (route.request().url().includes("/users/me"))
      return route.fulfill({ json: { ...user, role: "CLIENT" } });
    if (route.request().url().includes("/notifications")) return route.fulfill({ json: [] });
    await route.continue({
      headers: { ...route.request().headers(), "x-user-id": id, "x-user-role": "CLIENT" },
    });
  });
}
test("Director: create, direct, import, synchronize, persist, replace a shot and export real MP4", async ({
  page,
  request,
}) => {
  test.setTimeout(240000);
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/director");
  await page.getByLabel("Nom du nouveau projet Director").fill("Director browser advertising test");
  await page.getByRole("button", { name: "Créer un projet", exact: true }).click();
  await expect(page).toHaveURL(/\/director\/[a-f0-9-]+$/);
  const id = page.url().split("/").at(-1)!,
    headers = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" },
    api = `http://127.0.0.1:4401/director-projects/${id}`;
  const capabilities = (await (await request.get(api, { headers })).json()).capabilities;
  expect(capabilities.workerReady).toBe(false);
  expect(capabilities.browserExportReady).toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
  await expectRenderedScene(page);
  await page.getByLabel("Hauteur caméra").fill("2.4");
  await expect
    .poll(
      async () =>
        (await (await request.get(api, { headers })).json()).document.shots[0].waypoints[0].position
          .y,
    )
    .toBe(2.4);
  await page.getByRole("button", { name: "Waypoint", exact: true }).click();
  await expect(
    page
      .getByRole("complementary", { name: "Réglages du plan" })
      .getByText("5 waypoints", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dolly In", exact: false }).click();
  await expect(page.getByRole("button", { name: "Plan 2 : Dolly In", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ressources", exact: true }).click();
  const upload = async (kind: string, name: string, mimeType: string, category: string) => {
    const bytes = await (
      await request.get(`http://127.0.0.1:4401/test-director-source?kind=${kind}`)
    ).body();
    await page
      .getByLabel("Importer une ressource", { exact: true })
      .setInputFiles({ name, mimeType, buffer: bytes });
    await page.getByLabel("Catégorie", { exact: true }).selectOption(category);
    await page
      .getByLabel("Base des droits de la ressource")
      .fill("Synthetic media generated for isolated browser tests only.");
    await page
      .getByText(
        "Je possède ou détiens les droits de cette ressource et des personnes représentées.",
      )
      .click();
    await page.getByRole("button", { name: "Importer et vérifier", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(api, { headers })).json()).assets.find(
            (asset: { name: string }) => asset.name === name,
          )?.status,
      )
      .toBe("READY");
    await expect(
      page.getByRole("button", { name: `Associer ${name} au plan`, exact: true }),
    ).toBeVisible();
  };
  await upload("image", "test-property.png", "image/png", "property");
  await page.getByRole("button", { name: "Plan 1 : Outside to Inside", exact: true }).click();
  await page
    .getByRole("button", { name: "Associer test-property.png au plan", exact: true })
    .click();
  await upload("video", "test-final.mp4", "video/mp4", "clip");
  await page.getByRole("button", { name: "Associer test-final.mp4 au plan", exact: true }).click();
  await page.getByRole("button", { name: "Plan 2 : Dolly In", exact: true }).click();
  await page.getByRole("button", { name: "Associer test-final.mp4 au plan", exact: true }).click();
  await upload("music", "test-music.wav", "audio/wav", "music");
  await page
    .getByRole("button", { name: "Ajouter test-music.wav à la timeline", exact: true })
    .click();
  await page.getByRole("button", { name: "Lire la prévisualisation", exact: true }).click();
  await expect
    .poll(async () =>
      Number((await page.getByTestId("director-current-time").innerText()).split(" ")[0]),
    )
    .toBeGreaterThan(0.1);
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluateAll((elements) =>
          elements.some(
            (element) =>
              !(element as HTMLAudioElement).paused &&
              (element as HTMLAudioElement).currentTime > 0,
          ),
        ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Mettre la prévisualisation en pause", exact: true })
    .click();
  await expect
    .poll(async () => (await (await request.get(api, { headers })).json()).document.tracks.length)
    .toBe(1);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("2.4");
  await page.screenshot({ path: "test-results/director-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("region", { name: "Export MP4 gratuit" })).toBeVisible();
  await expect(page.getByLabel("Moteur de génération vidéo")).not.toBeVisible();
  const planDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter le dossier de production", exact: true })
    .click();
  expect((await planDownload).suggestedFilename()).toContain("production.json");
  await page.getByLabel("Confirmer les droits pour l’export").check();
  await page.getByRole("button", { name: "Assembler le MP4", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Annuler l’export navigateur", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Annuler l’export navigateur", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(api, { headers })).json()).jobs.filter(
          (job: { kind: string; status: string }) =>
            job.kind === "EXPORT" && job.status === "CANCELLED",
        ).length,
    )
    .toBe(1);
  await expect(page.getByRole("button", { name: "Assembler le MP4", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Assembler le MP4", exact: true }).click();
  await expect(page.getByText("Publicité MP4 disponible", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  const result = (await (await request.get(api, { headers })).json()).jobs.find(
    (job: { kind: string; status: string }) => job.kind === "EXPORT" && job.status === "SUCCEEDED",
  );
  const media = await (
    await request.get(`${api}/assets/${result.resultAssetId}/media?download=1`, { headers })
  ).json();
  const mp4 = await request.get(media.url);
  expect(mp4.headers()["content-type"]).toContain("video/mp4");
  expect((await mp4.body()).length).toBeGreaterThan(1000);
  // Decode the actual browser-generated file in Chromium, beyond checking its MIME/size.
  const decoded = await page.evaluate(async (url) => {
    const video = window.document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Browser MP4 is not decodable"));
    });
    const metadata = {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
    };
    video.removeAttribute("src");
    video.load();
    return metadata;
  }, media.url);
  expect(decoded.width).toBe(1280);
  expect(decoded.height).toBe(720);
  const mounted = await (await request.get(api, { headers })).json();
  expect(
    Math.abs(
      decoded.duration -
        mounted.document.shots.reduce(
          (sum: number, shot: { duration: number }) => sum + shot.duration,
          0,
        ),
    ),
  ).toBeLessThan(0.2);
  expect(
    mounted.assets.find((asset: { id: string }) => asset.id === result.resultAssetId).hasAudio,
  ).toBe(true);
  expect(mounted.capabilities.workerReady).toBe(false);
  const before = await (await request.get(api, { headers })).json();
  await page.getByRole("button", { name: "Direct", exact: true }).click();
  await upload("video", "test-replacement.mp4", "video/mp4", "clip");
  await page.getByRole("button", { name: "Plan 2 : Dolly In", exact: true }).click();
  await page
    .getByRole("button", { name: "Associer test-replacement.mp4 au plan", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await request.get(api, { headers })).json()).document.shots[1].clipAssetId,
    )
    .not.toBe(before.document.shots[1].clipAssetId);
  const after = await (await request.get(api, { headers })).json();
  expect(after.document.shots[0].clipAssetId).toBe(before.document.shots[0].clipAssetId);
  expect(after.jobs.some((job: { id: string }) => job.id === result.id)).toBe(true);
  expect(
    (
      await request.get(api, {
        headers: { "x-user-id": fixture.otherUserId, "x-user-role": "CLIENT" },
      })
    ).status(),
  ).toBe(404);
});
test("Director demo: editing, undo, split, responsive layout and WebGL fallback require no paid API", async ({
  page,
}) => {
  let billableCalls = 0;
  await page.route("**/director-projects/**/jobs", (route) => {
    billableCalls++;
    return route.abort();
  });
  await page.setViewportSize({ width: 1360, height: 950 });
  await page.goto("/director/demo");
  await expect(page.locator("canvas")).toBeVisible();
  await expectRenderedScene(page);
  await page.screenshot({ path: "test-results/director-demo-desktop.png", fullPage: true });
  await page.getByLabel("Hauteur caméra").fill("2.5");
  await page.getByRole("button", { name: "Annuler la modification", exact: true }).click();
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("1.8");
  const firstWaypoint = page
    .getByRole("group", { name: "Vue du dessus et trajectoire de caméra" })
    .getByRole("button", { name: "Waypoint 1", exact: true });
  const waypointBounds = await firstWaypoint.boundingBox();
  await page.mouse.move(
    waypointBounds!.x + waypointBounds!.width / 2,
    waypointBounds!.y + waypointBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    waypointBounds!.x + waypointBounds!.width / 2 + 25,
    waypointBounds!.y + waypointBounds!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Caméra X", { exact: true })).not.toHaveValue("-7");
  await page.getByRole("button", { name: "Annuler la modification", exact: true }).click();
  await expect(page.getByLabel("Caméra X", { exact: true })).toHaveValue("-7");
  await page.getByRole("button", { name: "Copier la sélection", exact: true }).click();
  await page.getByRole("button", { name: "Coller la sélection", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Plan 4 : Invitation", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Annuler la modification", exact: true }).click();
  await page.getByLabel("Position de lecture").fill("7");
  await page.getByRole("button", { name: "Découper au curseur", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Plan 2 : Outside to Inside · suite", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    .toBe(true);
  await page.screenshot({ path: "test-results/director-mobile.png", fullPage: true });
  expect(billableCalls).toBe(0);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.reload();
  await expect(
    page.getByText("La 3D est indisponible sur ce navigateur.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Vue du dessus et trajectoire de caméra" }),
  ).toBeVisible();
});
test("Director requires billing confirmation and preserves a conflicting draft across reload", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/test-director-worker", { data: { enabled: true } });
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json(),
    headers = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" };
  const created = await (
    await request.post("http://127.0.0.1:4401/director-projects", {
      headers,
      data: { title: "Test-only provider confirmation", demo: false },
    })
  ).json();
  const api = `http://127.0.0.1:4401/director-projects/${created.id}`;
  const document = {
    ...created.document,
    shots: [createDirectorShot("dolly-in", "confirmation_shot", 8)],
  };
  await request.patch(api, { headers, data: { version: created.version, document } });
  await login(page, fixture.ownerId);
  await page.goto(`/director/${created.id}`);
  await expect(page.locator("canvas")).toBeVisible();
  const picture = await page.locator(".director-viewport").boundingBox();
  expect(Math.abs(picture!.width / picture!.height - 16 / 9)).toBeLessThan(0.02);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByText("Génération IA · facultative", { exact: true }).click();
  await page.getByRole("button", { name: /Générer ce plan/ }).click();
  const dialog = page.getByRole("dialog", { name: "Confirmer la génération payante" });
  await expect(dialog).toBeVisible();
  expect((await (await request.get(api, { headers })).json()).jobs).toHaveLength(0);
  await expect(
    dialog.getByRole("button", { name: "Confirmer et lancer", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Je confirme les droits/ }).check();
  await expect(
    dialog.getByRole("button", { name: "Confirmer et lancer", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /J’autorise explicitement cette génération/ }).check();
  await dialog.getByRole("button", { name: "Confirmer et lancer", exact: true }).click();
  await expect(
    page.getByText("Plan disponible ; vérifiez-le avant de l’utiliser", { exact: true }),
  ).toBeVisible({ timeout: 35000 });
  const generated = await (await request.get(api, { headers })).json();
  expect(generated.jobs.filter((job: { kind: string }) => job.kind === "GENERATE")).toHaveLength(1);
  await page.getByRole("button", { name: "Utiliser", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(api, { headers })).json()).document.shots[0].clipAssetId,
    )
    .toBe(generated.jobs[0].resultAssetId);
  await page.getByRole("button", { name: "Direct", exact: true }).click();
  const beforeConflict = await (await request.get(api, { headers })).json();
  await request.patch(api, {
    headers,
    data: {
      version: beforeConflict.version,
      document: { ...beforeConflict.document, script: "Concurrent server edit" },
    },
  });
  await page.getByLabel("Hauteur caméra").fill("3.2");
  await expect(page.getByText("Conflit détecté.", { exact: false })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("3.2");
  await expect(page.getByText("Conflit détecté.", { exact: false })).toBeVisible();
  expect(
    (await (await request.get(api, { headers })).json()).document.shots[0].waypoints[0].position.y,
  ).toBe(1.6);
  const recovered = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le brouillon", exact: true }).click();
  expect((await recovered).suggestedFilename()).toContain("brouillon");
  await page.getByRole("button", { name: "Recharger la version serveur", exact: true }).click();
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("1.6");
});

test("Director login dialog keeps keyboard focus, closes with Escape and returns to Director", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId, false);
  await page.goto("/director");
  const trigger = page.getByRole("button", { name: "Créer mon premier projet", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Log in", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Continue with Google", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Fermer la connexion", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("Email", { exact: true }).fill("director-test@studio.test");
  await dialog.getByLabel("Password", { exact: true }).fill("test-only-password");
  await dialog.locator("form").getByRole("button", { name: "Login", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByLabel("Nom du nouveau projet Director")).toBeEnabled();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("Authentication destinations reject external URLs and OAuth consumes only a fresh internal return", async ({
  page,
  request,
}) => {
  for (const unsafe of [
    undefined,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/example.com",
    "javascript:alert(1)",
  ])
    expect(safeAuthReturnTo(unsafe)).toBe("/profile");
  expect(safeAuthReturnTo("/director/project?view=plan")).toBe("/director/project?view=plan");
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.goto("/director");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "actbyme-auth-return-to",
      JSON.stringify({ path: "/director/demo", expiresAt: Date.now() + 60000 }),
    ),
  );
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/director\/demo$/);
  expect(await page.evaluate(() => sessionStorage.getItem("actbyme-auth-return-to"))).toBeNull();
  for (const [path, expiresAt] of [
    ["/director/demo", 1],
    ["//example.com", Date.now() + 60000],
  ] as const) {
    await page.evaluate(
      ({ path, expiresAt }) =>
        sessionStorage.setItem("actbyme-auth-return-to", JSON.stringify({ path, expiresAt })),
      { path, expiresAt },
    );
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
  }
});

test("Director explains a slow connection, retries reads and never repeats a failed creation", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  let reads = 0,
    creations = 0;
  await page.route("http://127.0.0.1:4401/director-projects", async (route) => {
    if (route.request().method() === "GET") {
      reads++;
      if (reads === 1) {
        await new Promise((resolve) => setTimeout(resolve, 9000));
        return route.fulfill({ status: 503, json: { message: "Temporary cold service" } });
      }
      return route.fallback();
    }
    if (route.request().method() === "POST") {
      creations++;
      return route.abort("failed");
    }
    return route.fallback();
  });
  await page.goto("/director");
  await expect(
    page.getByText("Le premier chargement peut prendre une", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Chargement de vos projets…", { exact: true })).not.toBeVisible();
  expect(reads).toBe(2);
  await page.getByLabel("Nom du nouveau projet Director").fill("Failed mutation must not repeat");
  await page.getByRole("button", { name: "Créer un projet", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer un projet", exact: true })).toBeEnabled();
  await page.waitForTimeout(1200);
  expect(creations).toBe(1);
});

test("Director stops after two failed reads and allows an explicit project reload", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  const created = await (
    await request.post("http://127.0.0.1:4401/director-projects", {
      headers: { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" },
      data: { title: "Connection recovery", demo: false },
    })
  ).json();
  await login(page, fixture.ownerId);
  let reads = 0;
  await page.route(`http://127.0.0.1:4401/director-projects/${created.id}`, (route) => {
    reads++;
    if (reads <= 2)
      return route.fulfill({ status: 503, json: { message: "Temporary gateway failure" } });
    return route.fallback();
  });
  await page.goto(`/director/${created.id}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Le studio ne répond pas");
  await page.waitForTimeout(4500);
  expect(reads).toBe(2);
  await page.getByRole("button", { name: "Réessayer le chargement", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(reads).toBe(3);
});

test("Director panels and imported-file controls stay within the viewport at every supported width", async ({
  page,
}) => {
  await page.goto("/director/demo");
  for (const width of [1440, 1024, 820, 768, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const step of ["Generate", "Direct", "Perform", "Plan"]) {
      await page.getByRole("button", { name: step, exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
          message: `${step} at ${width}px must not overflow`,
        })
        .toBeLessThanOrEqual(1);
      if (step === "Generate") {
        const options = page.getByText("Génération IA · facultative", { exact: true });
        await options.click();
        await expect(page.getByLabel("Moteur de génération vidéo")).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
          .toBeLessThanOrEqual(1);
        await options.click();
      }
    }
  }
  await page.screenshot({ path: "test-results/director-responsive-fixed.png", fullPage: true });
});

test("Director demo asks for login before saving and keeps the edited camera after login", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId, false);
  await page.goto("/director/demo");
  await page.getByLabel("Hauteur caméra").fill("2.5");
  await page.getByRole("button", { name: "Enregistrer dans mon compte", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Log in", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email", { exact: true }).fill("director-test@studio.test");
  await dialog.getByLabel("Password", { exact: true }).fill("test-only-password");
  await dialog.locator("form").getByRole("button", { name: "Login", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/director\/demo$/);
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("2.5");
  await page.getByRole("button", { name: "Enregistrer dans mon compte", exact: true }).click();
  await expect(page).toHaveURL(/\/director\/[a-f0-9-]+$/);
  await expect(page.getByLabel("Hauteur caméra")).toHaveValue("2.5");
});
