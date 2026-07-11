// Cantonese.ai plugin entrypoint registers its OpenClaw integration.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { cantoneseAiMediaUnderstandingProvider } from "./media-understanding-provider.js";
import { buildCantoneseAiSpeechProvider } from "./speech-provider.js";

export default definePluginEntry({
  id: "cantonese-ai",
  name: "Cantonese.ai Speech",
  description: "Bundled Cantonese.ai speech (TTS) and speech-to-text provider",
  register(api) {
    api.registerSpeechProvider(buildCantoneseAiSpeechProvider());
    api.registerMediaUnderstandingProvider(cantoneseAiMediaUnderstandingProvider);
  },
});
