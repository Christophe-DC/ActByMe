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
  const canvas = studio.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const canvasBounds = await canvas.boundingBox();
  const cameraData = sampleCamera(initial.revision.scene, 0);
  const camera = new PerspectiveCamera(
    cameraData.fov,
    canvasBounds!.width / canvasBounds!.height,
    0.1,
    100,
  );
  camera.position.set(cameraData.position.x, cameraData.position.y, cameraData.position.z);
  camera.lookAt(cameraData.target.x, cameraData.target.y, cameraData.target.z);
  camera.updateMatrixWorld();
  const person = sampleCharacter(initial.revision.scene.characters[0], 0).position;
  const projected = new Vector3(person.x, person.y + 1.1, person.z).project(camera);
  const pointerX = canvasBounds!.x + ((projected.x + 1) / 2) * canvasBounds!.width;
  const pointerY = canvasBounds!.y + ((1 - projected.y) / 2) * canvasBounds!.height;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX + 60, pointerY + 10, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.characters[0].keyframes[0].position.x,
    )
    .not.toBe(person.x);
  await studio.getByRole("button", { name: "Play", exact: true }).click();
  await expect(studio.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await studio.getByRole("button", { name: "Pause", exact: true }).click();
  await studio.getByLabel("Timeline", { exact: true }).fill("10");
  await expect(studio.getByTestId("studio-time")).toContainText("10.0");
  await studio.getByRole("button", { name: "Arrange scene", exact: true }).click();
  const personCircle = studio
    .getByRole("button", { name: "Move Léa", exact: true })
    .locator("circle");
  const bounds = await personCircle.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 35, bounds!.y + bounds!.height / 2 + 15, {
    steps: 8,
  });
  await page.mouse.up();
  const chair = studio.getByRole("button", { name: "Move chair 1", exact: true });
  await chair.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.props[0].position.x,
    )
    .toBe(initial.revision.scene.props[0].position.x + 0.2);
  const cameraEdge = studio.getByRole("button", { name: "Resize Wide shot", exact: true });
  await cameraEdge.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.shots[0].end,
    )
    .toBe(initial.revision.scene.shots[0].end + 0.5);
  const dialogueEdge = studio.getByRole("button", { name: "Resize dialogue 1", exact: true });
  await dialogueEdge.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await (await request.get(`${api}/director-studio`, { headers: ownerHeaders })).json())
          .revision.scene.cues[0].end,
    )
    .toBe(initial.revision.scene.cues[0].end + 0.5);
  await studio.getByRole("button", { name: "Move Léa", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await studio.getByRole("button", { name: "Undo", exact: true }).click();
  await studio.getByRole("button", { name: "Redo", exact: true }).click();
  await studio.getByLabel("Character name").fill("Lea edited");
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
  await expect(studio.getByLabel("Character name")).toHaveValue("Lea edited");
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
  await expect(
    studio.getByRole("button", { name: "Validate for actor", exact: true }),
  ).toBeDisabled();
  const blocked = await request.post(`${api}/assignment`, {
    headers: ownerHeaders,
    data: { actorProfileId: fixture.actorId },
  });
  expect(blocked.status()).toBe(409);
  await studio.getByLabel("Actor’s role").selectOption("lea");
  await studio.getByRole("button", { name: "Validate for actor" }).click();
  await expect(studio.getByText("This scene is validated and ready to send.")).toBeVisible();
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
  await studio.getByLabel("Scene name", { exact: true }).fill("My first scene");
  await expect(studio.getByTestId("studio-save-status")).toHaveText("All changes saved");
  await studio.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Scene history" })).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).last().click();
  await expect(studio.getByLabel("Scene name", { exact: true })).toHaveValue("Introduce yourself");
  await studio.screenshot({ path: "test-results/studio-workspace-desktop.png" });
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
  await studio.getByRole("button", { name: "Arrange scene", exact: true }).click();
  await studio.getByRole("button", { name: "Move Alex", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
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
