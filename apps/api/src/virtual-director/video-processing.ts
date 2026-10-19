import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { sampleCamera, sampleCharacterPose, type VirtualJobInput } from "@actbyme/shared";
import { validatedOutputUrl } from "./video-provider.js";
const execute = promisify(execFile);
export async function runVideoCommand(
  binary: string,
  args: string[],
  signal: AbortSignal,
  timeout = 180000,
) {
  try {
    return await execute(binary, args, { signal, timeout, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    if (signal.aborted) throw new Error("Video task stopped.", { cause: error });
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(`Missing worker dependency: ${binary}.`, { cause: error });
    throw new Error(
      "Video processing failed or exceeded its time limit. Check the worker dependencies and input format.",
      { cause: error },
    );
  }
}
const probeSchema = z.object({
  format: z.object({ duration: z.coerce.number().finite().positive() }),
  streams: z.array(
    z.object({
      codec_type: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  ),
});
export async function inspectVideo(path: string, binary: string, signal: AbortSignal) {
  const result = await runVideoCommand(
    binary,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "mov",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      path,
    ],
    signal,
    30000,
  );
  const data = probeSchema.parse(JSON.parse(result.stdout));
  const video = data.streams.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height)
    throw new Error("The file does not contain a usable video stream.");
  if (video.width > 7680 || video.height > 7680 || video.width < 64 || video.height < 64)
    throw new Error("Reference resolution must be between 64 and 7680 pixels per side.");
  return {
    duration: data.format.duration,
    width: video.width,
    height: video.height,
    hasAudio: data.streams.some((stream) => stream.codec_type === "audio"),
  };
}
export async function prepareReference(
  source: string,
  destination: string,
  start: number,
  duration: number,
  binary: string,
  signal: AbortSignal,
) {
  await runVideoCommand(
    binary,
    [
      "-nostdin",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "mov",
      "-i",
      source,
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1",
      "-r",
      "24",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-maxrate",
      "8M",
      "-bufsize",
      "16M",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-y",
      destination,
    ],
    signal,
  );
}
export async function restoreReferenceAudio(
  generated: string,
  reference: string,
  destination: string,
  hasAudio: boolean,
  duration: number,
  binary: string,
  signal: AbortSignal,
) {
  const args = ["-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", generated];
  if (hasAudio) args.push("-i", reference);
  args.push("-map", "0:v:0");
  if (hasAudio) args.push("-map", "1:a:0", "-c:a", "aac");
  else args.push("-an");
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    "-y",
    destination,
  );
  await runVideoCommand(binary, args, signal);
}
export async function downloadProviderVideo(
  address: string,
  signal: AbortSignal,
  maxBytes = 200 * 1024 * 1024,
) {
  const response = await fetch(validatedOutputUrl(address), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error("The generated video could not be downloaded.");
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("The generated video exceeds the file size limit.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) {
      await response.body.cancel().catch(() => undefined);
      throw new Error("The generated video exceeds the file size limit.");
    }
    chunks.push(chunk);
  }
  if (!size) throw new Error("The provider returned an empty video.");
  return Buffer.concat(chunks);
}
// Both browser and Blender consume the authoritative shared animation sampler.
export async function writeBlenderScene(input: VirtualJobInput, path: string) {
  const fps = 8;
  const frames = Array.from(
    { length: Math.max(1, Math.ceil((input.shot.end - input.shot.start) * fps)) },
    (_, index) => {
      const time = input.shot.start + index / fps;
      return {
        frame: index + 1,
        camera: sampleCamera(input.scene, time, input.shot.id),
        characters: input.scene.characters.map((character) => ({
          id: character.id,
          ...sampleCharacterPose(character, time, input.scene),
        })),
      };
    },
  );
  await writeFile(path, JSON.stringify({ scene: input.scene, shot: input.shot, fps, frames }));
}
