/** Versioned, device-local motion samples. Never included in normal project autosaves. */
export const performanceMotionVersion = "mediapipe-1.1.1-heavy-v1";
export const motionStride = 379;
export const motionOffsets = {
  body: 0,
  image: 132,
  leftHand: 198,
  rightHand: 282,
  head: 366,
  face: 375,
  jaw: 376,
  blinkLeft: 377,
  blinkRight: 378,
} as const;
export type PerformanceMotion = {
  version: typeof performanceMotionVersion;
  sourceHash: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  times: Float32Array;
  samples: Float32Array;
  coverage: { body: number; hands: number; face: number; legs: number };
};
export function isPerformanceMotion(value: unknown): value is PerformanceMotion {
  const track = value as PerformanceMotion | null;
  return Boolean(
    track &&
    track.version === performanceMotionVersion &&
    /^[a-f0-9]{64}$/.test(track.sourceHash) &&
    Number.isFinite(track.duration) &&
    track.duration >= 0.5 &&
    track.duration <= 120 &&
    track.fps === 24 &&
    Number.isInteger(track.width) &&
    Number.isInteger(track.height) &&
    track.width > 0 &&
    track.height > 0 &&
    track.width <= 8192 &&
    track.height <= 8192 &&
    track.times instanceof Float32Array &&
    track.samples instanceof Float32Array &&
    track.times.length === Math.ceil(track.duration * 24) + 1 &&
    Math.abs(track.times[0]!) < 0.001 &&
    Math.abs(track.times[track.times.length - 1]! - track.duration) < 0.001 &&
    track.times.length <= 2881 &&
    track.samples.length === track.times.length * motionStride &&
    track.times.every(
      (time, index) =>
        Number.isFinite(time) &&
        time >= 0 &&
        time <= track.duration + 0.001 &&
        (!index || time > track.times[index - 1]!),
    ) &&
    track.samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) < 100) &&
    track.coverage &&
    Object.values(track.coverage).length === 4 &&
    Object.values(track.coverage).every(
      (ratio) => Number.isFinite(ratio) && ratio >= 0 && ratio <= 1,
    ),
  );
}
export function samplePerformanceMotion(
  track: PerformanceMotion,
  time: number,
  result = new Float32Array(motionStride),
) {
  let lower = 0,
    upper = track.times.length - 1;
  const at = Math.max(0, Math.min(track.duration, time));
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1;
    if (track.times[middle]! > at) upper = middle;
    else lower = middle;
  }
  const mix = Math.max(
    0,
    Math.min(1, (at - track.times[lower]!) / (track.times[upper]! - track.times[lower]!)),
  );
  for (let index = 0; index < motionStride; index++)
    result[index] =
      track.samples[lower * motionStride + index]! * (1 - mix) +
      track.samples[upper * motionStride + index]! * mix;
  return result;
}
/** Symmetric, velocity-adaptive smoothing: no phase shift; confidence/gaps are kept explicit. */
export function smoothPerformanceMotion(track: PerformanceMotion) {
  const raw = track.samples.slice();
  const channels: { offset: number; dimensions: number; confidence: number }[] = [];
  for (const [offset, count] of [
    [0, 33],
    [198, 21],
    [282, 21],
  ] as const)
    for (let point = 0; point < count; point++)
      channels.push({
        offset: offset + point * 4,
        dimensions: 3,
        confidence: offset + point * 4 + 3,
      });
  for (let point = 0; point < 33; point++)
    channels.push({ offset: 132 + point * 2, dimensions: 2, confidence: point * 4 + 3 });
  channels.push(
    { offset: 366, dimensions: 9, confidence: 375 },
    { offset: 376, dimensions: 3, confidence: 375 },
  );
  // Bridge only short, bounded dropouts. Do not invent motion for hidden body parts.
  for (const channel of channels) {
    let previous = -1;
    for (let next = 0; next < track.times.length; next++) {
      if (track.samples[next * motionStride + channel.confidence]! < 0.45) continue;
      if (
        previous >= 0 &&
        next > previous + 1 &&
        track.times[next]! - track.times[previous]! <= 0.25
      ) {
        const start = previous * motionStride,
          end = next * motionStride;
        for (let gap = previous + 1; gap < next; gap++) {
          const mix =
            (track.times[gap]! - track.times[previous]!) /
            (track.times[next]! - track.times[previous]!);
          for (let axis = 0; axis < channel.dimensions; axis++)
            raw[gap * motionStride + channel.offset + axis] =
              raw[start + channel.offset + axis]! * (1 - mix) +
              raw[end + channel.offset + axis]! * mix;
          raw[gap * motionStride + channel.confidence] =
            Math.min(raw[start + channel.confidence]!, raw[end + channel.confidence]!) * 0.9;
        }
      }
      previous = next;
    }
  }
  const samples = raw.slice();
  for (let frame = 0; frame < track.times.length; frame++)
    for (const channel of channels) {
      const base = frame * motionStride;
      if (raw[base + channel.confidence]! < 0.45) continue;
      const before = Math.max(0, frame - 1) * motionStride,
        after = Math.min(track.times.length - 1, frame + 1) * motionStride;
      let speed = 0;
      for (let axis = 0; axis < Math.min(3, channel.dimensions); axis++)
        speed += (raw[after + channel.offset + axis]! - raw[before + channel.offset + axis]!) ** 2;
      const sideWeight = 0.24 / (1 + Math.sqrt(speed) * 15);
      for (let axis = 0; axis < channel.dimensions; axis++) {
        let sum = raw[base + channel.offset + axis]!,
          weight = 1;
        for (const neighbour of [before, after])
          if (raw[neighbour + channel.confidence]! >= 0.45) {
            sum += raw[neighbour + channel.offset + axis]! * sideWeight;
            weight += sideWeight;
          }
        samples[base + channel.offset + axis] = sum / weight;
      }
    }
  return { ...track, samples };
}
export function performanceMotionSummary(track: PerformanceMotion | null) {
  return track
    ? {
        mode: "estimated-motion",
        engine: track.version,
        sourceSha256: track.sourceHash,
        frames: track.times.length,
        fps: track.fps,
        coverage: track.coverage,
        limitations:
          "Single-camera estimate. Hidden or untracked parts stay neutral. Depth, fingers and facial expression are approximate; compare with the original performance.",
      }
    : {
        mode: "camera-only",
        limitations: "No movement has been transferred. The neutral figure is fixed.",
      };
}
