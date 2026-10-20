import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

async function importSource(page: Page, buffer: Buffer) {
  await page.goto("/director/demo");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  await page
    .getByLabel("Import performance video")
    .setInputFiles({ name: "motion-test.mp4", mimeType: "video/mp4", buffer });
}
const renderButton = (page: Page) =>
  page.getByRole("button", { name: "Render reference MP4", exact: false });

test("movement model failure blocks silent fixed exports and cancellation offers explicit camera-only mode", async ({
  page,
  request,
}) => {
  await page.route("**/director-motion/v1/pose_landmarker_heavy.task", (route) =>
    route.fulfill({ status: 503, body: "Temporary test outage" }),
  );
  const data = await (
    await request.get("http://127.0.0.1:4401/test-director-source?kind=performance")
  ).body();
  await importSource(page, data);
  const status = page.getByRole("group", { name: "Performance movement" });
  await expect(status.getByRole("alert")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByLabel("Confirm reference export rights").check();
  await expect(renderButton(page)).toBeDisabled();
  await status.getByRole("button", { name: "Retry movement analysis" }).click();
  await status.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(page.getByLabel("Transfer movement from video", { exact: true })).not.toBeChecked();
  await expect(renderButton(page)).toBeEnabled();
  await expect(status).toContainText("Camera only");
});

test("real MediaPipe inference rejects a video without a person instead of inventing movement", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const data = await (
    await request.get("http://127.0.0.1:4401/test-director-source?kind=performance")
  ).body();
  await importSource(page, data);
  await expect(
    page.getByRole("group", { name: "Performance movement" }).getByRole("alert"),
  ).toContainText("No reliable person movement", { timeout: 100000 });
  await expect(page.getByLabel("Neutral stand-in camera preview")).toHaveAttribute(
    "data-motion",
    "camera-only",
  );
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByLabel("Confirm reference export rights").check();
  await expect(renderButton(page)).toBeDisabled();
});

test("real actor tracking moves the figure with a fixed camera, survives reimport from cache and matches the encoded MP4", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.DIRECTOR_MOTION_TEST_VIDEO,
    "Supply a consented real-person MP4; real landmarks are never mocked.",
  );
  test.setTimeout(300000);
  const fixture = testInfo.outputPath("consented-performance.mp4");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    process.env.DIRECTOR_MOTION_TEST_VIDEO!,
    "-t",
    "3.5",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "24",
    "-an",
    "-y",
    fixture,
  ]);
  let writes = 0,
    externalAnalysis = 0;
  await page.route("**/director-projects**", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.abort();
  });
  page.on("request", (request) => {
    if (/googleapis\.com|generativelanguage|higgsfield/.test(request.url())) externalAnalysis++;
  });
  const data = await readFile(fixture);
  await importSource(page, data);
  const canvas = page.getByLabel("Neutral stand-in camera preview");
  await expect(page.getByText("Movement ready", { exact: true })).toBeVisible({ timeout: 150000 });
  await expect(canvas).toHaveAttribute("data-motion", "estimated");
  // Collapse the demo angles and keep a truly fixed body-focused camera.
  const fixedFront = async () => {
    while ((await page.getByRole("button", { name: /^Angle \d+:/ }).count()) > 1) {
      await page
        .getByRole("button", { name: /^Angle \d+:/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Delete angle", exact: true }).click();
    }
    await page.getByRole("button", { name: "Apply Front angle", exact: true }).click();
    await page.getByLabel("Camera movement").selectOption("static");
  };
  await fixedFront();
  await expect(page.getByRole("button", { name: /^Angle \d+:/ })).toHaveCount(1);
  async function at(time: number) {
    const ruler = page.getByLabel("Timeline playhead", { exact: true }),
      box = (await ruler.boundingBox())!;
    await ruler.click({ position: { x: (box.width * time) / 3.5, y: 10 } });
    await expect
      .poll(() =>
        page
          .getByLabel("Original actor performance")
          .evaluate(
            (video: HTMLVideoElement, at: number) =>
              !video.seeking && Math.abs(video.currentTime - at) < 0.05,
            time,
          ),
      )
      .toBe(true);
    return JSON.parse((await canvas.getAttribute("data-joints"))!) as Record<string, number[]>;
  }
  const first = await at(0.3),
    later = await at(2.7);
  const distance = Math.hypot(
    ...first.leftHand!.map((value, axis) => value - later.leftHand![axis]!),
  );
  expect(distance).toBeGreaterThan(0.025);
  const again = await at(0.3);
  expect(again).toEqual(first);
  const preview = async () =>
    canvas.evaluate((element: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = 64;
      copy.height = 36;
      const context = copy.getContext("2d")!;
      context.drawImage(element, 0, 0, 64, 36);
      return Array.from(context.getImageData(0, 4, 64, 28).data);
    });
  const previewFirst = await preview();
  await at(2.7);
  const previewLater = await preview();
  await page.reload();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have permission to use this performance/ }).check();
  const models: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".task")) models.push(request.url());
  });
  await page
    .getByLabel("Import performance video")
    .setInputFiles({ name: "motion-test.mp4", mimeType: "video/mp4", buffer: data });
  await expect(page.getByText("Movement ready", { exact: true })).toBeVisible();
  expect(models).toHaveLength(0);
  await fixedFront();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const planEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download detailed shot plan", exact: true }).click();
  const plan = JSON.parse(await readFile((await (await planEvent).path())!, "utf8"));
  expect(plan.motion.mode).toBe("estimated-motion");
  expect(plan.motion.coverage.body).toBeGreaterThan(0.8);
  expect(plan.motion.coverage.hands).toBeGreaterThan(0.5);
  expect(plan.motion.frames).toBe(85);
  await page.getByLabel("Confirm reference export rights").check();
  await renderButton(page).click();
  const link = page.getByRole("link", { name: "Download camera reference MP4", exact: true });
  await expect(link).toBeVisible({ timeout: 150000 });
  const event = page.waitForEvent("download");
  await link.click();
  const download = await event;
  const file = testInfo.outputPath("animated-reference.mp4");
  await download.saveAs(file);
  const decoded = async (time: number) =>
    page.evaluate(
      async ({ url, time }) => {
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Invalid exported MP4"));
        });
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 36;
        const context = canvas.getContext("2d")!;
        context.drawImage(video, 0, 0, 64, 36);
        return {
          pixels: Array.from(context.getImageData(0, 4, 64, 28).data),
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
      },
      { url: (await link.getAttribute("href"))!, time },
    );
  const frameFirst = await decoded(0.3),
    frameLater = await decoded(2.7);
  const diff = (a: number[], b: number[]) =>
    a.reduce((sum, value, index) => sum + Math.abs(value - b[index]!), 0) / a.length;
  expect(frameFirst.width).toBe(1280);
  expect(frameFirst.height).toBe(720);
  expect(Math.abs(frameFirst.duration - 3.5)).toBeLessThan(0.05);
  expect(diff(frameFirst.pixels, frameLater.pixels)).toBeGreaterThan(0.3);
  expect(diff(frameFirst.pixels, previewFirst)).toBeLessThan(8);
  expect(diff(frameLater.pixels, previewLater)).toBeLessThan(8);
  expect(writes).toBe(0);
  expect(externalAnalysis).toBe(0);
  await testInfo.attach("Actual MediaPipe reference", { path: file, contentType: "video/mp4" });
});
