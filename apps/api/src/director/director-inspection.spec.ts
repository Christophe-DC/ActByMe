import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runVideoCommand } from "../virtual-director/video-processing.js";
import { inspectDirectorBytes } from "./director-inspection.js";

test(
  "free API inspection parses actual image, video and audio bytes without native ffprobe",
  { timeout: 60000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "director-free-inspection-"));
    const signal = AbortSignal.timeout(55000);
    try {
      for (const [extension, mime] of [
        ["png", "image/png"],
        ["jpg", "image/jpeg"],
        ["webp", "image/webp"],
        ["mp4", "video/mp4"],
        ["mov", "video/quicktime"],
        ["wav", "audio/wav"],
        ["mp3", "audio/mpeg"],
        ["m4a", "audio/mp4"],
        ["ogg", "audio/ogg"],
      ]) {
        const path = join(directory, `source.${extension}`);
        const image = mime!.startsWith("image/"),
          audio = mime!.startsWith("audio/");
        await runVideoCommand(
          "ffmpeg",
          [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            audio ? "sine=frequency=440:duration=2" : "color=c=teal:s=128x96:r=24:d=2",
            ...(image ? ["-frames:v", "1"] : audio ? [] : ["-c:v", "libx264", "-an"]),
            "-y",
            path,
          ],
          signal,
        );
        const bytes = await readFile(path);
        const data = await inspectDirectorBytes(bytes, mime!, signal);
        assert.equal(data.hasAudio, audio, mime);
        assert.equal(data.width, audio ? null : 128, mime);
        assert.equal(data.height, audio ? null : 96, mime);
        if (!image)
          assert.ok(
            data.duration && Math.abs(data.duration - 2) < 0.15,
            `${mime}: ${data.duration}`,
          );
        else assert.equal(data.duration, null);
        await assert.rejects(
          inspectDirectorBytes(bytes, audio ? "image/png" : "audio/wav", signal),
          /actual format/,
        );
      }
      await assert.rejects(
        inspectDirectorBytes(new TextEncoder().encode("not a video"), "video/mp4", signal),
      );
      await assert.rejects(
        inspectDirectorBytes(new Uint8Array(50 * 1024 * 1024 + 1), "video/mp4", signal),
        /50 MiB/,
      );
      await assert.rejects(
        inspectDirectorBytes(new Uint8Array([1]), "video/mp4", AbortSignal.abort()),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
