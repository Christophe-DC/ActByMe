import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PerformanceQaCheckType, PerformanceQaResultStatus } from "@actbyme/shared";
import { OpenAiTranscriptionService } from "./openai-transcription.service.js";

const DIALOGUE_PASS_THRESHOLD = 0.85;

type QaJson = Record<string, boolean | number | string | null | string[]>;

export type TechnicalQaCheck = {
  correctionInstruction: string | null;
  measuredValue: QaJson;
  requiredValue: QaJson | null;
  result: PerformanceQaResultStatus;
  type: PerformanceQaCheckType;
};

export type TechnicalQaInput = {
  capturePlan: unknown;
  file: {
    contentType: string;
    originalFileName: string;
    signedUrl: string;
    sizeBytes: number;
  };
  language?: string | null;
  scene: {
    captureRequirements?: string | null;
    dialogue?: string | null;
    duration?: string | null;
    framing?: string | null;
  };
};

type ProbeStream = {
  channels?: number;
  codec_long_name?: string;
  codec_name?: string;
  codec_type?: string;
  duration?: string;
  height?: number;
  sample_rate?: string;
  side_data_list?: Array<{ rotation?: number }>;
  tags?: { rotate?: string };
  width?: number;
};

type ProbeResult = {
  format?: {
    duration?: string;
    format_long_name?: string;
    format_name?: string;
  };
  streams?: ProbeStream[];
};

@Injectable()
export class PerformanceTechnicalQaService {
  constructor(
    private readonly config: ConfigService,
    private readonly transcription: OpenAiTranscriptionService,
  ) {}

  async evaluate(input: TechnicalQaInput) {
    const probe = await this.probe(input.file.signedUrl);
    const capturePlan = asRecord(input.capturePlan);
    const video = probe?.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe?.streams?.find((stream) => stream.codec_type === "audio");
    const durationSeconds = finiteNumber(probe?.format?.duration) ?? finiteNumber(video?.duration);
    const dimensions = displayDimensions(video);
    const formatRequirement = stringValue(capturePlan.fileFormat);
    const framingRequirement = [
      input.scene.captureRequirements,
      input.scene.framing,
      stringValue(capturePlan.framing),
      stringValue(capturePlan.camera),
    ]
      .filter(Boolean)
      .join("\n");
    const audioRequirement = [input.scene.captureRequirements, stringValue(capturePlan.audio)]
      .filter(Boolean)
      .join("\n");

    const checks: TechnicalQaCheck[] = [
      fileCodecCheck(input.file, probe, video, formatRequirement),
      durationCheck(durationSeconds, input.scene.duration),
      resolutionOrientationCheck(dimensions, framingRequirement),
      audioPresenceCheck(Boolean(audio), audio, audioRequirement, input.scene.dialogue),
    ];

    let transcript: string | null = null;
    let transcriptionModel: string | null = null;
    const expectedDialogue = input.scene.dialogue?.trim() ?? "";
    if (expectedDialogue) {
      if (!audio) {
        checks.push(dialogueCheck(expectedDialogue, ""));
      } else {
        const transcribed = await this.transcribeAudio(input.file.signedUrl, input.language);
        transcript = transcribed.text;
        transcriptionModel = transcribed.model;
        checks.push(dialogueCheck(expectedDialogue, transcript));
      }
    }

    return { checks, transcript, transcriptionModel };
  }

  private async probe(signedUrl: string): Promise<ProbeResult | null> {
    const binary = this.config.get<string>("FFPROBE_PATH")?.trim() || "ffprobe";
    try {
      const { stdout } = await runBinary(
        binary,
        ["-v", "error", "-show_format", "-show_streams", "-print_format", "json", signedUrl],
        120_000,
      );
      return JSON.parse(stdout) as ProbeResult;
    } catch (error) {
      if (isMissingBinary(error)) {
        throw new ServiceUnavailableException(
          "Technical QA requires ffprobe. Install it or configure FFPROBE_PATH.",
        );
      }
      if (isTimedOut(error)) {
        throw new ServiceUnavailableException("Video metadata inspection timed out.");
      }
      return null;
    }
  }

