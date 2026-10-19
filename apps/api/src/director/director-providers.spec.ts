import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createDirectorDocument, createDirectorShot } from "@actbyme/shared";
import {
  configuredDirectorPrice,
  DirectorProviders,
  validateDirectorRequest,
} from "./director-providers.js";
test("documented Veo and Higgsfield contracts, safe polling and cancellation", async () => {
  const nativeFetch = globalThis.fetch,
    calls: { url: string; options?: RequestInit }[] = [],
    requestId = randomUUID();
  const operation = "models/veo-3.1-generate-preview/operations/test_operation";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const address = String(url);
    return new Response(
      JSON.stringify(
        address.endsWith(":predictLongRunning")
          ? { name: operation }
          : address.endsWith(operation)
            ? {
                done: true,
                response: {
                  generateVideoResponse: {
                    generatedSamples: [
                      {
                        video: {
                          uri: "https://generativelanguage.googleapis.com/v1beta/files/test:download",
                        },
                      },
                    ],
                  },
                },
              }
            : address.endsWith("/cancel")
              ? {}
              : address.endsWith("/status")
                ? { status: "completed", video: { url: "https://cdn.higgsfield.ai/result.mp4" } }
                : { request_id: requestId },
      ),
      { status: 200 },
    );
  };
  try {
    const providers = new DirectorProviders(
      new ConfigService({
        DIRECTOR_VEO_API_KEY: "unit-test-veo",
        DIRECTOR_HIGGSFIELD_API_KEY: "unit-test-hf",
      }),
    );
    const document = createDirectorDocument();
    document.shots = [createDirectorShot("dolly-in", "shot", 8)];
    const reference = {
      url: "https://storage.test/short-lived-signed",
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    };
    const signal = AbortSignal.timeout(5000),
      veo = await providers.submit("veo", document, document.shots[0]!, [reference], signal);
    const veoBody = JSON.parse(calls[0]!.options!.body as string);
    assert.equal(veoBody.parameters.durationSeconds, 8);
    assert.equal(veoBody.instances[0].referenceImages[0].image.inlineData.data, "AQID");
    assert.equal(
      (calls[0]!.options!.headers as Record<string, string>)["x-goog-api-key"],
      "unit-test-veo",
    );
    assert.equal((await providers.poll("veo", veo, signal)).done, true);
    assert.equal(await providers.cancel("veo", veo, signal), false);
    const hf = await providers.submit(
      "higgsfield",
      document,
      document.shots[0]!,
      [reference],
      signal,
    );
    const hfBody = JSON.parse(calls.at(-1)!.options!.body as string);
    assert.deepEqual(hfBody.image_urls, [reference.url]);
    assert.equal(hfBody.duration, 8);
    assert.equal(
      (calls.at(-1)!.options!.headers as Record<string, string>).Authorization,
      "Key unit-test-hf",
    );
    assert.equal((await providers.poll("higgsfield", hf, signal)).done, true);
    assert.equal(await providers.cancel("higgsfield", hf, signal), true);
    assert.equal(calls.at(-1)!.options!.method, "POST");
    assert.throws(() => validateDirectorRequest("veo", { id: "https://evil.test/steal" }));
    assert.throws(() => validateDirectorRequest("higgsfield", { id: "../../other" }));
    const before = calls.length;
    await assert.rejects(
      providers.download("veo", "https://attacker.test/file.mp4", signal),
      /Hôte/,
    );
    assert.equal(calls.length, before);
    assert.equal(
      configuredDirectorPrice(new ConfigService({ DIRECTOR_VEO_CENTS_PER_SECOND: "NaN" }), "veo"),
      0,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
test("provider failures remain failures and rate limits are retryable only by the worker policy", async () => {
  const nativeFetch = globalThis.fetch;
  try {
    const provider = new DirectorProviders(new ConfigService());
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    await assert.rejects(
      provider.poll("higgsfield", { id: randomUUID() }, AbortSignal.timeout(5000)),
      (error: Error & { transient?: boolean }) => error.transient === true,
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          done: true,
          response: { generateVideoResponse: { generatedSamples: [] } },
        }),
      );
    await assert.rejects(
      provider.poll(
        "veo",
        { id: "models/veo-3.1-generate-preview/operations/filtered" },
        AbortSignal.timeout(5000),
      ),
      /aucun clip/,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
