import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, id: string) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "test@studio.test",
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
test("virtual director: private import, camera editing, asynchronous generation, approval and mobile layout", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-virtual-fixture")).json();
  const api = `http://127.0.0.1:4401/performance-projects/${fixture.projectId}/virtual-director`;
  expect((await request.get(api)).status()).toBe(401);
  expect(
    (
      await request.get(api, {
        headers: { "x-user-id": fixture.otherUserId, "x-user-role": "CLIENT" },
      })
    ).status(),
  ).toBe(404);
  await login(page, fixture.ownerId);
  await page.goto(`/virtual-director/${fixture.projectId}`);
  await page.getByRole("button", { name: "Prepare camera scene" }).click();
  await expect(page.getByTestId("studio-player")).toBeVisible();
  await page.getByLabel("Performer / rights holder").fill("Synthetic test performer");
  await page
    .getByLabel("Authorization and usage scope")
    .fill("Synthetic regression fixture; no real performer.");
  await expect(page.getByLabel("Upload reference video")).toBeDisabled();
  await page.getByRole("checkbox", { name: /I hold the necessary rights/ }).check();
  const source = await request.get("http://127.0.0.1:4401/test-virtual-source");
  await page.getByLabel("Upload reference video").setInputFiles({
    name: "synthetic-test-only.mp4",
    mimeType: "video/mp4",
    buffer: await source.body(),
  });
  await expect(page.getByText(/6.0s · 320 × 240/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save cameras", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save cameras", exact: true }).click();
  await expect(page.getByText("Saved version 2")).toBeVisible();
  await page.getByRole("checkbox", { name: "Select Medium shot for generation" }).check();
  await page.getByRole("button", { name: /Generate 1 shot/ }).click();
  await expect(page.getByRole("button", { name: "Review result", exact: true })).toBeVisible({
    timeout: 35000,
  });
  await expect(page.getByRole("button", { name: "Approve reviewed shot" })).toBeDisabled();
  await page.getByRole("button", { name: "Review result", exact: true }).click();
  await expect(page.getByLabel("Shot result")).toBeVisible();
  await page.getByRole("button", { name: "Approve reviewed shot" }).click();
  await page.getByRole("button", { name: "Prepare download" }).click();
  await expect(page.getByRole("link", { name: "Download approved video" })).toHaveAttribute(
    "href",
    /test-virtual-media/,
  );
  const ownerHeaders = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" };
  const state = await (await request.get(api, { headers: ownerHeaders })).json();
  expect(
    state.jobs.find((job: { kind: string }) => job.kind === "GENERATE").approvedAt,
  ).toBeTruthy();
  expect(JSON.stringify(state)).not.toContain("storageKey");
  expect(JSON.stringify(state)).not.toContain("providerRequest");
  await page.screenshot({ path: "test-results/virtual-director-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "One performance. Your camera angles." }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/virtual-director-mobile.png", fullPage: true });
});
test("virtual director: conflicting saves retain the draft and a provider outage stays visible", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-virtual-fixture")).json();
  const api = `http://127.0.0.1:4401/performance-projects/${fixture.projectId}/virtual-director`;
  const headers = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" };
  await login(page, fixture.ownerId);
  await page.goto(`/virtual-director/${fixture.projectId}`);
  await page.getByRole("button", { name: "Prepare camera scene" }).click();
  await page.getByLabel("Shot name", { exact: true }).fill("Unsaved camera draft");
  const remote = await (await request.get(api, { headers })).json();
  await request.put(`${api}/scene`, {
    headers,
    data: { version: remote.version, scene: { ...remote.scene, title: "Concurrent change" } },
  });
  await page.getByRole("button", { name: "Save cameras", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "another tab" })).toContainText(
    "another tab",
  );
  await expect(page.getByLabel("Shot name", { exact: true })).toHaveValue("Unsaved camera draft");
  await page.getByRole("button", { name: "Discard camera changes" }).click();
  await expect(page.getByLabel("Shot name", { exact: true })).toHaveValue("Medium shot");
  await page.getByLabel("Performer / rights holder").fill("Synthetic test performer");
  await page
    .getByLabel("Authorization and usage scope")
    .fill("Synthetic regression fixture; no real performer.");
  await page.getByRole("checkbox", { name: /I hold the necessary rights/ }).check();
  const source = await request.get("http://127.0.0.1:4401/test-virtual-source");
  await page
    .getByLabel("Upload reference video")
    .setInputFiles({ name: "test-only.mp4", mimeType: "video/mp4", buffer: await source.body() });
  await expect(page.getByText(/6.0s · 320 × 240/)).toBeVisible({ timeout: 30000 });
  await request.post("http://127.0.0.1:4401/test-virtual-mode", { data: { mode: "failure" } });
  try {
    await page.getByRole("checkbox", { name: "Select Medium shot for generation" }).check();
    await page.getByRole("button", { name: /Generate 1 shot/ }).click();
    await expect(page.getByText(/Simulated provider failure/)).toBeVisible({ timeout: 35000 });
    await expect(page.getByRole("button", { name: "Review result", exact: true })).toHaveCount(0);
    const failed = await (await request.get(api, { headers })).json();
    expect(failed.jobs.find((job: { kind: string }) => job.kind === "GENERATE").status).toBe(
      "FAILED",
    );
  } finally {
    await request.post("http://127.0.0.1:4401/test-virtual-mode", { data: { mode: "normal" } });
  }
});