  private async transcribeAudio(signedUrl: string, language?: string | null) {
    const directory = await mkdtemp(join(tmpdir(), "actbyme-qa-"));
    const audioPath = join(directory, "take-audio.mp3");
    const binary = this.config.get<string>("FFMPEG_PATH")?.trim() || "ffmpeg";

    try {
      await runBinary(
        binary,
        [
          "-v",
          "error",
          "-nostdin",
          "-i",
          signedUrl,
          "-map",
          "0:a:0",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-b:a",
          "64k",
          "-f",
          "mp3",
          audioPath,
        ],
        300_000,
      );
      return await this.transcription.transcribe(await readFile(audioPath), language);
    } catch (error) {
      if (isMissingBinary(error)) {
        throw new ServiceUnavailableException(
          "Dialogue QA requires ffmpeg. Install it or configure FFMPEG_PATH.",
        );
      }
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        "The take audio could not be prepared for transcription.",
      );
    } finally {
      await rm(directory, { force: true, recursive: true }).catch(() => undefined);
    }
  }
}

function fileCodecCheck(
  file: TechnicalQaInput["file"],
  probe: ProbeResult | null,
  video: ProbeStream | undefined,
  requirement: string,
): TechnicalQaCheck {
  const extension = file.originalFileName.toLowerCase().endsWith(".mov")
    ? "MOV"
    : file.originalFileName.toLowerCase().endsWith(".mp4")
      ? "MP4"
      : "UNKNOWN";
  const formatNames = probe?.format?.format_name?.split(",") ?? [];
  const validContainer = formatNames.some((name) => ["mov", "mp4"].includes(name));
  const requiredContainers = parseRequiredContainers(requirement);
  const requiredCodecs = parseRequiredCodecs(requirement);
  const codec = video?.codec_name?.toLowerCase() ?? null;
  const containerMatches = !requiredContainers.length || requiredContainers.includes(extension);
  const codecMatches = !requiredCodecs.length || Boolean(codec && requiredCodecs.includes(codec));
  const passed = Boolean(
    probe && validContainer && video && codec && containerMatches && codecMatches,
  );

  return {
    correctionInstruction: passed
      ? null
      : !probe || !video || !codec
        ? "Re-export and upload a readable MP4 or MOV file with a valid video stream."
        : `Re-export the take to match the approved format${
            requiredContainers.length ? ` (${requiredContainers.join(" or ")})` : ""
          }${requiredCodecs.length ? ` and codec (${requiredCodecs.join(" or ")})` : ""}.`,
    measuredValue: {
      codec,
      codecDescription: video?.codec_long_name ?? null,
      container: probe?.format?.format_long_name ?? null,
      declaredContentType: file.contentType,
      extension,
      probeReadable: Boolean(probe),
      sizeBytes: file.sizeBytes,
    },
    requiredValue: {
      approvedRequirement: requirement || null,
      allowedContainers: requiredContainers.length ? requiredContainers : ["MP4", "MOV"],
      requiredCodecs,
    },
    result: passed ? PerformanceQaResultStatus.Pass : PerformanceQaResultStatus.Fail,
    type: PerformanceQaCheckType.FileCodec,
  };
}

function durationCheck(
  actualSeconds: number | null,
  requirement?: string | null,
): TechnicalQaCheck {
  const expected = parseDurationRequirement(requirement ?? "");
  const passed =
    actualSeconds !== null &&
    (!expected || (actualSeconds >= expected.minimum && actualSeconds <= expected.maximum));

  return {
    correctionInstruction: passed
      ? null
      : actualSeconds === null
        ? "Upload a readable video with valid duration metadata."
        : `Trim or re-record the take to ${formatSeconds(expected?.minimum)}–${formatSeconds(
            expected?.maximum,
          )} seconds, matching the approved scene timing.`,
    measuredValue: { durationSeconds: round(actualSeconds) },
    requiredValue: expected
      ? {
          approvedRequirement: requirement ?? null,
          maximumSeconds: round(expected.maximum),
          minimumSeconds: round(expected.minimum),
        }
      : { approvedRequirement: requirement || null, minimumSeconds: 0.01 },
    result: passed ? PerformanceQaResultStatus.Pass : PerformanceQaResultStatus.Fail,
    type: PerformanceQaCheckType.Duration,
  };
}

