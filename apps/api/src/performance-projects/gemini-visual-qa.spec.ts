import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { GeminiVisualQaService } from "./gemini-visual-qa.service.js";

const frames = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
const criterion = { result: "PASS", observation: "Matches", correction: "" };
const result = {
  summary: "All visible requirements match.",
  framing: criterion,
  subjectPosition: criterion,
  eyeline: criterion,
  backgroundLighting: criterion,
  movementGesture: criterion,
};
function service(configuration = {}) {
  return new GeminiVisualQaService(
    new ConfigService({ GEMINI_API_KEY: "test-key", ...configuration }),
  );
}
function success(model: string) {
  return new Response(
    JSON.stringify({ status: "completed", model, output_text: JSON.stringify(result) }),
  );
}

test("visual QA switches from an overloaded model and keeps the same images, instructions and schema", async (context) => {
  const requests: Record<string, unknown>[] = [];
  context.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push(body);
    if (requests.length === 1)
      return new Response(
        JSON.stringify({
          error: { message: "gemini-3.8-flash is currently experiencing high demand" },
        }),
        { status: 503 },
      );
    return success(body.model);
  });
  const evaluated = await service().evaluate(frames, { framing: "Medium shot" });
  assert.deepEqual(
    requests.map((request) => request.model),
    ["gemini-3.8-flash", "gemini-3.5-flash"],
  );
  const { model: primary, ...first } = requests[0]!;
  const { model: fallback, ...second } = requests[1]!;
  assert.notEqual(primary, fallback);
  assert.deepEqual(first, second);
  assert.equal(evaluated.model, "gemini-3.5-flash");
  assert.deepEqual(evaluated.result, result);
});

test("visual QA falls back on rate limits, missing models and transport timeouts", async (context) => {
  for (const status of [429, 404, 500, 502, 504, 408, "timeout"] as const) {
    let attempts = 0;
    const mockedFetch = context.mock.method(
      globalThis,
      "fetch",
      async (_input: unknown, init: RequestInit) => {
        attempts += 1;
        if (attempts === 1) {
          if (status === "timeout") throw new DOMException("Timed out", "TimeoutError");
          return new Response(JSON.stringify({ error: { message: "Unavailable" } }), { status });
        }
        return success(JSON.parse(String(init.body)).model);
      },
    );
    assert.equal((await service().evaluate(frames, {})).model, "gemini-3.5-flash");
    assert.equal(attempts, 2);
    mockedFetch.mock.restore();
  }
});

test("configured visual fallbacks are trimmed and deduplicated", async (context) => {
  const models: string[] = [];
  context.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model;
    models.push(model);
    return models.length < 3 ? new Response("{}", { status: 503 }) : success(model);
  });
  await service({
    GEMINI_VISUAL_QA_FALLBACK_MODELS:
      " gemini-3.8-flash, gemini-3.5-flash, gemini-3.5-flash, gemini-3.5-flash-lite ",
  }).evaluate(frames, {});
  assert.deepEqual(models, ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]);
});

test("exhausting all models returns a retryable technical error without approving the take", async (context) => {
  const mockedFetch = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 503 }),
  );
  await assert.rejects(
    service().evaluate(frames, {}),
    /all configured Gemini models are unavailable/,
  );
  assert.equal(mockedFetch.mock.callCount(), 5);
});

test("invalid credentials and requests do not trigger model fallback", async (context) => {
  for (const status of [400, 401, 403]) {
    const mockedFetch = context.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { message: "Quota exhausted" } }), { status }),
    );
    await assert.rejects(service().evaluate(frames, {}), /Check the API configuration/);
    assert.equal(mockedFetch.mock.callCount(), 1);
    mockedFetch.mock.restore();
  }
});

test("fallback responses still require completed and valid visual criteria", async (context) => {
  for (const payload of [
    { status: "failed" },
    { status: "completed", output_text: '{"summary":"incomplete"}' },
  ]) {
    let attempts = 0;
    const mockedFetch = context.mock.method(globalThis, "fetch", async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify(payload));
    });
    await assert.rejects(
      service().evaluate(frames, {}),
      /incomplete response|invalid structured result/,
    );
    mockedFetch.mock.restore();
  }
});

test("model-specific quota exhaustion still tries another model", async (context) => {
  let attempts = 0;
  context.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    attempts += 1;
    return attempts === 1
      ? new Response(JSON.stringify({ error: { message: "Model quota exhausted" } }), {
          status: 429,
        })
      : success(JSON.parse(String(init.body)).model);
  });
  assert.equal((await service().evaluate(frames, {})).model, "gemini-3.5-flash");
});

test("exhausted quotas across all models produce an actionable technical error", async (context) => {
  const mockedFetch = context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ error: { message: "Quota exhausted" } }), { status: 429 }),
  );
  await assert.rejects(
    service().evaluate(frames, {}),
    /quota exhaustion and no configured model was available/,
  );
  assert.equal(mockedFetch.mock.callCount(), 5);
});
