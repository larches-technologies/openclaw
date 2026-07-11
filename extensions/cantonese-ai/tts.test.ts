// Cantonese.ai tests cover tts plugin behavior.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cantoneseAiTTS, type CantoneseAiTtsRequestParams } from "./tts.js";

describe("cantoneseAiTTS", () => {
  const originalFetch = globalThis.fetch;

  function createDefaultTtsRequest(
    overrides: Partial<CantoneseAiTtsRequestParams> = {},
  ): CantoneseAiTtsRequestParams {
    return {
      text: "你好",
      apiKey: "test-key",
      baseUrl: "https://cantonese.ai",
      outputExtension: "wav",
      timeoutMs: 5_000,
      ...overrides,
    };
  }

  function requireFirstFetchCall(fetchMock: ReturnType<typeof vi.fn>): [string | URL, RequestInit] {
    const [call] = fetchMock.mock.calls;
    if (!call) {
      throw new Error("expected Cantonese.ai fetch call");
    }
    return call as [string | URL, RequestInit];
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts JSON to the /api/tts endpoint with the api key in the body", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from("wav-bytes")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const audio = await cantoneseAiTTS(
      createDefaultTtsRequest({
        voiceId: "2725cf0f-efe2-4132-9e06-62ad84b2973d",
        modelId: "v6",
        speed: 1.2,
        pitch: 0,
        frameRate: "24000",
        language: "cantonese",
      }),
    );

    const [url, init] = requireFirstFetchCall(fetchMock);
    expect(new URL(url.toString()).toString()).toBe("https://cantonese.ai/api/tts");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      api_key: "test-key",
      text: "你好",
      voice_id: "2725cf0f-efe2-4132-9e06-62ad84b2973d",
      model_id: "v6",
      speed: 1.2,
      pitch: 0,
      frame_rate: "24000",
      language: "cantonese",
      output_extension: "wav",
      should_return_timestamp: false,
    });
    expect(audio).toEqual(Buffer.from("wav-bytes"));
  });

  it("omits optional fields the caller left unset so the API applies its defaults", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from("wav")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cantoneseAiTTS(createDefaultTtsRequest());

    const [, init] = requireFirstFetchCall(fetchMock);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.voice_id).toBeUndefined();
    expect(body.model_id).toBeUndefined();
    expect(body.speed).toBeUndefined();
    expect(body.frame_rate).toBeUndefined();
  });

  it("rejects text longer than the 5000 character limit before calling the API", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from("wav")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      cantoneseAiTTS(createDefaultTtsRequest({ text: "a".repeat(5001) })),
    ).rejects.toThrow("5000 character limit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects out-of-range speed instead of sending it", async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from("wav")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(cantoneseAiTTS(createDefaultTtsRequest({ speed: 5 }))).rejects.toThrow("speed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces provider API errors", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(cantoneseAiTTS(createDefaultTtsRequest())).rejects.toThrow(
      "Cantonese.ai TTS API error",
    );
  });
});
