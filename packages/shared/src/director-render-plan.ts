import { directorDuration, type DirectorDocument, type DirectorAsset } from "./director.js";

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
export async function renderDirectorPlan(
  document: DirectorDocument,
  assets: DirectorRenderAsset[],
  tools: {
    path: (name: string) => string;
    writeText: (path: string, content: string) => Promise<unknown>;
    run: (args: string[]) => Promise<unknown>;
    progress: (value: number, stage: string) => Promise<void>;
  },
) {
  const width = document.aspectRatio === "16:9" ? 1280 : 720;
  const height = document.aspectRatio === "9:16" ? 1280 : 720;
  const clips: string[] = [];
  for (let index = 0; index < document.shots.length; index++) {
    const shot = document.shots[index]!;
    const asset = assets.find((candidate) => candidate.id === shot.clipAssetId);
    if (!asset?.duration || shot.clipOffset + shot.duration > asset.duration + 0.08)
      throw new Error(`The clip for shot ${shot.name} is missing or too short.`);
    const output = tools.path(`normalized-${index}.mp4`);
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
    await tools.run(args);
    clips.push(output);
    await tools.progress(
      15 + Math.round(((index + 1) / document.shots.length) * 50),
      `Preparing shot ${index + 1}/${document.shots.length}`,
    );
  }
  const manifest = tools.path("concat.txt");
  // All names originate here, never from user filenames or paths.
  await tools.writeText(
    manifest,
    clips.map((_, index) => `file 'normalized-${index}.mp4'`).join("\n"),
  );
  const picture = tools.path("picture.mp4");
  await tools.run([
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
  ]);
  const output = tools.path("advertisement.mp4"),
    indices = new Map<string, number>();
  const args = ["-nostdin", "-v", "error", "-i", picture];
  for (const item of document.tracks) {
    if (!item.assetId || !item.volume || indices.has(item.assetId)) continue;
    const asset = assets.find((candidate) => candidate.id === item.assetId);
    if (!asset?.hasAudio) {
      if (item.track !== "performance") throw new Error("An audio track does not contain sound.");
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
  await tools.progress(75, "Mixing audio and assembling the MP4");
  await tools.run(args);
  return output;
}

export function directorBrowserExportError(
  document: DirectorDocument,
  assets: Pick<DirectorAsset, "id" | "sizeBytes">[],
) {
  if (directorDuration(document) > 120 || document.shots.length > 30)
    return "Browser export is limited to 2 minutes and 30 shots. Export the production plan for longer edits.";
  const used = new Set([
    ...(document.performance?.sourceAssetId ? [document.performance.sourceAssetId] : []),
    ...document.shots.flatMap((shot) => (shot.clipAssetId ? [shot.clipAssetId] : [])),
    ...document.tracks.flatMap((item) => (item.assetId && item.volume ? [item.assetId] : [])),
  ]);
  if (
    assets.filter((asset) => used.has(asset.id)).reduce((sum, asset) => sum + asset.sizeBytes, 0) >
    128 * 1024 * 1024
  )
    return "The clips and audio for this export exceed 128 MiB. Compress your files before importing them.";
  return null;
}
