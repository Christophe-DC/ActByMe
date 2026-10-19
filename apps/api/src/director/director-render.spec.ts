import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createDirectorDocument, createDirectorShot } from "@actbyme/shared";
import { runVideoCommand } from "../virtual-director/video-processing.js";
import { inspectDirectorAsset, renderDirector } from "./director-render.js";
test(
  "real FFmpeg assembly preserves shot order, timing, replacement, fades and audio events",
  { timeout: 120000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "director-render-test-")),
      signal = AbortSignal.timeout(110000),
      binary = process.env.FFMPEG_PATH ?? "ffmpeg",
      probe = process.env.FFPROBE_PATH ?? "ffprobe";
    try {
      const paths = {
        red: join(directory, "red.mp4"),
        blue: join(directory, "blue.mp4"),
        green: join(directory, "green.mp4"),
        music: join(directory, "music.wav"),
      };
      for (const color of ["red", "blue", "green"] as const)
        await runVideoCommand(
          binary,
          [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            `color=c=${color}:s=320x240:r=24:d=4`,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-y",
            paths[color],
          ],
          signal,
        );
      await runVideoCommand(
        binary,
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=500:duration=4",
          "-c:a",
          "pcm_s16le",
          "-y",
          paths.music,
        ],
        signal,
      );
      const red = randomUUID(),
        blue = randomUUID(),
        green = randomUUID(),
        music = randomUUID();
      const document = createDirectorDocument("Synthetic commercial");
      document.shots = [
        { ...createDirectorShot("dolly-in", "first", 4), clipAssetId: red },
        {
          ...createDirectorShot("dolly-out", "second", 4),
          clipAssetId: blue,
          transition: "fade",
          transitionDuration: 0.3,
        },
      ];
      document.tracks = [
        {
          id: "music",
          track: "music",
          label: "Synthetic tone",
          start: 2,
          duration: 2,
          offset: 1,
          volume: 0.5,
          fadeIn: 0.1,
          fadeOut: 0.1,
          assetId: music,
          castId: null,
          instructions: "",
        },
        {
          id: "voice",
          track: "voice",
          label: "Synthetic voice timing",
          start: 6,
          duration: 1,
          offset: 0,
          volume: 0.8,
          fadeIn: 0,
          fadeOut: 0,
          assetId: music,
          castId: null,
          instructions: "",
        },
      ];
      const assets = [
        { id: red, localPath: paths.red, hasAudio: false, duration: 4 },
        { id: blue, localPath: paths.blue, hasAudio: false, duration: 4 },
        { id: green, localPath: paths.green, hasAudio: false, duration: 4 },
        { id: music, localPath: paths.music, hasAudio: true, duration: 4 },
      ];
      const output = await renderDirector(
        document,
        assets,
        directory,
        binary,
        signal,
        async () => undefined,
      );
      const metadata = await inspectDirectorAsset(output, "video/mp4", probe, signal);
      assert.ok(Math.abs(metadata.duration! - 8) < 0.15);
      assert.equal(metadata.width, 1280);
      assert.equal(metadata.height, 720);
      assert.equal(metadata.hasAudio, true);
      const pixel = async (time: number) => {
        const path = join(directory, "pixel.rgb");
        await runVideoCommand(
          binary,
          [
            "-v",
            "error",
            "-ss",
            String(time),
            "-i",
            output,
            "-vf",
            "crop=200:200:400:200,scale=1:1",
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-y",
            path,
          ],
          signal,
        );
        return readFile(path);
      };
      const first = await pixel(1),
        second = await pixel(5),
        fade = await pixel(4);
      assert.ok(first[0]! > first[2]! + 100);
      assert.ok(second[2]! > second[0]! + 100);
      assert.ok(fade[0]! < 60 && fade[2]! < 60);
      const audioEnergy = async (time: number) => {
        const path = join(directory, "audio.raw");
        await runVideoCommand(
          binary,
          [
            "-v",
            "error",
            "-ss",
            String(time),
            "-i",
            output,
            "-t",
            "0.2",
            "-vn",
            "-f",
            "s16le",
            "-acodec",
            "pcm_s16le",
            "-y",
            path,
          ],
          signal,
        );
        const bytes = await readFile(path);
        let sum = 0;
        for (let index = 0; index < bytes.length; index += 2)
          sum += Math.abs(bytes.readInt16LE(index));
        return sum / (bytes.length / 2);
      };
      assert.ok((await audioEnergy(1)) < 2);
      assert.ok((await audioEnergy(2.5)) > 200);
      assert.ok((await audioEnergy(6.3)) > 400);
      document.shots[1]!.clipAssetId = green;
      await renderDirector(document, assets, directory, binary, signal, async () => undefined);
      const replacementFirst = await pixel(1),
        replacementSecond = await pixel(5);
      assert.deepEqual(replacementFirst, first);
      assert.ok(replacementSecond[1]! > replacementSecond[2]! + 60);
      const invalid = join(directory, "fake.png");
      await writeFile(invalid, "<html>not an image</html>");
      await assert.rejects(inspectDirectorAsset(invalid, "image/png", probe, signal), /signature/);
      const otherAspect = structuredClone(document);
      otherAspect.aspectRatio = "9:16";
      otherAspect.shots = [otherAspect.shots[0]!];
      otherAspect.tracks = [];
      await renderDirector(otherAspect, assets, directory, binary, signal, async () => undefined);
      const vertical = await inspectDirectorAsset(output, "video/mp4", probe, signal);
      assert.equal(vertical.width, 720);
      assert.equal(vertical.height, 1280);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
