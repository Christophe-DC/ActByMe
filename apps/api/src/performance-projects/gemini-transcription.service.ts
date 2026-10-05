import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const MAX_TRANSCRIPTION_BYTES = 19_000_000;
const DEFAULT_MODEL = "gemini-3.5-transcribe";

type GeminiInteraction = {
  id?: string;
  model?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

@Injectable()
export class GeminiTranscriptionService {
  constructor(private readonly config: ConfigService) {}

  async transcribe(audio: Uint8Array, language?: string | null) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Speech-to-text is not configured. Set GEMINI_API_KEY on the API server.",
      );
    }

    if (!audio.byteLength || audio.byteLength > MAX_TRANSCRIPTION_BYTES) {
      throw new ServiceUnavailableException(
        "The extracted audio is empty or too large for Gemini speech-to-text processing.",
      );
    }

    const configuredModel = this.config.get<string>("GEMINI_TRANSCRIPTION_MODEL")?.trim();
    const model =
      configuredModel?.startsWith("gemini-3.5-transcribe") ? configuredModel : DEFAULT_MODEL;
    const languageCode = resolveLanguageCode(language);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            type: "audio",
            data: Buffer.from(audio).toString("base64"),
            mime_type: "audio/mp3",
          },
        ],
        generation_config: {
          transcription_config: {
            language_codes: languageCode ? [languageCode] : [],
            mode: "verbatim",
          },
        },
      }),
      signal: AbortSignal.timeout(300_000),
    }).catch((error: unknown) => {
      throw new ServiceUnavailableException("Speech-to-text could not reach Gemini.", {
        cause: error,
      });
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as GeminiInteraction | null;
      throw new ServiceUnavailableException(
        payload?.error?.message || `Gemini speech-to-text failed with status ${response.status}.`,
      );
    }

    const result = (await response.json()) as GeminiInteraction;
    if (result.status !== "completed") {
      throw new ServiceUnavailableException("Gemini speech-to-text returned an incomplete response.");
    }

    const text = result.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text" && content.text)
      .map((content) => content.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      throw new ServiceUnavailableException(
        "Gemini speech-to-text returned no transcript for this audio.",
      );
    }

    return { model: result.model ?? model, text };
  }
}

function resolveLanguageCode(language?: string | null) {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(normalized)) return normalized;

  const languageCodes: Record<string, string> = {
    arabic: "ar",
    chinese: "zh",
    dutch: "nl",
    english: "en",
    french: "fr",
    german: "de",
    hindi: "hi",
    italian: "it",
    japanese: "ja",
    korean: "ko",
    portuguese: "pt",
    russian: "ru",
    spanish: "es",
  };

  return languageCodes[normalized];
}
