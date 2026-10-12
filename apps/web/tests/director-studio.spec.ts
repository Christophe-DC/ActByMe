import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, id: string, actor = false) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "test@studio.test",
    app_metadata: { role: actor ? "ACTOR" : "CLIENT" },
    user_metadata: {},
  };
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem(
        "sb-studio-test-auth-token",
        JSON.stringify({
          access_token: "studio-token",
          refresh_token: "studio-refresh",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      );
    },
    { user },
  );
  await page.route("https://studio-test.supabase.co/**", (route) => route.fulfill({ json: user }));
  await page.route("http://127.0.0.1:4401/**", async (route) => {
    if (route.request().url().includes("/users/me"))
      return route.fulfill({ json: { ...user, role: actor ? "ACTOR" : "CLIENT" } });
    if (route.request().url().includes("/notifications")) return route.fulfill({ json: [] });
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-user-id": id,
        "x-user-role": actor ? "ACTOR" : "CLIENT",
      },
    });
  });
}

test("director generates, edits, validates and sends; actor reviews and submits", async ({
  page,
  request,
  browser,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  const api = `http://127.0.0.1:4401/performance-projects/${fixture.projectId}`;
  const ownerHeaders = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" };
  await login(page, fixture.ownerId);
  await page.goto(`/create-performance?project=${fixture.projectId}`);
  const studio = page.getByTestId("director-studio");
  await expect(studio.getByRole("checkbox")).toBeVisible();
  await studio.getByRole("checkbox").check();
  await studio
    .getByLabel("Camera movements and acting instructions")
    .fill("Three characters greet each other. Wide shot, reverse shots, then tracking.");
  await studio.getByRole("button", { name: "Generate 3D preview" }).click();
  await expect(studio.getByTestId("studio-player")).toBeVisible();
  await expect(studio.locator("canvas")).toBeVisible();
  await studio
    .getByTestId("studio-player")
    .screenshot({ path: "test-results/studio-director.png" });
  await studio.getByRole("button", { name: "Play", exact: true }).click();
  await expect(studio.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await studio.getByRole("button", { name: "Pause", exact: true }).click();
  await studio.getByLabel("Timeline", { exact: true }).fill("10");
  await expect(studio.getByTestId("studio-time")).toContainText("10.0");
  await studio.getByLabel("Position (m) x").first().fill("-2.5");
  await studio.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(studio.getByLabel("Position (m) x").first()).toHaveValue("-3");
  await studio.getByRole("button", { name: "Redo", exact: true }).click();
  await studio.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(studio.getByText("Unsaved changes")).toHaveCount(0);
  await page.reload();
  await expect(studio.getByLabel("Position (m) x").first()).toHaveValue("-2.5");
  await studio
    .getByLabel("Camera movements and acting instructions")
    .fill("Preserve all roles and move the camera closer.");
  await studio.getByRole("button", { name: "Revise with AI", exact: true }).click();
  await expect(studio.getByText("AI generation in progress")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json()).job
          .status,
    )
    .toBe("COMPLETED");
  await expect(studio.getByRole("button", { name: "Validate preview for actor" })).toBeDisabled();
  const blocked = await request.post(`${api}/assignment`, {
    headers: ownerHeaders,
    data: { actorProfileId: fixture.actorId },
  });
  expect(blocked.status()).toBe(409);
  await studio.getByLabel("Actor’s role").selectOption("lea");
  await studio.getByRole("button", { name: "Validate preview for actor" }).click();
  await expect(studio.getByText(/Preview validated/)).toBeVisible();
  const validation = await (
    await request.get(`${api}/director-studio`, { headers: ownerHeaders })
  ).json();
  const unauthorized = await request.get(`${api}/director-studio`, {
    headers: { "x-user-id": fixture.otherUserId, "x-user-role": "CLIENT" },
  });
  expect(unauthorized.status()).toBe(404);
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: fixture.actorName, exact: true }) })
    .getByRole("button", { name: "Select actor", exact: true })
    .click();
  await expect(page.getByText("Request sent to", { exact: false })).toBeVisible();
  const project = await (await request.get(api, { headers: ownerHeaders })).json();
  expect(project.assignment.studioRevisionId).toBe(validation.revision.id);
  const actorContext = await browser.newContext();
  const actorPage = await actorContext.newPage();
  await login(actorPage, fixture.actorUserId, true);
  await actorPage.goto(`/performances/${project.assignment.id}`);
  await expect(actorPage.getByText("Director Studio 3D · Validated preview")).toBeVisible();
  await expect(actorPage.getByTestId("studio-player")).toBeVisible();
  await expect(actorPage.getByRole("button", { name: "Save preview" })).toHaveCount(0);
  await actorPage.getByRole("button", { name: "Accept request", exact: true }).click();
  const actorHeaders = { "x-user-id": fixture.actorUserId, "x-user-role": "ACTOR" };
  await expect(actorPage.locator('input[type="file"]')).toBeVisible();
  const actorRequest = await (
    await request.get(`http://127.0.0.1:4401/performances/${project.assignment.id}`, {
      headers: actorHeaders,
    })
  ).json();
  expect(actorRequest.studioRevision.roleId).toBe("lea");
  expect(actorRequest.studioRevision.instructions).toBeUndefined();
  expect(actorRequest.aiEnginePrompt).toBeUndefined();
  expect(actorRequest.status).toBe("ACCEPTED");
  // Exercise the existing private upload/submit flow with isolated storage and QA providers.
  await actorPage
    .locator('input[type="file"]')
    .setInputFiles({ name: "performance.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(100) });
  await actorPage.getByRole("button", { name: /Upload/ }).click();
  await actorPage.getByRole("button", { name: /Submit/ }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`http://127.0.0.1:4401/performances/${project.assignment.id}`, {
              headers: actorHeaders,
            })
          ).json()
        ).status,
    )
    .toBe("QA_PASSED");
  await actorContext.close();
});

test("mobile demo and WebGL fallback expose timed directions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args as never);
    } as typeof original;
  });
  await page.goto("/director-studio/demo");
  await expect(page.getByText(/Demo scene.*fictional characters/)).toBeVisible();
  await expect(page.getByText(/WebGL 2 is unavailable/)).toBeVisible();
  await expect(page.getByText("Timed directions and positions")).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
