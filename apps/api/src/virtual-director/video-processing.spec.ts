import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultVirtualScene, sampleCamera, virtualJobInputSchema } from "@actbyme/shared";
import {
  inspectVideo,
  prepareReference,
  restoreReferenceAudio,
  runVideoCommand,
  writeBlenderScene,
} from "./video-processing.js";
test("real FFmpeg trims a reference and restores its original audio to a silent generated fixture", async () => {
  const binary = process.env.FFMPEG_PATH || "ffmpeg",
    probe = process.env.FFPROBE_PATH || "ffprobe";
  const directory = await mkdtemp(join(tmpdir(), "vd-media-test-"));
  const signal = AbortSignal.timeout(30000);
  try {
    try {
      await runVideoCommand(binary, ["-version"], signal);
    } catch (error) {
      if ((error as Error).message.startsWith("Missing worker")) {
        return;
      }
      throw error;
    }
    const source = join(directory, "source.mp4"),
      clip = join(directory, "clip.mp4"),
      silent = join(directory, "silent.mp4"),
      output = join(directory, "output.mp4");
    await runVideoCommand(
      binary,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=320x240:r=24:d=6",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=6",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        source,
      ],
      signal,
    );
    await prepareReference(source, clip, 1, 4, binary, signal);
    const metadata = await inspectVideo(clip, probe, signal);
    assert.equal(metadata.width, 1280);
    assert.equal(metadata.height, 720);
    assert.equal(metadata.hasAudio, true);
    assert.ok(Math.abs(metadata.duration - 4) < 0.1);
    await runVideoCommand(
      binary,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360:r=24:d=4",
        "-c:v",
        "libx264",
        "-an",
        "-y",
        silent,
      ],
      signal,
    );
    await restoreReferenceAudio(silent, clip, output, true, 4, binary, signal);
    assert.equal((await inspectVideo(output, probe, signal)).hasAudio, true);
    await restoreReferenceAudio(silent, clip, output, false, 4, binary, signal);
    assert.equal((await inspectVideo(output, probe, signal)).hasAudio, false);
    const scene = defaultVirtualScene("Sampled staging");
    const input = virtualJobInputSchema.parse({
      scene,
      shot: scene.shots[0],
      sourceStartSeconds: 0,
      instructions: "",
      model: "bytedance/seedance-2.0/reference-to-video",
      sourceConsentId: null,
    });
    const path = join(directory, "scene.json");
    await writeBlenderScene(input, path);
    const sampled = JSON.parse(await readFile(path, "utf8"));
    assert.equal(sampled.frames.length, 40);
    assert.deepEqual(sampled.frames[0].camera, sampleCamera(scene, 0, scene.shots[0]!.id));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
