// Cantonese.ai plugin module implements tts behavior.
import {
  assertOkOrThrowProviderError,
  readProviderBinaryResponse,
} from "openclaw/plugin-sdk/provider-http";
import { requireInRange } from "openclaw/plugin-sdk/speech";
import {
  fetchWithSsrFGuard,
  ssrfPolicyFromHttpBaseUrlAllowedHostname,
} from "openclaw/plugin-sdk/ssrf-runtime";
import {
  type CantoneseAiOutputExtension,
  normalizeCantoneseAiBaseUrl,
  DEFAULT_CANTONESE_AI_TTS_BASE_URL,
} from "./shared.js";

// cantonese.ai caps a single synthesis request at 5000 characters.
const CANTONESE_AI_TTS_MAX_TEXT_LENGTH = 5000;

export type CantoneseAiTtsRequestParams = {
  text: string;
  apiKey: string;
  baseUrl: string;
  voiceId?: string;
  modelId?: string;
  speed?: number;
  pitch?: number;
  frameRate?: string;
  language?: string;
  outputExtension: CantoneseAiOutputExtension;
  timeoutMs: number;
};

function buildCantoneseAiTtsBody(params: CantoneseAiTtsRequestParams): string {
  if (params.speed !== undefined) {
    requireInRange(params.speed, 0.5, 3, "speed");
  }
  // Only send optional fields when set so the service applies its own defaults
  // (default voice, default model) rather than us guessing an id it rejects.
  const body: Record<string, unknown> = {
    api_key: params.apiKey,
    text: params.text,
    output_extension: params.outputExtension,
    should_return_timestamp: false,
  };
  if (params.voiceId) {
    body.voice_id = params.voiceId;
  }
  if (params.modelId) {
    body.model_id = params.modelId;
  }
  if (params.speed !== undefined) {
    body.speed = params.speed;
  }
  if (params.pitch !== undefined) {
    body.pitch = params.pitch;
  }
  if (params.frameRate) {
    body.frame_rate = params.frameRate;
  }
  if (params.language) {
    body.language = params.language;
  }
  return JSON.stringify(body);
}

export async function cantoneseAiTTS(params: CantoneseAiTtsRequestParams): Promise<Buffer> {
  if (params.text.length > CANTONESE_AI_TTS_MAX_TEXT_LENGTH) {
    throw new Error(
      `Cantonese.ai TTS text exceeds ${CANTONESE_AI_TTS_MAX_TEXT_LENGTH} character limit`,
    );
  }
  const normalizedBaseUrl = normalizeCantoneseAiBaseUrl(
    params.baseUrl,
    DEFAULT_CANTONESE_AI_TTS_BASE_URL,
  );
  const { response, release } = await fetchWithSsrFGuard({
    url: `${normalizedBaseUrl}/api/tts`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: buildCantoneseAiTtsBody({ ...params, baseUrl: normalizedBaseUrl }),
    },
    timeoutMs: params.timeoutMs,
    policy: ssrfPolicyFromHttpBaseUrlAllowedHostname(normalizedBaseUrl),
    auditContext: "cantonese-ai.tts",
  });
  try {
    await assertOkOrThrowProviderError(response, "Cantonese.ai TTS API error");
    return Buffer.from(
      await readProviderBinaryResponse(response, "Cantonese.ai TTS API error", "audio"),
    );
  } finally {
    await release();
  }
}
