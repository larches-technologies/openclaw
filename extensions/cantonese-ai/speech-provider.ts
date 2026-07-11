// Cantonese.ai provider module implements model/runtime integration.
import { parseStrictFiniteNumber } from "openclaw/plugin-sdk/number-runtime";
import { normalizeResolvedSecretInputString } from "openclaw/plugin-sdk/secret-input";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderPlugin,
  SpeechSynthesisRequest,
} from "openclaw/plugin-sdk/speech";
import {
  asFiniteNumber,
  asObject,
  requireInRange,
  trimToUndefined,
} from "openclaw/plugin-sdk/speech";
import { resolveCantoneseAiApiKeyFromEnv } from "./config-api.js";
import {
  CANTONESE_AI_PROVIDER_ID,
  type CantoneseAiOutputExtension,
  DEFAULT_CANTONESE_AI_TTS_BASE_URL,
  normalizeCantoneseAiBaseUrl,
  normalizeCantoneseAiOutputExtension,
} from "./shared.js";
import { cantoneseAiTTS } from "./tts.js";

// Cantonese is the product's whole reason to exist, so it is the default
// synthesis language unless config/directives override it.
const DEFAULT_CANTONESE_AI_LANGUAGE = "cantonese";

type CantoneseAiProviderConfig = {
  apiKey?: string;
  baseUrl: string;
  voiceId?: string;
  modelId?: string;
  speed?: number;
  pitch?: number;
  frameRate?: string;
  language: string;
  outputExtension: CantoneseAiOutputExtension;
};

function normalizeSpeed(value: unknown): number | undefined {
  const speed = asFiniteNumber(value);
  return speed !== undefined && speed >= 0.5 && speed <= 3 ? speed : undefined;
}

function normalizePitch(value: unknown): number | undefined {
  return asFiniteNumber(value);
}

function normalizeFrameRate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return trimToUndefined(value);
}

function normalizeCantoneseAiProviderConfig(
  rawConfig: Record<string, unknown>,
): CantoneseAiProviderConfig {
  const providers = asObject(rawConfig.providers);
  const raw =
    asObject(providers?.[CANTONESE_AI_PROVIDER_ID]) ??
    asObject(rawConfig[CANTONESE_AI_PROVIDER_ID]);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: `messages.tts.providers.${CANTONESE_AI_PROVIDER_ID}.apiKey`,
    }),
    baseUrl: normalizeCantoneseAiBaseUrl(
      trimToUndefined(raw?.baseUrl),
      DEFAULT_CANTONESE_AI_TTS_BASE_URL,
    ),
    voiceId: trimToUndefined(raw?.voiceId),
    modelId: trimToUndefined(raw?.modelId),
    speed: normalizeSpeed(raw?.speed),
    pitch: normalizePitch(raw?.pitch),
    frameRate: normalizeFrameRate(raw?.frameRate),
    language: trimToUndefined(raw?.language) ?? DEFAULT_CANTONESE_AI_LANGUAGE,
    outputExtension: normalizeCantoneseAiOutputExtension(trimToUndefined(raw?.outputExtension)),
  };
}

function readCantoneseAiProviderConfig(config: SpeechProviderConfig): CantoneseAiProviderConfig {
  const defaults = normalizeCantoneseAiProviderConfig({});
  return {
    apiKey: trimToUndefined(config.apiKey) ?? defaults.apiKey,
    baseUrl: normalizeCantoneseAiBaseUrl(
      trimToUndefined(config.baseUrl) ?? defaults.baseUrl,
      DEFAULT_CANTONESE_AI_TTS_BASE_URL,
    ),
    voiceId: trimToUndefined(config.voiceId) ?? defaults.voiceId,
    modelId: trimToUndefined(config.modelId) ?? defaults.modelId,
    speed: normalizeSpeed(config.speed) ?? defaults.speed,
    pitch: normalizePitch(config.pitch) ?? defaults.pitch,
    frameRate: normalizeFrameRate(config.frameRate) ?? defaults.frameRate,
    language: trimToUndefined(config.language) ?? defaults.language,
    outputExtension:
      config.outputExtension === undefined
        ? defaults.outputExtension
        : normalizeCantoneseAiOutputExtension(trimToUndefined(config.outputExtension)),
  };
}

function resolveApiKey(config: CantoneseAiProviderConfig): string | undefined {
  return config.apiKey || resolveCantoneseAiApiKeyFromEnv();
}

function resolveOutputMetadata(extension: CantoneseAiOutputExtension): {
  outputFormat: string;
  fileExtension: string;
} {
  return extension === "mp3"
    ? { outputFormat: "mp3", fileExtension: ".mp3" }
    : { outputFormat: "wav", fileExtension: ".wav" };
}

function parseDirectiveToken(ctx: SpeechDirectiveTokenParseContext) {
  switch (ctx.key) {
    case "voiceid":
    case "voice_id":
      if (!ctx.policy.allowVoice) {
        return { handled: true };
      }
      return { handled: true, overrides: { ...ctx.currentOverrides, voiceId: ctx.value } };
    case "model":
    case "modelid":
    case "model_id":
      if (!ctx.policy.allowModelId) {
        return { handled: true };
      }
      return { handled: true, overrides: { ...ctx.currentOverrides, modelId: ctx.value } };
    case "speed": {
      if (!ctx.policy.allowVoiceSettings) {
        return { handled: true };
      }
      const value = parseStrictFiniteNumber(ctx.value);
      if (value == null) {
        return { handled: true, warnings: ["invalid speed value"] };
      }
      try {
        requireInRange(value, 0.5, 3, "speed");
      } catch {
        return { handled: true, warnings: ["speed must be between 0.5 and 3"] };
      }
      return { handled: true, overrides: { ...ctx.currentOverrides, speed: value } };
    }
    case "language":
    case "languagecode":
    case "language_code":
      if (!ctx.policy.allowNormalization) {
        return { handled: true };
      }
      return { handled: true, overrides: { ...ctx.currentOverrides, language: ctx.value } };
    default:
      return { handled: false };
  }
}

