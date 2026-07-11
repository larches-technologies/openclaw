// Cantonese.ai provider module implements model/runtime integration.
import {
  transcribeOpenAiCompatibleAudio,
  type AudioTranscriptionRequest,
  type AudioTranscriptionResult,
  type MediaUnderstandingProvider,
} from "openclaw/plugin-sdk/media-understanding";
import { resolveCantoneseAiApiKeyFromEnv } from "./config-api.js";
import { CANTONESE_AI_PROVIDER_ID, DEFAULT_CANTONESE_AI_STT_BASE_URL } from "./shared.js";

// cantonese.ai exposes an OpenAI-compatible /audio/transcriptions endpoint;
// operators can override the model per config, so this is only the fallback.
const DEFAULT_CANTONESE_AI_STT_MODEL = "v2";
// Cantonese is transcribed under the generic Chinese language code.
const DEFAULT_CANTONESE_AI_STT_LANGUAGE = "zh";

export async function transcribeCantoneseAiAudio(
  req: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const apiKey = req.apiKey || resolveCantoneseAiApiKeyFromEnv();
  if (!apiKey) {
    throw new Error("Cantonese.ai API key missing");
  }
  return await transcribeOpenAiCompatibleAudio({
    ...req,
    apiKey,
    language: req.language ?? DEFAULT_CANTONESE_AI_STT_LANGUAGE,
    provider: CANTONESE_AI_PROVIDER_ID,
    defaultBaseUrl: DEFAULT_CANTONESE_AI_STT_BASE_URL,
    defaultModel: DEFAULT_CANTONESE_AI_STT_MODEL,
  });
}

export const cantoneseAiMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: CANTONESE_AI_PROVIDER_ID,
  capabilities: ["audio"],
  defaultModels: { audio: DEFAULT_CANTONESE_AI_STT_MODEL },
  autoPriority: { audio: 40 },
  transcribeAudio: transcribeCantoneseAiAudio,
};
