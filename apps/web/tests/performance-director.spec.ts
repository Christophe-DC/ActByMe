import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { login } from "./helpers/director-auth";

test.use({ actionTimeout: 15000 });
async function referencePixels(page: Page, url: string, at: number) {
  return page.evaluate(
    async ({ url, at }) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("MP4 could not be decoded"));
      });
      video.currentTime = at;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 18;
      const context = canvas.getContext("2d")!;
      context.drawImage(video, 0, 0, 32, 18);
      const pixels = Array.from(context.getImageData(0, 2, 32, 14).data);
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      video.removeAttribute("src");
      video.load();
      return { pixels, metadata };
    },
    { url, at },
  );
}
const difference = (first: number[], second: number[]) =>
  first.reduce((sum, value, index) => sum + Math.abs(value - second[index]!), 0) / first.length;

test("Performance Director: import privately, edit synchronized angles, persist and export an actual matching MP4", async ({
  page,
  request,
}) => {
  test.setTimeout(300000);
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId);
  await page.setViewportSize({ width: 1440, height: 1050 });
  let paidCalls = 0;
  await page.route("**/director-projects/**/jobs", (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.kind === "GENERATE"
    ) {
      paidCalls++;
      return route.abort();
    }
    return route.fallback();
  });
  await page.goto("/director");
  await page.getByLabel("New Director project name").fill("Performance camera browser test");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page).toHaveURL(/\/director\/[a-f0-9-]+$/);
  const id = page.url().split("/").at(-1)!,
    headers = { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" },
    api = `http://127.0.0.1:4401/director-projects/${id}`;
  const state = async () => (await request.get(api, { headers })).json();
  await expect(page.getByRole("heading", { name: "Your original performance" })).toBeVisible();
  const data = await (
    await request.get("http://127.0.0.1:4401/test-director-source?kind=performance")
  ).body();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  await page
    .getByLabel("Import performance video")
    .setInputFiles({ name: "QA-performance.mp4", mimeType: "video/mp4", buffer: data });
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await expect.poll(async () => (await state()).document.performance.sourceDuration).toBe(2);
  await page.getByRole("button", { name: "Apply Orbit angle", exact: true }).click();
  await page.getByLabel("Orbit arc").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Add angle", exact: true }).click();
  await page.getByRole("button", { name: "Apply Hands angle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Angle 2: Hands", exact: true })).toBeVisible();
  await page.getByLabel("Angle duration", { exact: true }).fill("0.8");
  await expect.poll(async () => (await state()).document.shots[1]?.duration).toBe(0.8);
  await page.getByRole("button", { name: "Move angle earlier", exact: true }).click();
  await expect
    .poll(async () => (await state()).document.shots[0].performanceCamera.preset)
    .toBe("hands");
  await page.getByRole("button", { name: "Undo change", exact: true }).click();
  await expect(page.getByRole("button", { name: "Angle 2: Hands", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play performance preview", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByLabel("Original actor performance")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0.2);
  await expect
    .poll(() => page.getByTestId("performance-current-time").innerText())
    .not.toContain("00:00.00 /");
  await page.getByRole("button", { name: "Pause performance preview", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Angle 2: Hands", exact: true })).toBeVisible();
  const saved = await state();
  expect(saved.document.performance.sourceAssetId).toBeTruthy();
  expect(
    saved.document.shots.reduce(
      (sum: number, shot: { duration: number }) => sum + shot.duration,
      0,
    ),
  ).toBe(2);
  await page.screenshot({ path: "test-results/performance-director-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const planEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download detailed shot plan", exact: true }).click();
  const planDownload = await planEvent;
  const plan = JSON.parse(await readFile((await planDownload.path())!, "utf8"));
  expect(plan.format).toBe("actbyme-performance-camera-plan");
  expect(plan.shots[1].sourceOut).toBe(2);
  expect(plan.shots[1].camera.preset).toBe("hands");
  expect(plan.disclaimer).toContain("does not reproduce");
  expect(JSON.stringify(plan)).not.toMatch(/storageKey|https?:/);
  await page.getByLabel("Confirm reference export rights").check();
  await page.getByRole("button", { name: "Render reference MP4", exact: false }).click();
  await expect
    .poll(async () =>
      (await state()).jobs.some(
        (job: { kind: string; status: string }) =>
          job.kind === "EXPORT" && job.status === "PROCESSING",
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect
    .poll(async () =>
      (await state()).jobs.some(
        (job: { kind: string; status: string }) =>
          job.kind === "EXPORT" && job.status === "CANCELLED",
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Render reference MP4", exact: false }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Render reference MP4", exact: false }).click();
  const download = page.getByRole("link", { name: "Download camera reference MP4", exact: true });
  await expect(download).toBeVisible({ timeout: 180000 });
  await expect(page.getByRole("button", { name: /Saved reference/ })).toBeVisible({
    timeout: 90000,
  });
  const fileEvent = page.waitForEvent("download");
  await download.click();
  const exported = await fileEvent,
    filePath = await exported.path();
  expect(exported.suggestedFilename()).toContain("camera-reference.mp4");
  const bytes = await readFile(filePath!);
  expect(bytes.length).toBeGreaterThan(5000);
  const first = await referencePixels(page, (await download.getAttribute("href")) as string, 0.3),
    second = await referencePixels(page, (await download.getAttribute("href")) as string, 1.6);
  expect(first.metadata.width).toBe(1280);
  expect(first.metadata.height).toBe(720);
  expect(Math.abs(first.metadata.duration - 2)).toBeLessThan(0.15);
  expect(difference(first.pixels, second.pixels)).toBeGreaterThan(5);
  const rawAudio = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    filePath!,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "8000",
    "-f",
    "s16le",
    "-",
  ]);
  let energy = 0;
  for (let index = 0; index < rawAudio.length; index += 2)
    energy += rawAudio.readInt16LE(index) ** 2;
  expect(Math.sqrt(energy / (rawAudio.length / 2))).toBeGreaterThan(100);
  const completed = await state();
  expect(completed.jobs.filter((job: { kind: string }) => job.kind === "GENERATE")).toHaveLength(0);
  expect(
    completed.jobs.find((job: { stage: string }) => job.stage === "Camera reference MP4 available"),
  ).toBeTruthy();
  expect(paidCalls).toBe(0);
});

test("Performance Director local mode accepts a source without uploading it and exports the actual planned angles", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  let writes = 0;
  await page.route("**/director-projects**", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.abort();
  });
  await page.goto("/director/demo");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByLabel("Import performance video")).toBeDisabled();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  const data = await (
    await request.get("http://127.0.0.1:4401/test-director-source?kind=video")
  ).body();
  await page
    .getByLabel("Import performance video")
    .setInputFiles({ name: "local-performance.mp4", mimeType: "video/mp4", buffer: data });
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await page.getByRole("button", { name: "Apply Behind angle", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByLabel("Include original audio").uncheck();
  await page.getByLabel("Reference video format").selectOption("9:16");
  await page.getByLabel("Confirm reference export rights").check();
  await page.getByRole("button", { name: "Render reference MP4", exact: false }).click();
  await expect(page.getByRole("link", { name: "Download camera reference MP4" })).toBeVisible({
    timeout: 120000,
  });
  const url = await page
    .getByRole("link", { name: "Download camera reference MP4" })
    .getAttribute("href");
  const rendered = await referencePixels(page, url!, 0.3);
  expect(rendered.metadata.width).toBe(720);
  expect(rendered.metadata.height).toBe(1280);
  expect(Math.abs(rendered.metadata.duration - 8)).toBeLessThan(0.15);
  const later = await referencePixels(page, url!, 2.3);
  expect(difference(rendered.pixels, later.pixels)).toBeGreaterThan(5);
  expect(writes).toBe(0);
});

test("Performance Director remains simple and within the viewport, and blocks unsupported imports", async ({
  page,
}) => {
  await page.goto("/director/demo");
  await expect(page.getByRole("button", { name: /Apply .* angle/ })).toHaveCount(10);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const step of ["Import", "Camera angles", "Preview", "Export"]) {
      await page.getByRole("button", { name: step, exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(1);
    }
  }
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  await page.getByLabel("Import performance video").setInputFiles({
    name: "not-video.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a video"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose an MP4 or MOV");
  await page.screenshot({ path: "test-results/performance-director-mobile.png", fullPage: true });
});

test("Performance Director keeps a local performance and its camera choices when signing in and saving", async ({
  page,
  request,
}) => {
  const fixture = await (await request.get("http://127.0.0.1:4401/test-fixture")).json();
  await login(page, fixture.ownerId, false);
  await page.goto("/director/demo");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  const bytes = await (
    await request.get("http://127.0.0.1:4401/test-director-source?kind=performance")
  ).body();
  await page
    .getByLabel("Import performance video")
    .setInputFiles({ name: "saved-local-performance.mp4", mimeType: "video/mp4", buffer: bytes });
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await page.getByRole("button", { name: "Apply Behind angle", exact: true }).click();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Log in", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email", { exact: true }).fill("director-test@studio.test");
  await dialog.getByLabel("Password", { exact: true }).fill("test-only-password");
  await dialog.locator("form").getByRole("button", { name: "Login", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page).toHaveURL(/\/director\/[a-f0-9-]+$/);
  await expect(page.getByLabel("Original actor performance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Angle 1: Behind", exact: true })).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  const state = await (
    await request.get(`http://127.0.0.1:4401/director-projects/${id}`, {
      headers: { "x-user-id": fixture.ownerId, "x-user-role": "CLIENT" },
    })
  ).json();
  expect(state.document.performance.sourceAssetId).toBeTruthy();
  expect(
    state.assets.find(
      (asset: { id: string }) => asset.id === state.document.performance.sourceAssetId,
    ).name,
  ).toBe("saved-local-performance.mp4");
});

test("Performance Director supports dragging, resizing, undo and deletion without losing source time", async ({
  page,
}) => {
  await page.goto("/director/demo");
  const first = page.getByRole("button", { name: "Angle 1: Front", exact: true });
  await page
    .getByRole("button", { name: "Angle 5: Orbit", exact: true })
    .locator("..")
    .dragTo(first.locator(".."));
  await expect(page.getByRole("button", { name: "Angle 1: Orbit", exact: true })).toBeVisible();
  const handle = page.getByRole("slider", { name: "Duration of angle 1", exact: true });
  const bounds = await handle.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 45, bounds!.y + 12, { steps: 8 });
  await page.mouse.up();
  await expect(handle).not.toHaveAttribute("aria-valuenow", "3");
  await page.getByRole("button", { name: "Undo change", exact: true }).click();
  await expect(handle).toHaveAttribute("aria-valuenow", "3");
  await page.getByRole("button", { name: "Angle 1: Orbit", exact: true }).click();
  await page.getByRole("button", { name: "Delete angle", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Angle \d+:/ })).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Performance camera timeline" })).toContainText(
    "15.00 seconds",
  );
});
