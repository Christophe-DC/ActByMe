import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { GeminiTranscriptionService } from "./gemini-transcription.service.js";

const service = new GeminiTranscriptionService(new ConfigService({ GEMINI_API_KEY: "test-key" }));
const audio = new Uint8Array([1, 2, 3]);

test("transcription reads output_text and does not duplicate step text", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: "  Bonjour le monde.  ",
          steps: [{ type: "model_output", content: [{ type: "text", text: "Bonjour le monde." }] }],
        }),
      ),
  );
  assert.equal((await service.transcribe(audio)).text, "Bonjour le monde.");
});

test("transcription falls back to model output steps when output_text is blank", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          output_text: " ",
          steps: [
            {
              type: "user_input",
              content: [{ type: "text", text: "Do not transcribe this prompt" }],
            },
            { type: "model_output", content: [{ type: "text", text: "Bonjour." }] },
          ],
        }),
      ),
  );
  assert.equal((await service.transcribe(audio)).text, "Bonjour.");
});

test("completed transcription without recognized speech returns an empty transcript", async (context) => {
  for (const payload of [
    { status: "completed", steps: [] },
    { status: "completed", output_text: " " },
    {
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: "" }] }],
    },
  ]) {
    const mockedFetch = context.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(payload)),
    );
    assert.deepEqual(await service.transcribe(audio), { model: "gemini-3.5-transcribe", text: "" });
    mockedFetch.mock.restore();
  }
});

test("incomplete responses and provider failures remain technical errors", async (context) => {
  for (const [payload, status, message] of [
    [{ status: "in_progress" }, 200, /incomplete response/],
    [{ error: { message: "Quota exhausted" } }, 429, /Quota exhausted/],
  ] as const) {
    const mockedFetch = context.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(payload), { status }),
    );
    await assert.rejects(service.transcribe(audio), message);
    mockedFetch.mock.restore();
  }
});
