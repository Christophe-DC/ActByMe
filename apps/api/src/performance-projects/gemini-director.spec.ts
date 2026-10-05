import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { GeminiDirectorService } from "./gemini-director.service.js";
import { GeminiTranscriptionService } from "./gemini-transcription.service.js";
import { GeminiVisualQaService } from "./gemini-visual-qa.service.js";

test("Gemini Director uses the stable Interactions API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        id: "interaction-1",
        model: "gemini-3.5-flash",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: '{"ok":true}' }],
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const config = new ConfigService({
      GEMINI_API_KEY: "test-key",
      GEMINI_DIRECTOR_MODEL: "gemini-3.5-flash",
    });
    const service = new GeminiDirectorService(config);
    const result = await service.generate({
      input: "Generate a test payload.",
      instructions: "Return JSON.",
      schema: { type: "object" },
      schemaName: "test_payload",
    });

    assert.equal(requestedUrl, "https://generativelanguage.googleapis.com/v1/interactions");
    assert.equal(result.outputText, '{"ok":true}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Gemini transcription wraps audio content in a user_input step", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        id: "interaction-audio",
        model: "gemini-3.8-flash",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const service = new GeminiTranscriptionService(
      new ConfigService({
        GEMINI_API_KEY: "test-key",
        GEMINI_TRANSCRIPTION_MODEL: "gemini-3.8-flash",
      }),
    );
    const result = await service.transcribe(new Uint8Array([1, 2, 3]), "English");
    const input = requestBody?.input as Array<{
      type?: string;
      content?: Array<{ type?: string; mime_type?: string }>;
    }>;

    assert.equal(input[0]?.type, "user_input");
    assert.equal(input[0]?.content?.[0]?.type, "text");
    assert.equal(input[0]?.content?.[1]?.type, "audio");
    assert.equal(input[0]?.content?.[1]?.mime_type, "audio/mp3");
    assert.equal(result.text, "Hello world");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini visual QA wraps images in a user_input step", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  const criterion = { result: "PASS", observation: "Matches", correction: "" };
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        id: "interaction-image",
        model: "gemini-3.8-flash",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  summary: "All visible requirements match.",
                  framing: criterion,
                  subjectPosition: criterion,
                  eyeline: criterion,
                  backgroundLighting: criterion,
                  movementGesture: criterion,
                }),
              },
            ],
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const service = new GeminiVisualQaService(
      new ConfigService({
        GEMINI_API_KEY: "test-key",
        GEMINI_VISUAL_QA_MODEL: "gemini-3.8-flash",
      }),
    );
    await service.evaluate([new Uint8Array([1, 2, 3])], { framing: "Medium shot" });
    const input = requestBody?.input as Array<{
      type?: string;
      content?: Array<{ type?: string; mime_type?: string }>;
    }>;

    assert.equal(input[0]?.type, "user_input");
    assert.equal(input[0]?.content?.[0]?.type, "text");
    assert.equal(input[0]?.content?.[1]?.type, "image");
    assert.equal(input[0]?.content?.[1]?.mime_type, "image/jpeg");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
