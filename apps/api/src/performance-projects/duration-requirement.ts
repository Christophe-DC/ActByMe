export type DurationRequirement = {
  maximum: number;
  minimum: number;
};

const DURATION_RANGE =
  /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/i;
const DURATION_NUMBER = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/i;
const TIMECODE = /\b(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)\b/g;

export function normalizeDurationRequirement(value: string): string {
  const normalized = value.trim().replace(/,/g, ".");
  const range = normalized.match(DURATION_RANGE);
  if (range) {
    const multiplier = durationMultiplier(range[3]);
    const first = Number(range[1]) * multiplier;
    const second = Number(range[2]) * multiplier;
    return `${formatDurationSeconds(Math.min(first, second))}–${formatDurationSeconds(
      Math.max(first, second),
    )} seconds`;
  }

  const timecodes = timecodeSeconds(normalized);
  if (timecodes.length) {
    return `${formatDurationSeconds(Math.max(...timecodes))} seconds`;
  }

  const duration = normalized.match(DURATION_NUMBER);
  if (duration) {
    return `${formatDurationSeconds(Number(duration[1]) * durationMultiplier(duration[2]))} seconds`;
  }

  return value.trim();
}

export function parseDurationRequirement(value: string): DurationRequirement | null {
  const normalized = value.toLowerCase().replace(/,/g, ".");
  const range = normalized.match(DURATION_RANGE);
  if (range) {
    const multiplier = durationMultiplier(range[3]);
    const first = Number(range[1]) * multiplier;
    const second = Number(range[2]) * multiplier;
    return { maximum: Math.max(first, second), minimum: Math.min(first, second) };
  }

  const timecodes = timecodeSeconds(normalized);
  const seconds = timecodes.length ? Math.max(...timecodes) : durationNumberSeconds(normalized);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const tolerance = Math.max(1, seconds * 0.1);
  return { maximum: seconds + tolerance, minimum: Math.max(0.01, seconds - tolerance) };
}

function durationNumberSeconds(value: string) {
  const match = value.match(DURATION_NUMBER);
  if (!match) return Number.NaN;
  return Number(match[1]) * durationMultiplier(match[2]);
}

function durationMultiplier(unit: string | undefined) {
  return /^(?:minutes?|mins?|m)$/i.test(unit ?? "") ? 60 : 1;
}

function formatDurationSeconds(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

function timecodeSeconds(value: string) {
  return [...value.matchAll(TIMECODE)].map(
    (match) => Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]),
  );
}
