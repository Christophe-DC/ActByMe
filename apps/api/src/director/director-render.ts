import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  renderDirectorPlan,
  type DirectorRenderAsset,
  type DirectorDocument,
} from "@actbyme/shared";
import { runVideoCommand } from "../virtual-director/video-processing.js";

const mediaSchema = z.object({
  format: z.object({
    duration: z.coerce.number().finite().positive().optional(),
    format_name: z.string(),
  }),
  streams: z.array(
    z.object({
      codec_type: z.string(),
      codec_name: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  ),
});
export async function inspectDirectorAsset(
  path: string,
  contentType: string,
  binary: string,
  signal: AbortSignal,
) {
  const bytes = await readFile(path);
  const image = contentType.startsWith("image/");
  if (image) {
    const valid =
      contentType === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : contentType === "image/png"
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP";
    if (!valid) throw new Error("La signature du fichier ne correspond pas à son format image.");
  }
  const result = await runVideoCommand(
    binary,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-show_entries",
      "format=duration,format_name:stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      path,
    ],
    signal,
    30000,
  );
  const data = mediaSchema.parse(JSON.parse(result.stdout));
  const video = data.streams.find((stream) => stream.codec_type === "video");
  const imageStream = data.streams.find((stream) => stream.codec_type === "video");
  const audio = data.streams.some((stream) => stream.codec_type === "audio");
  if (
    !image &&
    contentType.startsWith("video/") &&
    (!video ||
      !data.format.format_name.split(",").some((format) => ["mov", "mp4"].includes(format)))
  )
    throw new Error("Importez une vidéo MP4/MOV valide.");
  if (contentType.startsWith("audio/") && !audio)
    throw new Error("Le fichier ne contient pas de piste audio lisible.");
  const expectedContainers: Record<string, string[]> = {
    "audio/mpeg": ["mp3"],
    "audio/wav": ["wav"],
    "audio/x-wav": ["wav"],
    "audio/mp4": ["mov", "mp4", "m4a"],
    "audio/ogg": ["ogg"],
  };
  if (
    expectedContainers[contentType] &&
    !data.format.format_name
      .split(",")
      .some((format) => expectedContainers[contentType]!.includes(format))
  )
    throw new Error("Le format audio réel ne correspond pas au type déclaré.");
  if (!image && (!data.format.duration || data.format.duration > 600))
    throw new Error("La ressource doit durer entre 0 et 600 secondes.");
  if (image && !imageStream) throw new Error("Image illisible.");
  if (
    imageStream &&
    (!imageStream.width ||
      !imageStream.height ||
      imageStream.width > 7680 ||
      imageStream.height > 7680 ||
      imageStream.width < 32 ||
      imageStream.height < 32)
  )
    throw new Error("La résolution doit être comprise entre 32 et 7680 pixels par côté.");
  return {
    duration: image ? null : data.format.duration!,
    width: imageStream?.width ?? null,
    height: imageStream?.height ?? null,
    hasAudio: audio,
  };
}
export { directorAudioFilter, type DirectorRenderAsset } from "@actbyme/shared";
export async function renderDirector(
  document: DirectorDocument,
  assets: DirectorRenderAsset[],
  directory: string,
  binary: string,
  signal: AbortSignal,
  progress: (value: number, stage: string) => Promise<void>,
) {
  return renderDirectorPlan(document, assets, {
    path: (name) => join(directory, name),
    writeText: (path, content) =>
      import("node:fs/promises").then(({ writeFile }) => writeFile(path, content)),
    run: (args) => runVideoCommand(binary, args, signal, 600000),
    progress,
  });
}
