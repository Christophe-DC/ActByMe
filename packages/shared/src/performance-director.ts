import {
  createDirectorDocument,
  createDirectorShot,
  directorDuration,
  type DirectorDocument,
  type DirectorShot,
  type DirectorAsset,
} from "./director.js";
import {
  performancePresets,
  samplePerformanceCamera,
  type PerformancePresetId,
} from "./performance-camera.js";

export function createPerformanceShot(
  preset: PerformancePresetId,
  id: string,
  duration: number,
): DirectorShot {
  const template = performancePresets.find((item) => item.id === preset)!;
  const shot = createDirectorShot("performance-angle", id, duration);
  shot.name = template.name;
  shot.transitionDuration = 0;
  shot.performanceCamera = { ...template.camera };
  return syncPerformanceWaypoints(shot);
}
export function syncPerformanceWaypoints(shot: DirectorShot) {
  if (!shot.performanceCamera) return shot;
  shot.waypoints = Array.from({ length: 13 }, (_, index) => ({
    id: `${shot.id}_wp_${index}`,
    at: index / 12,
    ...samplePerformanceCamera(shot.performanceCamera!, index / 12),
  }));
  return shot;
}
export function createPerformanceDocument(
  title = "Performance 01",
  demo = false,
): DirectorDocument {
  const document = createDirectorDocument(title);
  document.category = "other";
  document.environment = "studio";
  document.performance = { sourceAssetId: null, sourceDuration: null, originalAudio: true };
  document.shots = (
    demo ? (["front", "close-up", "profile", "hands", "orbit"] as const) : (["front"] as const)
  ).map((preset, index, presets) =>
    createPerformanceShot(preset, `angle_${index}`, 15 / presets.length),
  );
  return document;
}
export function fitPerformanceDuration(
  document: DirectorDocument,
  duration: number,
  assetId: string | null,
) {
  if (!document.performance || duration < 0.5 || duration > 120 || !Number.isFinite(duration))
    throw new Error("Choose a performance between 0.5 seconds and 2 minutes.");
  document.shots = document.shots.slice(0, Math.max(1, Math.floor(duration / 0.5)));
  const previous = directorDuration(document);
  let remaining = duration,
    weight = previous;
  const unfitted = new Set(document.shots);
  while (unfitted.size) {
    const short = [...unfitted].filter((shot) => (shot.duration * remaining) / weight < 0.5);
    if (!short.length) break;
    for (const shot of short) {
      weight -= shot.duration;
      remaining -= 0.5;
      shot.duration = 0.5;
      unfitted.delete(shot);
    }
  }
  for (const shot of unfitted) shot.duration = (shot.duration * remaining) / weight;
  document.performance.sourceAssetId = assetId;
  document.performance.sourceDuration = duration;
}
export function resizePerformanceShot(document: DirectorDocument, id: string, duration: number) {
  const index = document.shots.findIndex((shot) => shot.id === id);
  if (index < 0 || document.shots.length === 1) return;
  const shot = document.shots[index]!;
  const neighbour = document.shots[index === document.shots.length - 1 ? index - 1 : index + 1]!;
  const combined = shot.duration + neighbour.duration;
  const next = Math.max(0.5, Math.min(combined - 0.5, duration));
  neighbour.duration = combined - next;
  shot.duration = next;
}
export function addPerformanceShot(document: DirectorDocument, selectedId: string, id: string) {
  const index = document.shots.findIndex((shot) => shot.id === selectedId);
  const shot = document.shots[index];
  if (!shot || shot.duration < 1 || document.shots.length >= 30) return false;
  shot.duration /= 2;
  document.shots.splice(index + 1, 0, { ...structuredClone(shot), id, waypoints: [] });
  syncPerformanceWaypoints(document.shots[index + 1]!);
  return true;
}
export function removePerformanceShot(document: DirectorDocument, id: string) {
  const index = document.shots.findIndex((shot) => shot.id === id);
  if (index < 0 || document.shots.length === 1) return;
  const removed = document.shots.splice(index, 1)[0]!;
  document.shots[Math.max(0, index - 1)]!.duration += removed.duration;
}
export function performanceProductionPlan(
  document: DirectorDocument,
  assets: DirectorAsset[] = [],
  version = 1,
  localSourceName?: string,
) {
  const source = assets.find((asset) => asset.id === document.performance?.sourceAssetId);
  let start = 0;
  return {
    format: "actbyme-performance-camera-plan",
    schemaVersion: 1,
    version,
    title: document.title,
    duration: directorDuration(document),
    aspectRatio: document.aspectRatio,
    fps: 24,
    disclaimer:
      "Camera framing and timing only. The neutral stand-in does not reproduce the actor's gestures, face, clothing or lip sync. Use the original performance as the acting reference.",
    source: source
      ? {
          id: source.id,
          name: source.name,
          duration: source.duration,
          originalAudio: document.performance?.originalAudio,
        }
      : {
          id: null,
          name: localSourceName ?? null,
          duration: document.performance?.sourceDuration ?? null,
          originalAudio: document.performance?.originalAudio,
        },
    prompt:
      "Use the camera reference video for camera angles, movement and edit timing. Use the original actor performance for gestures, expression, dialogue and identity, subject to the actor's permission. The stand-in is only a framing guide. Additional images and your creative prompt define the intended appearance and environment.",
    shots: document.shots.map((shot, index) => {
      const entry = {
        id: shot.id,
        number: index + 1,
        name: shot.name,
        start,
        end: start + shot.duration,
        duration: shot.duration,
        sourceIn: start,
        sourceOut: start + shot.duration,
        camera: shot.performanceCamera,
        trajectory: syncPerformanceWaypoints(structuredClone(shot)).waypoints,
        transition: "cut",
      };
      start += shot.duration;
      return entry;
    }),
  };
}
