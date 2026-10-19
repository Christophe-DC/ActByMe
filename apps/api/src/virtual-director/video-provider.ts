import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { virtualCameraPrompt, type VirtualJobInput } from "@actbyme/shared";

const requestSchema = z.object({
  request_id: z.string().min(1).max(160),
  status_url: z.url(),
  response_url: z.url(),
  cancel_url: z.url(),
});
export type VideoProviderRequest = z.infer<typeof requestSchema>;
export type VideoProviderResult = { status: "WAITING" } | { status: "COMPLETED"; url: string };
export interface VideoProvider {
  submit(
    input: VirtualJobInput,
    referenceUrl: string,
    endUserId: string,
    signal: AbortSignal,
  ): Promise<VideoProviderRequest>;
  poll(request: VideoProviderRequest, signal: AbortSignal): Promise<VideoProviderResult>;
  cancel(request: VideoProviderRequest, signal: AbortSignal): Promise<void>;
}
export const VIDEO_PROVIDER = Symbol("VIDEO_PROVIDER");
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly transient = false,
  ) {
    super(message);
  }
}
export function validatedProviderRequest(value: unknown) {
  const request = requestSchema.parse(value);
  for (const address of [request.status_url, request.response_url, request.cancel_url]) {
    const url = new URL(address);
    if (
      url.origin !== "https://queue.fal.run" ||
      url.username ||
      url.password ||
      !url.pathname.includes(`/requests/${encodeURIComponent(request.request_id)}`)
    )
      throw new ProviderError("The provider returned an invalid request address.");
  }
  return request;
}
export function validatedOutputUrl(address: string) {
  const url = new URL(address);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !(
      url.hostname.endsWith(".fal.media") ||
      url.hostname === "fal.media" ||
      url.hostname === "storage.googleapis.com"
    )
  )
    throw new ProviderError("The provider returned an unsupported media host.");
  return url.href;
}
@Injectable()
export class FalSeedanceProvider implements VideoProvider {
  constructor(private readonly config: ConfigService) {}
  private async request(url: string, method: string, signal: AbortSignal, body?: unknown) {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      redirect: "error",
      headers: {
        Authorization: `Key ${this.config.get("FAL_KEY")}`,
        "Content-Type": "application/json",
        "X-Fal-Store-IO": "0",
        "X-Fal-Request-Start-Timeout": "1800",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new ProviderError(
        `Video provider returned HTTP ${response.status}. ${response.status === 429 ? "Provider quota or rate limit reached." : response.status === 401 || response.status === 403 ? "Check the API key and model access." : "Check the provider dashboard for details."}`,
        response.status === 429 || response.status >= 500,
      );
    return response;
  }
  async submit(
    input: VirtualJobInput,
    referenceUrl: string,
    endUserId: string,
    signal: AbortSignal,
  ) {
    const response = await this.request(`https://queue.fal.run/${input.model}`, "POST", signal, {
      prompt: virtualCameraPrompt(input),
      video_urls: [referenceUrl],
      duration: String(Math.round(input.shot.end - input.shot.start)),
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: false,
      codec: "H264",
      end_user_id: endUserId,
    });
    return validatedProviderRequest(await response.json());
  }
  async poll(value: VideoProviderRequest, signal: AbortSignal): Promise<VideoProviderResult> {
    const request = validatedProviderRequest(value);
    const response = await this.request(request.status_url, "GET", signal);
    const status = z
      .object({
        status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]),
        error: z.unknown().optional(),
      })
      .parse(await response.json());
    if (status.status !== "COMPLETED") return { status: "WAITING" };
    if (status.error)
      throw new ProviderError(
        "The video provider could not generate this shot. Check the request in the provider dashboard.",
      );
    const result = await this.request(request.response_url, "GET", signal);
    const output = z.object({ video: z.object({ url: z.url() }) }).parse(await result.json());
    return { status: "COMPLETED", url: validatedOutputUrl(output.video.url) };
  }
  async cancel(value: VideoProviderRequest, signal: AbortSignal) {
    const request = validatedProviderRequest(value);
    await this.request(request.cancel_url, "PUT", signal);
  }
}
