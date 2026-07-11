// Cantonese.ai tests cover media understanding provider plugin behavior.
import {
  createRequestCaptureJsonFetch,
  installPinnedHostnameTestHooks,
} from "openclaw/plugin-sdk/test-env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cantoneseAiMediaUnderstandingProvider,
  transcribeCantoneseAiAudio,
} from "./media-understanding-provider.js";
import { CANTONESE_AI_API_KEY_ENV } from "./shared.js";

installPinnedHostnameTestHooks();

describe("cantoneseAiMediaUnderstandingProvider", () => {
  const originalApiKey = process.env[CANTONESE_AI_API_KEY_ENV];

  beforeEach(() => {
    delete process.env[CANTONESE_AI_API_KEY_ENV];
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env[CANTONESE_AI_API_KEY_ENV];
    } else {
      process.env[CANTONESE_AI_API_KEY_ENV] = originalApiKey;
    }
  });

  it("declares audio-only support with the transcription default", () => {
    expect(cantoneseAiMediaUnderstandingProvider.id).toBe("cantonese-ai");
    expect(cantoneseAiMediaUnderstandingProvider.capabilities).toEqual(["audio"]);
    expect(cantoneseAiMediaUnderstandingProvider.defaultModels).toEqual({ audio: "v2" });
    expect(cantoneseAiMediaUnderstandingProvider.transcribeAudio).toBe(transcribeCantoneseAiAudio);
  });

  it("posts to the OpenAI-compatible endpoint with Bearer auth and Cantonese language", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({ text: "你好" });

    const result = await transcribeCantoneseAiAudio({
      buffer: Buffer.from("audio-bytes"),
      fileName: "note.wav",
      apiKey: "test-key",
      timeoutMs: 1234,
      mime: "audio/wav",
      fetchFn,
    });

    const { url, init } = getRequest();
    expect(url).toBe("https://stt-api.cantonese.ai/v1/audio/transcriptions");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");

    const form = init?.body as FormData;
    expect(form.get("model")).toBe("v2");
    expect(form.get("language")).toBe("zh");
    expect(result.text).toBe("你好");
  });

  it("falls back to the environment api key", async () => {
    process.env[CANTONESE_AI_API_KEY_ENV] = "env-key";
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({ text: "ok" });

    await transcribeCantoneseAiAudio({
      buffer: Buffer.from("audio"),
      fileName: "note.wav",
      apiKey: "",
      timeoutMs: 1000,
      fetchFn,
    });

    expect(new Headers(getRequest().init?.headers).get("authorization")).toBe("Bearer env-key");
  });

  it("throws when no api key is available", async () => {
    const { fetchFn } = createRequestCaptureJsonFetch({ text: "ok" });
    await expect(
      transcribeCantoneseAiAudio({
        buffer: Buffer.from("audio"),
        fileName: "note.wav",
        apiKey: "",
        timeoutMs: 1000,
        fetchFn,
      }),
    ).rejects.toThrow("Cantonese.ai API key missing");
  });
});
