import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModelFingerprint } from "../src/application/model-fingerprint.js";
import { assertGemmaFingerprintMatchesProfile } from "../src/domain/model-fingerprint.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";

test("fingerprint rejects a non-Q4_0 target", () => {
  assert.throws(() => assertGemmaFingerprintMatchesProfile({
    schema_version: "1.0.0",
    profile_id: "gemma-3-12b-it-qat-q4_0",
    provider: "local",
    model: "google/gemma-3-12b-it",
    backend: "llama.cpp",
    backend_version: "b6000",
    quantization: "Q4_0",
    context_window_tokens: 16_384,
    maximum_output_tokens: 4_096,
    chat_template_hash: null,
    model_file_hash: null,
  }, MODEL_EXECUTION_PROFILES["host-default"]));
});

test("normalizes optional worker metadata into the Gemma fingerprint", () => {
  const fingerprint = normalizeModelFingerprint({
    provider: "local",
    model: "google/gemma-3-12b-it-qat-q4_0-gguf",
    contextWindowTokens: 16_384,
    maxOutputTokens: 4_096,
    backend: "llama.cpp",
    backendVersion: "b6000",
    quantization: "Q4_0",
    chatTemplateHash: "template-sha256",
    modelFileHash: "model-sha256",
  }, MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"]);

  assert.deepEqual(fingerprint, {
    schema_version: "1.0.0",
    profile_id: "gemma-3-12b-it-qat-q4_0",
    provider: "local",
    model: "google/gemma-3-12b-it-qat-q4_0-gguf",
    backend: "llama.cpp",
    backend_version: "b6000",
    quantization: "Q4_0",
    context_window_tokens: 16_384,
    maximum_output_tokens: 4_096,
    chat_template_hash: "template-sha256",
    model_file_hash: "model-sha256",
  });
});

test("fingerprint rejects a Gemma target with the wrong model identity", () => {
  assert.throws(() => normalizeModelFingerprint({
    provider: "local",
    model: "google/gemma-3-12b-it",
    contextWindowTokens: 16_384,
    maxOutputTokens: 4_096,
    backend: "llama.cpp",
    quantization: "Q4_0",
  }, MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"]), /model identity/i);
});

test("fingerprint rejects missing Gemma backend metadata", () => {
  assert.throws(() => assertGemmaFingerprintMatchesProfile({
    schema_version: "1.0.0",
    profile_id: "gemma-3-12b-it-qat-q4_0",
    provider: "local",
    model: "google/gemma-3-12b-it-qat-q4_0-gguf",
    backend: "",
    backend_version: null,
    quantization: "Q4_0",
    context_window_tokens: 16_384,
    maximum_output_tokens: 4_096,
    chat_template_hash: null,
    model_file_hash: null,
  }, MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"]), /backend/i);
});
