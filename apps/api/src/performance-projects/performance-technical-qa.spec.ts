import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PerformanceQaCheckType, PerformanceQaResultStatus } from "@actbyme/shared";
import { GeminiTranscriptionService } from "./gemini-transcription.service.js";
import { GeminiVisualQaService } from "./gemini-visual-qa.service.js";
import {
  PerformanceTechnicalQaService,
  type TechnicalQaInput,
} from "./performance-technical-qa.service.js";

function setup(context: test.TestContext) {
  const config = new ConfigService();
  const service = new PerformanceTechnicalQaService(
    config,
    new GeminiTranscriptionService(config),
    new GeminiVisualQaService(config),
  );
  const media = service as unknown as {
    probe: () => Promise<unknown>;
    transcribeAudio: () => Promise<{ model: string; text: string }>;
  };
  context.mock.method(media, "probe", async () => ({
    format: { duration: "10", format_name: "mov,mp4" },
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
      { codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "44100" },
    ],
  }));
  const transcription = context.mock.method(media, "transcribeAudio", async () => ({
    model: "gemini-3.5-transcribe",
    text: "",
  }));
  const input: TechnicalQaInput = {
    capturePlan: {},
    file: {
      contentType: "video/quicktime",
      originalFileName: "take.mov",
      signedUrl: "https://example.invalid/private-take",
      sizeBytes: 1000,
    },
    scene: { dialogue: "Bonjour le monde.", duration: "10 seconds" },
  };
  return { service, input, transcription };
}

test("audio without transcribed speech completes QA with a dialogue failure and preserves media checks", async (context) => {
  const { service, input } = setup(context);
  const result = await service.evaluate(input);
  assert.equal(result.checks.length, 5);
  assert.equal(result.transcript, "");
  assert.equal(result.transcriptionModel, "gemini-3.5-transcribe");
  const audio = result.checks.find((check) => check.type === PerformanceQaCheckType.AudioPresence)!;
  assert.equal(audio.result, PerformanceQaResultStatus.Pass);
  assert.equal(audio.measuredValue.hasAudio, true);
  const dialogue = result.checks.find(
    (check) => check.type === PerformanceQaCheckType.DialogueAccuracy,
  )!;
  assert.equal(dialogue.result, PerformanceQaResultStatus.Fail);
  assert.equal(dialogue.measuredValue.wordAccuracyPercent, 0);
  assert.match(dialogue.correctionInstruction!, /No intelligible spoken dialogue was transcribed/);
  assert.ok(
    result.checks
      .filter((check) => check !== dialogue)
      .every((check) => check.result === PerformanceQaResultStatus.Pass),
  );
});

test("QA does not require a transcript when the scene has no dialogue", async (context) => {
  const { service, input, transcription } = setup(context);
  input.scene.dialogue = "";
  const result = await service.evaluate(input);
  assert.equal(transcription.mock.callCount(), 0);
  assert.equal(result.transcript, null);
  assert.equal(result.checks.length, 4);
});

test("transcription outages are not converted into dialogue failures", async (context) => {
  const { service, input, transcription } = setup(context);
  transcription.mock.mockImplementation(async () => {
    throw new ServiceUnavailableException("Provider unavailable");
  });
  await assert.rejects(service.evaluate(input), /Provider unavailable/);
});
