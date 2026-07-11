// Cantonese.ai tests cover speech provider plugin behavior.
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANTONESE_AI_API_KEY_ENV } from "./shared.js";
import { buildCantoneseAiSpeechProvider, testing } from "./speech-provider.js";

const provider = buildCantoneseAiSpeechProvider();
const emptyCfg = {} as OpenClawConfig;

describe("cantonese-ai speech provider", () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env[CANTONESE_AI_API_KEY_ENV];

  beforeEach(() => {
    delete process.env[CANTONESE_AI_API_KEY_ENV];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env[CANTONESE_AI_API_KEY_ENV];
    } else {
      process.env[CANTONESE_AI_API_KEY_ENV] = originalApiKey;
    }
    vi.restoreAllMocks();
  });

  it("exposes stable provider identity", () => {
    expect(provider.id).toBe("cantonese-ai");
    expect(provider.label).toBe("Cantonese.ai");
  });

  it("defaults to Cantonese language and wav output", () => {
    const config = testing.normalizeCantoneseAiProviderConfig({});
    expect(config.language).toBe("cantonese");
    expect(config.outputExtension).toBe("wav");
    expect(config.baseUrl).toBe("https://cantonese.ai");
  });

  it("reads nested provider config", () => {
    const config = testing.normalizeCantoneseAiProviderConfig({
      providers: {
        "cantonese-ai": {
          apiKey: "k",
          voiceId: "voice-1",
          modelId: "v6",
          speed: 1.5,
          outputExtension: "mp3",
        },
      },
    });
    expect(config.apiKey).toBe("k");
    expect(config.voiceId).toBe("voice-1");
    expect(config.modelId).toBe("v6");
    expect(config.speed).toBe(1.5);
    expect(config.outputExtension).toBe("mp3");
  });

  it("is configured only when an api key is available", () => {
    expect(provider.isConfigured({ cfg: emptyCfg, providerConfig: {}, timeoutMs: 1000 })).toBe(
      false,
    );
    expect(
      provider.isConfigured({ cfg: emptyCfg, providerConfig: { apiKey: "k" }, timeoutMs: 1000 }),
    ).toBe(true);
    process.env[CANTONESE_AI_API_KEY_ENV] = "env-key";
    expect(provider.isConfigured({ cfg: emptyCfg, providerConfig: {}, timeoutMs: 1000 })).toBe(
      true,
    );
  });

  it("maps talk.speak params to provider overrides", () => {
    const overrides = provider.resolveTalkOverrides?.({
      talkProviderConfig: {},
      params: {
        voiceId: "voice-2",
        modelId: "v5",
        speed: 1.25,
        outputFormat: "mp3",
        language: "cantonese",
      },
    });
    expect(overrides).toEqual({
      voiceId: "voice-2",
      modelId: "v5",
      speed: 1.25,
      outputFormat: "mp3",
      language: "cantonese",
    });
  });

  it("synthesizes wav audio through the talk provider config", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from("wav-bytes")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.synthesize({
      text: "早晨",
      cfg: emptyCfg,
      providerConfig: { apiKey: "k", baseUrl: "https://cantonese.ai", outputExtension: "wav" },
      target: "audio-file",
      timeoutMs: 5_000,
    });

    expect(result.outputFormat).toBe("wav");
    expect(result.fileExtension).toBe(".wav");
    expect(result.voiceCompatible).toBe(false);
    expect(result.audioBuffer).toEqual(Buffer.from("wav-bytes"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when the api key is missing", async () => {
    await expect(
      provider.synthesize({
        text: "hi",
        cfg: emptyCfg,
        providerConfig: {},
        target: "audio-file",
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow("Cantonese.ai API key missing");
  });
});
