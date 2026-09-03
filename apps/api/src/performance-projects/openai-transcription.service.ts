import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const MAX_TRANSCRIPTION_BYTES = 24_000_000;

@Injectable()
export class OpenAiTranscriptionService {
  constructor(private readonly config: ConfigService) {}

  async transcribe(audio: Uint8Array, language?: string | null) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Speech-to-text is not configured. Set OPENAI_API_KEY on the API server.",
      );
    }

    if (!audio.byteLength || audio.byteLength > MAX_TRANSCRIPTION_BYTES) {
      throw new ServiceUnavailableException(
        "The extracted audio is empty or too large for speech-to-text processing.",
      );
    }

    const model =
      this.config.get<string>("OPENAI_TRANSCRIPTION_MODEL")?.trim() || "gpt-4o-transcribe";
    const audioBuffer = new ArrayBuffer(audio.byteLength);
    new Uint8Array(audioBuffer).set(audio);
    const body = new FormData();
    body.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "take-audio.mp3");
    body.append("model", model);
    body.append("response_format", "json");
    body.append("temperature", "0");

    const languageCode = resolveLanguageCode(language);
    if (languageCode) body.append("language", languageCode);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        body,
        headers: { Authorization: `Bearer ${apiKey}` },
        method: "POST",
        signal: AbortSignal.timeout(300_000),
      });
    } catch {
      throw new ServiceUnavailableException("Speech-to-text could not reach OpenAI.");
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new ServiceUnavailableException(
        errorBody?.error?.message || `Speech-to-text failed with status ${response.status}.`,
      );
    }

    const result = (await response.json()) as { text?: unknown };
    if (typeof result.text !== "string") {
      throw new ServiceUnavailableException("Speech-to-text returned an invalid response.");
    }

    return { model, text: result.text.trim() };
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
