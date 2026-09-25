import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { GeminiDirectorService } from "./gemini-director.service.js";

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