function resolutionOrientationCheck(
  dimensions: ReturnType<typeof displayDimensions>,
  requirement: string,
): TechnicalQaCheck {
  const requiredOrientation = parseOrientation(requirement);
  const requiredResolution = parseResolution(requirement, requiredOrientation);
  const resolutionMatches =
    !requiredResolution ||
    Boolean(
      dimensions &&
      (requiredResolution.axisIndependent
        ? Math.max(dimensions.width, dimensions.height) >=
            Math.max(requiredResolution.minimumWidth, requiredResolution.minimumHeight) &&
          Math.min(dimensions.width, dimensions.height) >=
            Math.min(requiredResolution.minimumWidth, requiredResolution.minimumHeight)
        : dimensions.width >= requiredResolution.minimumWidth &&
          dimensions.height >= requiredResolution.minimumHeight),
    );
  const orientationMatches =
    !requiredOrientation || dimensions?.orientation === requiredOrientation;
  const passed = Boolean(dimensions && resolutionMatches && orientationMatches);

  return {
    correctionInstruction: passed
      ? null
      : !dimensions
        ? "Upload a video with a readable video stream and resolution metadata."
        : `Re-record or export in${requiredOrientation ? ` ${requiredOrientation}` : " the approved"} orientation${
            requiredResolution
              ? ` at a minimum of ${requiredResolution.minimumWidth}×${requiredResolution.minimumHeight}`
              : ""
          } without stretching the image.`,
    measuredValue: {
      height: dimensions?.height ?? null,
      orientation: dimensions?.orientation ?? null,
      rotationDegrees: dimensions?.rotation ?? null,
      width: dimensions?.width ?? null,
    },
    requiredValue: {
      approvedRequirement: requirement || null,
      minimumHeight: requiredResolution?.minimumHeight ?? null,
      minimumWidth: requiredResolution?.minimumWidth ?? null,
      orientation: requiredOrientation,
    },
    result: passed ? PerformanceQaResultStatus.Pass : PerformanceQaResultStatus.Fail,
    type: PerformanceQaCheckType.ResolutionOrientation,
  };
}

function audioPresenceCheck(
  hasAudio: boolean,
  audio: ProbeStream | undefined,
  requirement: string,
  dialogue?: string | null,
): TechnicalQaCheck {
  const explicitlySilent =
    /\b(no audio|without audio|audio off|muted? audio|silent (?:video|take|capture))\b/i.test(
      requirement,
    );
  const required = Boolean(dialogue?.trim()) || !explicitlySilent;
  const passed = hasAudio === required;

  return {
    correctionInstruction: passed
      ? null
      : required
        ? "Re-record with an audible audio track and verify the microphone before uploading."
        : "Remove the audio track to match the approved silent capture requirement.",
    measuredValue: {
      channels: audio?.channels ?? null,
      codec: audio?.codec_name ?? null,
      hasAudio,
      sampleRateHz: finiteNumber(audio?.sample_rate),
    },
    requiredValue: { approvedRequirement: requirement || null, hasAudio: required },
    result: passed ? PerformanceQaResultStatus.Pass : PerformanceQaResultStatus.Fail,
    type: PerformanceQaCheckType.AudioPresence,
  };
}

function dialogueCheck(expected: string, transcript: string): TechnicalQaCheck {
  const expectedWords = normalizeWords(expected);
  const transcriptWords = normalizeWords(transcript);
  const accuracy = wordAccuracy(expectedWords, transcriptWords);
  const passed = accuracy >= DIALOGUE_PASS_THRESHOLD;
  const missingWords = focusedMissingWords(expectedWords, transcriptWords);

  return {
    correctionInstruction: passed
      ? null
      : `Re-record and match the approved dialogue more closely${
          missingWords.length ? `, especially: “${missingWords.join(" ")}”` : ""
        }. Speak clearly and avoid adding or omitting words.`,
    measuredValue: {
      transcript,
      wordAccuracy: round(accuracy),
      wordAccuracyPercent: Math.round(accuracy * 100),
    },
    requiredValue: {
      dialogue: expected,
      minimumWordAccuracy: DIALOGUE_PASS_THRESHOLD,
      minimumWordAccuracyPercent: DIALOGUE_PASS_THRESHOLD * 100,
    },
    result: passed ? PerformanceQaResultStatus.Pass : PerformanceQaResultStatus.Fail,
    type: PerformanceQaCheckType.DialogueAccuracy,
  };
}

function displayDimensions(video?: ProbeStream) {
  if (!video?.width || !video.height) return null;
  const sideDataRotation = video.side_data_list?.find(
    (item) => item.rotation !== undefined,
  )?.rotation;
  const rotation = finiteNumber(video.tags?.rotate) ?? finiteNumber(sideDataRotation) ?? 0;
  const swapsAxes = Math.abs(rotation) % 180 === 90;
  const width = swapsAxes ? video.height : video.width;
  const height = swapsAxes ? video.width : video.height;
  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
  return { height, orientation, rotation, width };
}

