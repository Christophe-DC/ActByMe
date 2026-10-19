import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { defaultVirtualScene, virtualJobInputSchema } from "@actbyme/shared";
import {
  FalSeedanceProvider,
  ProviderError,
  validatedOutputUrl,
  validatedProviderRequest,
} from "./video-provider.js";
const receipt = {
  request_id: "test-request",
  status_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-request/status",
  response_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-request",
  cancel_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-request/cancel",
};
test("queue receipts and media addresses cannot leak credentials to arbitrary hosts", () => {
  assert.equal(validatedProviderRequest(receipt).request_id, "test-request");
  assert.throws(() =>
    validatedProviderRequest({
      ...receipt,
      status_url: "https://evil.example/requests/test-request/status",
    }),
  );
  assert.throws(() =>
    validatedProviderRequest({
      ...receipt,
      response_url: "http://queue.fal.run/requests/test-request",
    }),
  );
  for (const url of [
    "http://127.0.0.1/video.mp4",
    "https://evil.example/file.mp4",
    "https://fal.media@127.0.0.1/file.mp4",
    "https://storage.googleapis.com:8080/file.mp4",
  ])
    assert.throws(() => validatedOutputUrl(url));
});
test("Seedance adapter uses documented video references and keeps credentials server-side", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  const replies = [
    receipt,
    { status: "IN_PROGRESS" },
    { status: "COMPLETED" },
    { video: { url: "https://v3b.fal.media/generated.mp4" } },
    {},
  ];
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return new Response(JSON.stringify(replies.shift()), { status: 200 });
  }) as typeof fetch;
  try {
    const provider = new FalSeedanceProvider(new ConfigService({ FAL_KEY: "test-server-key" }));
    const scene = defaultVirtualScene("Test staging");
    const input = virtualJobInputSchema.parse({
      scene,
      shot: scene.shots[0],
      instructions: "Test",
      sourceStartSeconds: 0,
      model: "bytedance/seedance-2.0/reference-to-video",
      sourceConsentId: null,
    });
    const result = await provider.submit(
      input,
      "https://private.example/signed",
      "test-owner",
      AbortSignal.timeout(1000),
    );
    const payload = JSON.parse(calls[0]!.init.body as string);
    assert.deepEqual(payload.video_urls, ["https://private.example/signed"]);
    assert.equal(payload.duration, "5");
    assert.equal(payload.generate_audio, false);
    assert.equal(payload.end_user_id, "test-owner");
    assert.deepEqual(await provider.poll(result, AbortSignal.timeout(1000)), { status: "WAITING" });
    assert.deepEqual(await provider.poll(result, AbortSignal.timeout(1000)), {
      status: "COMPLETED",
      url: "https://v3b.fal.media/generated.mp4",
    });
    await provider.cancel(result, AbortSignal.timeout(1000));
    assert.equal(calls.at(-1)!.init.method, "PUT");
    globalThis.fetch = (async () => new Response("{}", { status: 429 })) as typeof fetch;
    await assert.rejects(
      provider.poll(result, AbortSignal.timeout(1000)),
      (error: unknown) => error instanceof ProviderError && error.transient,
    );
  } finally {
    globalThis.fetch = original;
  }
});
