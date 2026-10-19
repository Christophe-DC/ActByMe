import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { directorDuration, type DirectorDocument } from "@actbyme/shared";
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
export type DirectorRenderAsset = {
  id: string;
  localPath: string;
  hasAudio: boolean | null;
  duration: number | null;
};
const seconds = (value: number) => value.toFixed(6);
export function directorAudioFilter(document: DirectorDocument, inputIndices: Map<string, number>) {
  const filters: string[] = [];
  const labels: string[] = ["[0:a:0]"];
  for (const item of document.tracks) {
    if (!item.assetId || item.volume === 0) continue;
    const input = inputIndices.get(item.assetId);
    if (input === undefined) continue;
    const label = `mix${labels.length}`;
    const steps = [
      `atrim=start=${seconds(item.offset)}:duration=${seconds(item.duration)}`,
      "asetpts=PTS-STARTPTS",
      "aresample=48000",
      "aformat=channel_layouts=stereo",
      `volume=${item.volume}`,
    ];
    if (item.fadeIn) steps.push(`afade=t=in:st=0:d=${seconds(item.fadeIn)}`);
    if (item.fadeOut)
      steps.push(
        `afade=t=out:st=${seconds(item.duration - item.fadeOut)}:d=${seconds(item.fadeOut)}`,
      );
    steps.push(`adelay=${Math.round(item.start * 1000)}:all=1`);
    filters.push(`[${input}:a:0]${steps.join(",")}[${label}]`);
    labels.push(`[${label}]`);
  }
  filters.push(
    `${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=first,alimiter=limit=0.95:level=0,atrim=duration=${seconds(directorDuration(document))}[audio]`,
  );
  return filters.join(";");
}
export async function renderDirector(
  document: DirectorDocument,
  assets: DirectorRenderAsset[],
  directory: string,
  binary: string,
  signal: AbortSignal,
  progress: (value: number, stage: string) => Promise<void>,
) {
  const width = document.aspectRatio === "16:9" ? 1280 : 720;
  const height = document.aspectRatio === "9:16" ? 1280 : 720;
  const clips: string[] = [];
  for (let index = 0; index < document.shots.length; index++) {
    const shot = document.shots[index]!;
    const asset = assets.find((candidate) => candidate.id === shot.clipAssetId);
    if (!asset?.duration || shot.clipOffset + shot.duration > asset.duration + 0.08)
      throw new Error(`Le clip du plan ${shot.name} est absent ou trop court.`);
    const output = join(directory, `normalized-${index}.mp4`);
    const filter = [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      "setsar=1",
      "fps=24",
      "format=yuv420p",
      "setpts=PTS-STARTPTS",
    ];
    if (shot.transition === "fade" && shot.transitionDuration > 0)
      filter.push(`fade=t=in:st=0:d=${seconds(shot.transitionDuration)}`);
    const next = document.shots[index + 1];
    if (next?.transition === "fade" && next.transitionDuration > 0)
      filter.push(
        `fade=t=out:st=${seconds(shot.duration - Math.min(shot.duration / 2, next.transitionDuration))}:d=${seconds(Math.min(shot.duration / 2, next.transitionDuration))}`,
      );
    const original = shot.originalAudio && asset.hasAudio;
    const args = [
      "-nostdin",
      "-v",
      "error",
      "-threads",
      "2",
      "-protocol_whitelist",
      "file,pipe",
      "-ss",
      seconds(shot.clipOffset),
      "-i",
      asset.localPath,
    ];
    if (!original) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    args.push(
      "-map",
      "0:v:0",
      "-map",
      original ? "0:a:0" : "1:a:0",
      "-t",
      seconds(shot.duration),
      "-vf",
      filter.join(","),
      "-af",
      `aresample=48000,apad,atrim=duration=${seconds(shot.duration)},asetpts=PTS-STARTPTS`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-threads",
      "2",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-video_track_timescale",
      "24000",
      "-y",
      output,
    );
    await runVideoCommand(binary, args, signal, 600000);
    clips.push(output);
    await progress(
      15 + Math.round(((index + 1) / document.shots.length) * 50),
      `Préparation du plan ${index + 1}/${document.shots.length}`,
    );
  }
  const manifest = join(directory, "concat.txt");
  // All names originate here, never from user filenames or paths.
  await writeFile(manifest, clips.map((_, index) => `file 'normalized-${index}.mp4'`).join("\n"));
  const picture = join(directory, "picture.mp4");
  await runVideoCommand(
    binary,
    [
      "-nostdin",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      manifest,
      "-c",
      "copy",
      "-y",
      picture,
    ],
    signal,
    600000,
  );
  const output = join(directory, "advertisement.mp4"),
    indices = new Map<string, number>();
  const args = ["-nostdin", "-v", "error", "-i", picture];
  for (const item of document.tracks) {
    if (!item.assetId || !item.volume || indices.has(item.assetId)) continue;
    const asset = assets.find((candidate) => candidate.id === item.assetId);
    if (!asset?.hasAudio) {
      if (item.track !== "performance") throw new Error("Une piste audio ne contient aucun son.");
      continue;
    }
    indices.set(item.assetId, indices.size + 1);
    args.push("-protocol_whitelist", "file,pipe", "-i", asset.localPath);
  }
  args.push(
    "-filter_complex_threads",
    "2",
    "-filter_complex",
    directorAudioFilter(document, indices),
    "-map",
    "0:v:0",
    "-map",
    "[audio]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    seconds(directorDuration(document)),
    "-movflags",
    "+faststart",
    "-y",
    output,
  );
  await progress(75, "Mixage audio et assemblage MP4");
  await runVideoCommand(binary, args, signal, 600000);
  return output;
}