function resolveCantoneseAiTtsRequest(
  req: Pick<SpeechSynthesisRequest, "providerConfig" | "providerOverrides" | "text" | "timeoutMs">,
) {
  const config = readCantoneseAiProviderConfig(req.providerConfig);
  const overrides = req.providerOverrides ?? {};
  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new Error("Cantonese.ai API key missing");
  }
  const outputExtension =
    overrides.outputFormat === undefined
      ? config.outputExtension
      : normalizeCantoneseAiOutputExtension(trimToUndefined(overrides.outputFormat));
  return {
    request: {
      text: req.text,
      apiKey,
      baseUrl: config.baseUrl,
      voiceId: trimToUndefined(overrides.voiceId) ?? config.voiceId,
      modelId: trimToUndefined(overrides.modelId) ?? config.modelId,
      speed: normalizeSpeed(overrides.speed) ?? config.speed,
      pitch: config.pitch,
      frameRate: config.frameRate,
      language: trimToUndefined(overrides.language) ?? config.language,
      outputExtension,
      timeoutMs: req.timeoutMs,
    },
    outputExtension,
  };
}

export function buildCantoneseAiSpeechProvider(): SpeechProviderPlugin {
  return {
    id: CANTONESE_AI_PROVIDER_ID,
    label: "Cantonese.ai",
    autoSelectOrder: 25,
    resolveConfig: ({ rawConfig }) => normalizeCantoneseAiProviderConfig(rawConfig),
    parseDirectiveToken,
    resolveTalkConfig: ({ baseTtsConfig, talkProviderConfig }) => {
      const base = normalizeCantoneseAiProviderConfig(baseTtsConfig);
      const resolvedApiKey =
        talkProviderConfig.apiKey === undefined
          ? base.apiKey
          : normalizeResolvedSecretInputString({
              value: talkProviderConfig.apiKey,
              path: `talk.providers.${CANTONESE_AI_PROVIDER_ID}.apiKey`,
            });
      return {
        ...base,
        ...(resolvedApiKey === undefined ? {} : { apiKey: resolvedApiKey }),
        ...(trimToUndefined(talkProviderConfig.baseUrl) == null
          ? {}
          : {
              baseUrl: normalizeCantoneseAiBaseUrl(
                trimToUndefined(talkProviderConfig.baseUrl),
                DEFAULT_CANTONESE_AI_TTS_BASE_URL,
              ),
            }),
        ...(trimToUndefined(talkProviderConfig.voiceId) == null
          ? {}
          : { voiceId: trimToUndefined(talkProviderConfig.voiceId) }),
        ...(trimToUndefined(talkProviderConfig.modelId) == null
          ? {}
          : { modelId: trimToUndefined(talkProviderConfig.modelId) }),
        ...(normalizeSpeed(talkProviderConfig.speed) == null
          ? {}
          : { speed: normalizeSpeed(talkProviderConfig.speed) }),
        ...(normalizePitch(talkProviderConfig.pitch) == null
          ? {}
          : { pitch: normalizePitch(talkProviderConfig.pitch) }),
        ...(normalizeFrameRate(talkProviderConfig.frameRate) == null
          ? {}
          : { frameRate: normalizeFrameRate(talkProviderConfig.frameRate) }),
        ...(trimToUndefined(talkProviderConfig.language) == null
          ? {}
          : { language: trimToUndefined(talkProviderConfig.language) }),
        ...(talkProviderConfig.outputExtension === undefined
          ? {}
          : {
              outputExtension: normalizeCantoneseAiOutputExtension(
                trimToUndefined(talkProviderConfig.outputExtension),
              ),
            }),
      };
    },
    resolveTalkOverrides: ({ params }) => {
      const speed = normalizeSpeed(params.speed);
      return {
        ...(trimToUndefined(params.voiceId) == null
          ? {}
          : { voiceId: trimToUndefined(params.voiceId) }),
        ...(trimToUndefined(params.modelId) == null
          ? {}
          : { modelId: trimToUndefined(params.modelId) }),
        ...(trimToUndefined(params.outputFormat) == null
          ? {}
          : { outputFormat: trimToUndefined(params.outputFormat) }),
        ...(speed == null ? {} : { speed }),
        ...(trimToUndefined(params.language) == null
          ? {}
          : { language: trimToUndefined(params.language) }),
      };
    },
    isConfigured: ({ providerConfig }) =>
      Boolean(resolveApiKey(readCantoneseAiProviderConfig(providerConfig))),
    synthesize: async (req) => {
      const { request, outputExtension } = resolveCantoneseAiTtsRequest(req);
      const audioBuffer = await cantoneseAiTTS(request);
      const { outputFormat, fileExtension } = resolveOutputMetadata(outputExtension);
      return {
        audioBuffer,
        outputFormat,
        fileExtension,
        // The API returns wav/mp3 containers, never Opus, so audio always needs
        // transcoding before it can ship as a native voice note.
        voiceCompatible: false,
      };
    },
  };
}

export const testing = {
  normalizeCantoneseAiProviderConfig,
  readCantoneseAiProviderConfig,
};
