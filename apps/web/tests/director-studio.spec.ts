import { PerspectiveCamera, Vector3 } from "three";
import { sampleCamera, sampleCharacter } from "@actbyme/shared";
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
  await studio.getByRole("button", { name: "Start creating", exact: true }).click();
  await studio
    .getByLabel("Your direction")
    .fill("Three characters greet each other. Wide shot, reverse shots, then tracking.");
  await studio.getByRole("button", { name: "Create my scene" }).click();
  await expect(studio.getByTestId("studio-player")).toBeVisible();
  await expect(studio.locator("canvas")).toBeVisible();
  await studio
    .getByTestId("studio-player")
    .screenshot({ path: "test-results/studio-director.png" });
  const initial = await (
    await request.get(`${api}/director-studio`, { headers: ownerHeaders })
  ).json();
  await expect(studio.getByLabel("Character name")).toHaveCount(0);
  await expect(studio.getByRole("button", { name: /^Resize/ })).toHaveCount(0);
  await studio
    .getByRole("region", { name: "Storyboard", exact: true })
    .getByRole("button", { name: /Léa — reverse shot/ })
    .click();
  await expect(studio.getByLabel("Camera view")).toHaveValue("lea-close");
  await studio.getByLabel("Camera view").selectOption("");
  await studio.getByRole("button", { name: "Restart", exact: true }).click();
  const canvas = studio.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  const cameraData = sampleCamera(initial.revision.scene, 0);
  const camera = new PerspectiveCamera(cameraData.fov, bounds!.width / bounds!.height, 0.1, 100);
  camera.position.set(cameraData.position.x, cameraData.position.y, cameraData.position.z);
  camera.lookAt(cameraData.target.x, cameraData.target.y, cameraData.target.z);
  camera.updateMatrixWorld();
  const person = sampleCharacter(initial.revision.scene.characters[0], 0).position;
  const point = new Vector3(person.x, 1.1, person.z).project(camera);
  const pointerX = bounds!.x + ((point.x + 1) / 2) * bounds!.width;
  const pointerY = bounds!.y + ((1 - point.y) / 2) * bounds!.height;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX + 50, pointerY + 10, { steps: 8 });
  await page.mouse.up();
  expect(
    (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json()).revision
      .scene.characters,
  ).toEqual(initial.revision.scene.characters);
  await page.mouse.click(pointerX, pointerY);
  await expect(studio.getByRole("complementary").getByText(/Selected:/)).toContainText("Léa");
  await studio.getByLabel("Describe your change").fill("Rename this person to Lea edited.");
  await studio.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.characters[0].name,
    )
    .toBe("Lea edited");
  await page.reload();
  await studio
    .getByRole("complementary")
    .getByRole("button", { name: "Lea edited", exact: true })
    .click();
  const beforeEdit = await (
    await request.get(`${api}/director-studio`, { headers: ownerHeaders })
  ).json();
  await studio
    .getByLabel("Describe your change")
    .fill("Make this character wave before sitting down.");
  await studio.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json()).job
          .status,
    )
    .toBe("COMPLETED");
  const afterEdit = await (
    await request.get(`${api}/director-studio`, { headers: ownerHeaders })
  ).json();
  expect(afterEdit.revision.scene.shots).toEqual(beforeEdit.revision.scene.shots);
  expect(afterEdit.revision.scene.characters[1]).toEqual(beforeEdit.revision.scene.characters[1]);
  await studio.getByRole("button", { name: "Dialogue 1", exact: true }).click();
  await studio.getByLabel("Dialogue text").fill("Je suis contente que tu sois venu.");
  await studio.getByRole("button", { name: "Undo dialogue", exact: true }).click();
  await studio.getByRole("button", { name: "Redo dialogue", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.cues[0].dialogue,
    )
    .toBe("Je suis contente que tu sois venu.");
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: fixture.actorName, exact: true }) })
      .getByRole("button", { name: "Select actor", exact: true }),
  ).toBeDisabled();
  const blocked = await request.post(`${api}/assignment`, {
    headers: ownerHeaders,
    data: { actorProfileId: fixture.actorId },
  });
  expect(blocked.status()).toBe(409);
  await studio.getByLabel("Actor’s role").selectOption("lea");
  await studio.getByRole("button", { name: "Prepare actor guide", exact: true }).click();
  await page.getByRole("button", { name: "Validate scene and guide", exact: true }).click();
  await expect(studio.getByText(/Scene and actor guide are synchronized/)).toBeVisible();
  const validation = await (
    await request.get(`${api}/director-studio`, { headers: ownerHeaders })
  ).json();
  const synchronized = await (await request.get(api, { headers: ownerHeaders })).json();
  expect(synchronized.scenes[0].dialogue).toBe("Je suis contente que tu sois venu.");
  expect(synchronized.actorGuide.dialogue).toBe(synchronized.scenes[0].dialogue);
  expect(synchronized.scenes[0].duration).toBe("24 seconds");
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
  expect(actorRequest.actorGuide.dialogue).toBe("Je suis contente que tu sois venu.");
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
  const qaInput = await (await request.get("http://127.0.0.1:4401/test-qa-input")).json();
  expect(qaInput.scene.dialogue).toBe(actorRequest.actorGuide.dialogue);
  expect(qaInput.scene.duration).toBe("24 seconds");
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
  await expect(page.getByText(/3D playback is unavailable/)).toBeVisible();
  await expect(page.getByText("Your scene, step by step")).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("template scene auto-saves, restores history and shares an immutable revocable preview", async ({
  page,
  request,
  browser,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.goto("/studio");
  await page.getByRole("button", { name: /Introduce yourself/ }).click();
  const studio = page.getByTestId("director-studio");
  await expect(studio.getByTestId("studio-player")).toBeVisible();
  await studio.getByRole("button", { name: "Dialogue 1", exact: true }).click();
  await studio.getByLabel("Dialogue text").fill("My first dialogue.");
  await expect(studio.getByTestId("studio-save-status")).toHaveText("All changes saved");
  await studio.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).last().click();
  await studio.screenshot({ path: "test-results/studio-workspace-desktop.png" });
  await studio.getByRole("button", { name: "Dialogue 1", exact: true }).click();
  await studio.getByLabel("Dialogue text").fill("A safe line: <script>alert(1)</script>");
  await expect(studio.getByTestId("studio-save-status")).toHaveText("All changes saved");
  await studio.getByRole("button", { name: "Export", exact: true }).click();
  const fileEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download scene data", exact: true }).click();
  const file = await fileEvent;
  expect(file.suggestedFilename()).toBe("actbyme-scene.json");
  const { readFile } = await import("node:fs/promises");
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.scene.characters.length).toBe(1);
  const boardEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download offline storyboard", exact: true }).click();
  const board = await boardEvent;
  const html = await readFile((await board.path())!, "utf8");
  expect(html).toContain("Print / Save as PDF");
  expect(html).toContain("Storyboard");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert(1)</script>");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await studio.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Create a viewing link", exact: true }).click();
  const url = await page.getByLabel("Viewing link", { exact: true }).inputValue();
  const anonymous = await browser.newContext();
  const viewer = await anonymous.newPage();
  await viewer.goto(url);
  await expect(viewer.getByTestId("studio-player")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Apply change" })).toHaveCount(0);
  await page.getByRole("button", { name: "Turn off link", exact: true }).click();
  await viewer.reload();
  await expect(viewer.locator("main").getByRole("alert")).toContainText(
    "expired or was turned off",
  );
  await anonymous.close();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await studio.getByRole("button", { name: "Room view", exact: true }).click();
  await studio.getByRole("button", { name: "Select Alex", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(studio.getByTestId("studio-save-status")).toHaveText("All changes saved");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await studio.screenshot({ path: "test-results/studio-workspace-mobile.png" });
});

test("create a scene directly from a script without a recording plan", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.goto("/studio");
  await page.getByLabel("Scene name", { exact: true }).fill("A new beginning");
  await page
    .getByLabel("Your script", { exact: true })
    .fill("Lea meets Marc. Sam crosses behind them. Lea waves and says hello.");
  await page.getByRole("button", { name: "Create my scene", exact: true }).click();
  await expect(page.getByTestId("studio-player")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A new beginning", exact: true })).toBeVisible();
  const projectId = new URL(page.url()).searchParams.get("project");
  const state = await (
    await request.get(`http://127.0.0.1:4401/performance-projects/${projectId}/director-studio`, {
      headers: { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" },
    })
  ).json();
  expect(state.needsBrief).toBe(true);
  expect(state.job.status).toBe("COMPLETED");
});

test("shared feedback stays on its snapshot and can be given to the assistant", async ({
  page,
  request,
  browser,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.goto("/studio");
  await page.getByRole("button", { name: /Introduce yourself/ }).click();
  const studio = page.getByTestId("director-studio");
  await expect(studio.getByTestId("studio-player")).toBeVisible();
  await studio.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByLabel("Allow signed-in viewers to leave feedback").check();
  await page.getByRole("button", { name: "Create a viewing link" }).click();
  const url = await page.getByLabel("Viewing link").inputValue();
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await login(viewer, fixture.otherUserId);
  await viewer.goto(url);
  await viewer.getByLabel("Timeline", { exact: true }).fill("4");
  await viewer.getByLabel("Feedback display name").fill("Reviewer");
  await viewer.getByLabel("Your feedback").fill("Wait a little before waving.");
  await viewer.getByRole("button", { name: "Send feedback", exact: true }).click();
  await expect(viewer.locator("article").getByText("Wait a little before waving.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await studio.getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Wait a little before waving.")).toBeVisible();
  await page.getByRole("button", { name: "Mark resolved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Give to assistant", exact: true }).click();
  await expect(studio.getByLabel("Describe your change")).toHaveValue(
    "Wait a little before waving.",
  );
  await expect(studio.getByTestId("studio-time")).toContainText("4.0");
  await studio.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Turn off link", exact: true }).click();
  await viewer.reload();
  await expect(viewer.locator("main").getByRole("alert")).toContainText(
    "expired or was turned off",
  );
  await context.close();
});

test("offline dialogue survives reload; invalid AI and cancellation preserve the scene", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.goto("/studio");
  await page.getByRole("button", { name: /Introduce yourself/ }).click();
  const studio = page.getByTestId("director-studio");
  await expect(studio.getByTestId("studio-player")).toBeVisible();
  await studio.getByRole("button", { name: "Dialogue 1", exact: true }).click();
  await page.route("**/director-studio/revision", (route) => route.abort("internetdisconnected"));
  await studio.getByLabel("Dialogue text").fill("This text must survive a connection failure.");
  await expect(studio.getByTestId("studio-save-status")).toContainText("Server save needs retry");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await studio.getByRole("button", { name: "Dialogue 1", exact: true }).click();
  await expect(studio.getByLabel("Dialogue text")).toHaveValue(
    "This text must survive a connection failure.",
  );
  await expect(studio.getByTestId("studio-save-status")).toContainText("Server save needs retry");
  await page.unroute("**/director-studio/revision");
  await studio.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(studio.getByTestId("studio-save-status")).toHaveText("All changes saved");
  const projectId = new URL(page.url()).searchParams.get("project");
  const api = "http://127.0.0.1:4401/performance-projects/" + projectId + "/director-studio";
  const headers = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" };
  const before = await (await request.get(api, { headers })).json();
  await request.post("http://127.0.0.1:4401/test-assistant-mode", { data: { mode: "invalid" } });
  await studio
    .getByRole("complementary")
    .getByRole("button", { name: "Alex", exact: true })
    .click();
  await studio.getByLabel("Describe your change").fill("Change this person's color.");
  await studio.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(studio.getByRole("button", { name: "Retry request", exact: true })).toBeVisible();
  expect((await (await request.get(api, { headers })).json()).revision.scene).toEqual(
    before.revision.scene,
  );
  await request.post("http://127.0.0.1:4401/test-assistant-mode", { data: { mode: "normal" } });
  await studio.getByRole("button", { name: "Retry request", exact: true }).click();
  await expect
    .poll(async () => (await (await request.get(api, { headers })).json()).job.status)
    .toBe("COMPLETED");
  await studio.getByRole("button", { name: "Apply change", exact: true }).click();
  await studio.getByRole("button", { name: "Cancel request", exact: true }).click();
  await expect
    .poll(async () => (await (await request.get(api, { headers })).json()).job.status)
    .toBe("CANCELLED");
});

test("paused preview stops drawing and playback remains smooth without editor mutations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype;
    const draw = prototype.drawElements;
    prototype.drawElements = function (...args) {
      const stats = window as unknown as { studioDraws?: number };
      stats.studioDraws = (stats.studioDraws ?? 0) + 1;
      return Reflect.apply(draw, this, args);
    };
  });
  await page.goto("/director-studio/demo");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Timeline", { exact: true }).fill("3");
  await page.waitForTimeout(1500);
  const reads = () =>
    page.evaluate(() => (window as unknown as { studioDraws?: number }).studioDraws ?? 0);
  const paused = await reads();
  await page.waitForTimeout(500);
  expect(await reads()).toBe(paused);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(reads).toBeGreaterThan(paused);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(300);
  const stopped = await reads();
  await page.waitForTimeout(500);
  expect(await reads()).toBe(stopped);
});
