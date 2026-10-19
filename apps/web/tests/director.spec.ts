import { test, expect, type Page } from "@playwright/test";
import { createDirectorShot } from "@actbyme/shared";
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
async function login(page: Page, id: string) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "director-test@studio.test",
    app_metadata: { role: "CLIENT" },
    user_metadata: {},
  };
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
  await page.route("https://studio-test.supabase.co/**", (route) => route.fulfill({ json: user }));
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
  test.setTimeout(180000);
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
  const planDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter le dossier de production", exact: true })
    .click();
  expect((await planDownload).suggestedFilename()).toContain("production.json");
  await page.getByLabel("Confirmer les droits pour l’export").check();
  await page.getByRole("button", { name: "Assembler le MP4", exact: true }).click();
  await expect(page.getByText("Publicité MP4 disponible", { exact: true })).toBeVisible({
    timeout: 40000,
  });
  const result = (await (await request.get(api, { headers })).json()).jobs.find(
    (job: { kind: string }) => job.kind === "EXPORT",
  );
  const media = await (
    await request.get(`${api}/assets/${result.resultAssetId}/media?download=1`, { headers })
  ).json();
  const mp4 = await request.get(media.url);
  expect(mp4.headers()["content-type"]).toContain("video/mp4");
  expect((await mp4.body()).length).toBeGreaterThan(1000);
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
