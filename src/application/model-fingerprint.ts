import {
  assertGemmaFingerprintMatchesProfile,
  GEMMA_3_12B_QAT_PROFILE_ID,
  type ModelFingerprint,
} from "../domain/model-fingerprint.js";
import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { QualityModelCapacity } from "../domain/quality-worker.js";

function optionalMetadata(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeModelFingerprint(
  capacity: QualityModelCapacity,
  profile: ModelExecutionProfile,
): ModelFingerprint {
  if (profile.id !== GEMMA_3_12B_QAT_PROFILE_ID) {
    throw new Error(`Only ${GEMMA_3_12B_QAT_PROFILE_ID} can be normalized as a Gemma fingerprint.`);
  }
  if (capacity.quantization !== undefined && capacity.quantization !== "Q4_0") {
    throw new Error("Gemma model metadata must report Q4_0 quantization.");
  }
  const backend = optionalMetadata(capacity.backend);
  if (!backend) throw new Error("Gemma model metadata requires a backend.");
  const fingerprint: ModelFingerprint = {
    schema_version: "1.0.0",
    profile_id: GEMMA_3_12B_QAT_PROFILE_ID,
    provider: capacity.provider,
    model: capacity.model,
    backend,
    backend_version: optionalMetadata(capacity.backendVersion),
    quantization: "Q4_0",
    context_window_tokens: capacity.contextWindowTokens,
    maximum_output_tokens: capacity.maxOutputTokens,
    chat_template_hash: optionalMetadata(capacity.chatTemplateHash),
    model_file_hash: optionalMetadata(capacity.modelFileHash),
  };
  assertGemmaFingerprintMatchesProfile(fingerprint, profile);
  return fingerprint;
}
