// Narrow barrel for Cantonese.ai config helpers consumed by provider modules.
import { CANTONESE_AI_API_KEY_ENV } from "./shared.js";

/** Resolve the Cantonese.ai API key from the environment when config omits it. */
export function resolveCantoneseAiApiKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = (env[CANTONESE_AI_API_KEY_ENV] ?? "").trim();
  return value || undefined;
}
