import type { ModelExecutionProfile } from "./model-execution-profile.js";

export const GEMMA_3_12B_QAT_PROFILE_ID = "gemma-3-12b-it-qat-q4_0" as const;
export const GEMMA_3_12B_QAT_MODEL_ID = "google/gemma-3-12b-it-qat-q4_0-gguf" as const;

export interface ModelFingerprint {
  schema_version: "1.0.0";
  profile_id: typeof GEMMA_3_12B_QAT_PROFILE_ID;
  provider: string;
  model: string;
  backend: string;
  backend_version: string | null;
  quantization: "Q4_0";
  context_window_tokens: number;
  maximum_output_tokens: number;
  chat_template_hash: string | null;
  model_file_hash: string | null;
}

export function assertGemmaFingerprintMatchesProfile(
  fingerprint: ModelFingerprint,
  profile: ModelExecutionProfile,
): void {
  if (profile.id !== GEMMA_3_12B_QAT_PROFILE_ID) {
    throw new Error(`Gemma fingerprint requires the ${GEMMA_3_12B_QAT_PROFILE_ID} execution profile.`);
  }
  if (fingerprint.profile_id !== profile.id) {
    throw new Error("Gemma fingerprint profile ID does not match the execution profile.");
  }
  if (fingerprint.model !== GEMMA_3_12B_QAT_MODEL_ID) {
    throw new Error(`Gemma fingerprint model identity must be ${GEMMA_3_12B_QAT_MODEL_ID}.`);
  }
  if (fingerprint.quantization !== "Q4_0") {
    throw new Error("Gemma fingerprint must use Q4_0 quantization.");
  }
  if (fingerprint.context_window_tokens !== profile.reliable_context_tokens) {
    throw new Error("Gemma fingerprint context window does not match the execution profile.");
  }
  if (fingerprint.maximum_output_tokens !== profile.maximum_output_tokens) {
    throw new Error("Gemma fingerprint maximum output tokens do not match the execution profile.");
  }
}
