// Cantonese.ai plugin module implements shared behavior.

// TTS is served from the main site under /api/tts; STT uses the dedicated
// OpenAI-compatible host. Keep both configurable so operators can retarget
// staging endpoints without a plugin change.
export const DEFAULT_CANTONESE_AI_TTS_BASE_URL = "https://cantonese.ai";
export const DEFAULT_CANTONESE_AI_STT_BASE_URL = "https://stt-api.cantonese.ai/v1";

export const CANTONESE_AI_PROVIDER_ID = "cantonese-ai";
export const CANTONESE_AI_API_KEY_ENV = "CANTONESE_AI_API_KEY";

// cantonese.ai TTS ships discrete model generations; v5/v6 additionally accept
// Jyutping guidance. We keep the list for directive validation only.
export const CANTONESE_AI_TTS_MODELS = ["v2", "v3", "v4", "v5", "v6"] as const;

// The API accepts wav or mp3; both are container formats AVAudioPlayer detects,
// so iOS Talk playback works without extra sample-rate metadata.
export type CantoneseAiOutputExtension = "wav" | "mp3";

export function normalizeCantoneseAiBaseUrl(baseUrl: string | undefined, fallback: string): string {
  const trimmed = baseUrl?.trim();
  return trimmed?.replace(/\/+$/, "") || fallback;
}

export function normalizeCantoneseAiOutputExtension(
  value: string | undefined,
): CantoneseAiOutputExtension {
  return value?.trim().toLowerCase() === "mp3" ? "mp3" : "wav";
}
