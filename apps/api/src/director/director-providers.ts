import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import {
  directorPrompt,
  type DirectorDocument,
  type DirectorShot,
  type DirectorProviderId,
} from "@actbyme/shared";

export type DirectorProviderReference = { url: string; contentType: string; bytes?: Uint8Array };
export type DirectorProviderRequest = { id: string };
export type DirectorPoll = { done: false } | { done: true; url: string };
export class DirectorProviderError extends Error {
  constructor(
    message: string,
    readonly transient = false,
  ) {
    super(message);
  }
}
export function configuredDirectorPrice(config: ConfigService, id: DirectorProviderId) {
  const value = Number(
    config.get(
      id === "veo" ? "DIRECTOR_VEO_CENTS_PER_SECOND" : "DIRECTOR_HIGGSFIELD_CENTS_PER_SECOND",
      "0",
    ),
  );
  return Number.isFinite(value) && value > 0 && value <= 10000 ? value : 0;
}
export const directorProviderModels = {
  veo: "veo-3.1-generate-preview",
  higgsfield: "bytedance/seedance-2.0/reference-to-video",
} as const;
export function validateDirectorRequest(
  provider: DirectorProviderId,
  value: unknown,
): DirectorProviderRequest {
  const request = z
    .object({ id: z.string().max(240) })
    .strict()
    .parse(value);
  if (
    provider === "veo"
      ? !/^models\/veo-3\.1-generate-preview\/operations\/[a-zA-Z0-9_-]+$/.test(request.id)
      : !z.uuid().safeParse(request.id).success
  )
    throw new DirectorProviderError("Invalid provider request identifier.");
  return request;
}
@Injectable()
export class DirectorProviders {
  constructor(private readonly config: ConfigService) {}
  configured(id: DirectorProviderId) {
    return Boolean(
      this.config.get(id === "veo" ? "DIRECTOR_VEO_API_KEY" : "DIRECTOR_HIGGSFIELD_API_KEY"),
    );
  }
  private async request(
    provider: DirectorProviderId,
    path: string,
    method: string,
    signal: AbortSignal,
    body?: unknown,
  ) {
    const base =
      provider === "veo"
        ? "https://generativelanguage.googleapis.com/v1beta/"
        : "https://api.higgsfield.ai/";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "veo") headers["x-goog-api-key"] = this.config.get("DIRECTOR_VEO_API_KEY", "");
    else headers.Authorization = `Key ${this.config.get("DIRECTOR_HIGGSFIELD_API_KEY", "")}`;
    const response = await fetch(base + path, {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new DirectorProviderError(
        `Le fournisseur a répondu HTTP ${response.status}. Vérifiez les accès, quotas et le tableau de bord fournisseur.`,
        response.status === 429 || response.status >= 500,
      );
    return response.json();
  }
  async submit(
    provider: DirectorProviderId,
    document: DirectorDocument,
    shot: DirectorShot,
    references: DirectorProviderReference[],
    signal: AbortSignal,
  ): Promise<DirectorProviderRequest> {
    const prompt = directorPrompt(document, shot);
    if (provider === "veo") {
      const result = await this.request(
        provider,
        `models/${directorProviderModels.veo}:predictLongRunning`,
        "POST",
        signal,
        {
          instances: [
            {
              prompt,
              ...(references.length
                ? {
                    referenceImages: references.map((reference) => {
                      if (!reference.bytes)
                        throw new DirectorProviderError("Missing private image bytes.");
                      return {
                        image: {
                          inlineData: {
                            mimeType: reference.contentType,
                            data: Buffer.from(reference.bytes).toString("base64"),
                          },
                        },
                        referenceType: "asset",
                      };
                    }),
                  }
                : {}),
            },
          ],
          parameters: {
            durationSeconds: shot.duration,
            aspectRatio: document.aspectRatio,
            resolution: "720p",
            personGeneration: references.length ? "allow_adult" : "allow_all",
          },
        },
      );
      return validateDirectorRequest(provider, {
        id: z.object({ name: z.string() }).parse(result).name,
      });
    }
    const urls = (prefix: string) =>
      references
        .filter((reference) => reference.contentType.startsWith(prefix))
        .map((reference) => reference.url);
    const result = await this.request(provider, directorProviderModels.higgsfield, "POST", signal, {
      prompt,
      duration: shot.duration,
      resolution: "720p",
      aspect_ratio: document.aspectRatio,
      generate_audio: true,
      image_urls: urls("image/"),
      video_urls: urls("video/"),
      audio_urls: urls("audio/"),
    });
    return validateDirectorRequest(provider, {
      id: z.object({ request_id: z.uuid() }).parse(result).request_id,
    });
  }
  async poll(
    provider: DirectorProviderId,
    value: unknown,
    signal: AbortSignal,
  ): Promise<DirectorPoll> {
    const request = validateDirectorRequest(provider, value);
    if (provider === "veo") {
      const result = z
        .object({
          done: z.boolean().optional(),
          error: z.unknown().optional(),
          response: z
            .object({
              generateVideoResponse: z.object({
                generatedSamples: z
                  .array(z.object({ video: z.object({ uri: z.url() }) }))
                  .optional(),
              }),
            })
            .optional(),
        })
        .parse(await this.request(provider, request.id, "GET", signal));
      if (result.error)
        throw new DirectorProviderError(
          "Veo a refusé ou échoué à produire ce plan. Consultez le fournisseur.",
        );
      if (!result.done) return { done: false };
      const url = result.response?.generateVideoResponse.generatedSamples?.[0]?.video.uri;
      if (!url)
        throw new DirectorProviderError(
          "Veo n’a retourné aucun clip (filtrage ou échec de génération).",
        );
      return { done: true, url };
    }
    const result = z
      .object({
        status: z.enum(["queued", "in_progress", "completed", "failed", "nsfw", "canceled"]),
        video: z.object({ url: z.url() }).optional(),
      })
      .parse(await this.request(provider, `requests/${request.id}/status`, "GET", signal));
    if (["failed", "nsfw", "canceled"].includes(result.status))
      throw new DirectorProviderError(
        `Seedance : ${result.status}. Consultez le fournisseur avant toute nouvelle demande payante.`,
      );
    if (result.status !== "completed") return { done: false };
    if (!result.video) throw new DirectorProviderError("Higgsfield n’a retourné aucun clip.");
    return { done: true, url: result.video.url };
  }
  async cancel(provider: DirectorProviderId, value: unknown, signal: AbortSignal) {
    const request = validateDirectorRequest(provider, value);
    // The Gemini Veo documentation does not promise cancellation of submitted operations.
    if (provider === "veo") return false;
    await this.request(provider, `requests/${request.id}/cancel`, "POST", signal);
    return true;
  }
  async download(provider: DirectorProviderId, address: string, signal: AbortSignal) {
    const configuredHosts = this.config
      .get<string>("DIRECTOR_HIGGSFIELD_MEDIA_HOSTS", "cdn.higgsfield.ai,storage.googleapis.com")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean);
    let url = new URL(address);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const allowed =
        provider === "veo"
          ? ["generativelanguage.googleapis.com", "storage.googleapis.com"]
          : configuredHosts;
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !allowed.includes(url.hostname)
      )
        throw new DirectorProviderError(
          "Hôte de résultat non autorisé. Configurez un hôte HTTPS fournisseur vérifié.",
        );
      const headers: Record<string, string> = {};
      if (provider === "veo" && url.hostname === "generativelanguage.googleapis.com")
        headers["x-goog-api-key"] = this.config.get("DIRECTOR_VEO_API_KEY", "");
      const response = await fetch(url, {
        headers,
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
      });
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has("location")) {
        await response.body?.cancel();
        url = new URL(response.headers.get("location")!, url);
        continue;
      }
      const max = 200 * 1024 * 1024;
      if (!response.ok || !response.body || Number(response.headers.get("content-length")) > max)
        throw new DirectorProviderError("Impossible de récupérer le clip fournisseur.");
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of response.body) {
        total += chunk.byteLength;
        if (total > max) throw new DirectorProviderError("Le clip dépasse 200 MiB.");
        chunks.push(chunk);
      }
      if (!total) throw new DirectorProviderError("Clip fournisseur vide.");
      return Buffer.concat(chunks);
    }
    throw new DirectorProviderError("Trop de redirections fournisseur.");
  }
}