function parseDurationRequirement(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, ".");
  const range = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/,
  );
  if (range) {
    const multiplier = /^(?:minutes?|mins?|m)$/.test(range[3] ?? "") ? 60 : 1;
    const first = Number(range[1]) * multiplier;
    const second = Number(range[2]) * multiplier;
    return { maximum: Math.max(first, second), minimum: Math.min(first, second) };
  }

  const timecode = normalized.match(/\b(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)\b/);
  const seconds = timecode
    ? Number(timecode[1] ?? 0) * 3600 + Number(timecode[2]) * 60 + Number(timecode[3])
    : parseDurationNumber(normalized);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const tolerance = Math.max(1, seconds * 0.1);
  return { maximum: seconds + tolerance, minimum: Math.max(0.01, seconds - tolerance) };
}

function parseDurationNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/);
  if (!match) return Number.NaN;
  const multiplier = /^(?:minutes?|mins?|m)$/.test(match[2] ?? "") ? 60 : 1;
  return Number(match[1]) * multiplier;
}

function parseOrientation(value: string): "landscape" | "portrait" | "square" | null {
  if (/\b(portrait|vertical|9\s*:\s*16)\b/i.test(value)) return "portrait";
  if (/\b(landscape|horizontal|16\s*:\s*9)\b/i.test(value)) return "landscape";
  if (/\b(square|1\s*:\s*1)\b/i.test(value)) return "square";
  return null;
}

function parseResolution(
  value: string,
  orientation: ReturnType<typeof parseOrientation>,
): { axisIndependent: boolean; minimumHeight: number; minimumWidth: number } | null {
  const dimensions = value.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i);
  let width: number | null = dimensions ? Number(dimensions[1]) : null;
  let height: number | null = dimensions ? Number(dimensions[2]) : null;

  if (!width || !height) {
    const named =
      value.match(/\b(720|1080|2160)p\b/i)?.[1] ?? (/\b(?:uhd|4k)\b/i.test(value) ? "2160" : null);
    if (!named) return null;
    const shortSide = Number(named);
    const longSide = shortSide === 2160 ? 3840 : Math.round((shortSide * 16) / 9);
    width = orientation === "portrait" ? shortSide : longSide;
    height = orientation === "portrait" ? longSide : shortSide;
  }

  if (orientation === "portrait" && width > height) [width, height] = [height, width];
  if (orientation === "landscape" && height > width) [width, height] = [height, width];
  return { axisIndependent: !orientation, minimumHeight: height, minimumWidth: width };
}

function parseRequiredContainers(value: string) {
  const containers: string[] = [];
  if (/\bmp4\b/i.test(value)) containers.push("MP4");
  if (/\bmov\b|quicktime/i.test(value)) containers.push("MOV");
  return containers;
}

function parseRequiredCodecs(value: string) {
  const codecs: string[] = [];
  if (/\bh\.?\s*264\b|\bavc\b/i.test(value)) codecs.push("h264");
  if (/\bh\.?\s*265\b|\bhevc\b/i.test(value)) codecs.push("hevc");
  if (/\bprores\b/i.test(value)) codecs.push("prores");
  if (/\bvp9\b/i.test(value)) codecs.push("vp9");
  if (/\bav1\b/i.test(value)) codecs.push("av1");
  return codecs;
}

function normalizeWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordAccuracy(expected: string[], actual: string[]) {
  if (!expected.length) return actual.length ? 0 : 1;
  const previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
    const current = [expectedIndex];
    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      current[actualIndex] = Math.min(
        (current[actualIndex - 1] ?? 0) + 1,
        (previous[actualIndex] ?? 0) + 1,
        (previous[actualIndex - 1] ?? 0) +
          (expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  const distance = previous[actual.length] ?? Math.max(expected.length, actual.length);
  return Math.max(0, 1 - distance / Math.max(expected.length, actual.length, 1));
}

function focusedMissingWords(expected: string[], actual: string[]) {
  const available = new Map<string, number>();
  actual.forEach((word) => available.set(word, (available.get(word) ?? 0) + 1));
  return expected
    .filter((word) => {
      const count = available.get(word) ?? 0;
      if (!count) return true;
      available.set(word, count - 1);
      return false;
    })
    .slice(0, 8);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null | undefined) {
  return value === null || value === undefined ? null : Math.round(value * 1000) / 1000;
}

function formatSeconds(value: number | undefined) {
  return value === undefined ? "the required" : String(round(value));
}

function runBinary(binary: string, args: string[], timeout: number) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    execFile(
      binary,
      args,
      { encoding: "utf8", maxBuffer: 10_000_000, timeout },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stderr, stdout });
      },
    );
  });
}

function isMissingBinary(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isTimedOut(error: unknown) {
  return typeof error === "object" && error !== null && "killed" in error && error.killed === true;
}
