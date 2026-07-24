import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertGemmaQualificationPromotion,
  type GemmaQualificationCase,
} from "../src/domain/gemma-qualification.js";
import {
  GEMMA_3_12B_QAT_PROFILE_ID,
  type ModelFingerprint,
} from "../src/domain/model-fingerprint.js";
import { isModelJobType } from "../src/domain/model-job.js";
import {
  requireGemmaQualificationConfiguration,
  resolveGemmaQualificationRunRoot,
  runGemmaQualification,
} from "../src/evaluation/gemma-qualification.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { PiPrintWorker } from "../src/pi/pi-print-worker.js";

const FIXTURES = [
  "evals/gemma/fixtures/structured-jobs.yaml",
  "evals/gemma/fixtures/authority-distraction.yaml",
  "evals/gemma/fixtures/dramatized-scene.yaml",
] as const;

function parseArguments(argv: readonly string[]): Map<string, string> {
  const allowed = new Set(["provider", "model", "fingerprint", "seed"]);
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) throw new Error(`Unexpected positional argument: ${argument}.`);
    const key = argument.slice(2);
    if (!allowed.has(key)) throw new Error(`Unknown Gemma qualification option: --${key}.`);
    if (result.has(key)) throw new Error(`Gemma qualification option --${key} may be provided only once.`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${key} requires a value.`);
    result.set(key, value);
    index += 1;
  }
  return result;
}

function required(argumentsMap: ReadonlyMap<string, string>, key: string): string {
  const value = argumentsMap.get(key)?.trim();
  if (!value) throw new Error(`--${key} is required.`);
  return value;
}

function stringOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`Gemma fingerprint ${label} must be a nonblank string or null.`);
  return value;
}

function loadFingerprint(path: string): ModelFingerprint {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read Gemma fingerprint ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemma fingerprint must be one JSON object.");
  }
  const object = value as Record<string, unknown>;
  const allowed = new Set([
    "schema_version",
    "profile_id",
    "provider",
    "model",
    "backend",
    "backend_version",
    "quantization",
    "context_window_tokens",
    "maximum_output_tokens",
    "chat_template_hash",
    "model_file_hash",
  ]);
  const unknown = Object.keys(object).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Gemma fingerprint has unknown fields: ${unknown.join(", ")}.`);
  const integer = (key: string): number => {
    const candidate = object[key];
    if (!Number.isInteger(candidate) || Number(candidate) < 1) {
      throw new Error(`Gemma fingerprint ${key} must be a positive integer.`);
    }
    return Number(candidate);
  };
  if (object.schema_version !== "1.0.0") throw new Error("Gemma fingerprint schema_version must be 1.0.0.");
  if (object.profile_id !== GEMMA_3_12B_QAT_PROFILE_ID) {
    throw new Error(`Gemma fingerprint profile_id must be ${GEMMA_3_12B_QAT_PROFILE_ID}.`);
  }
  for (const key of ["provider", "model", "backend"] as const) {
    if (typeof object[key] !== "string" || !object[key].trim()) {
      throw new Error(`Gemma fingerprint ${key} must be nonblank.`);
    }
  }
  if (object.quantization !== "Q4_0") throw new Error("Gemma fingerprint quantization must be Q4_0.");
  return {
    schema_version: "1.0.0",
    profile_id: GEMMA_3_12B_QAT_PROFILE_ID,
    provider: object.provider as string,
    model: object.model as string,
    backend: object.backend as string,
    backend_version: stringOrNull(object.backend_version, "backend_version"),
    quantization: "Q4_0",
    context_window_tokens: integer("context_window_tokens"),
    maximum_output_tokens: integer("maximum_output_tokens"),
    chat_template_hash: stringOrNull(object.chat_template_hash, "chat_template_hash"),
    model_file_hash: stringOrNull(object.model_file_hash, "model_file_hash"),
  };
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)
    || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of nonblank strings.`);
  }
  return [...value] as string[];
}

function loadCases(repositoryRoot: string): GemmaQualificationCase[] {
  const cases: GemmaQualificationCase[] = [];
  for (const fixture of FIXTURES) {
    const path = resolve(repositoryRoot, fixture);
    const value = parseYaml<Record<string, unknown>>(readFileSync(path, "utf8"), undefined, path);
    if (value.schema_version !== "1.0.0" || !Array.isArray(value.cases)) {
      throw new Error(`${path} requires schema_version 1.0.0 and a cases array.`);
    }
    for (const [index, raw] of value.cases.entries()) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`${path} case ${index + 1} must be an object.`);
      }
      const item = raw as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id.trim()) throw new Error(`${path} case ${index + 1} requires id.`);
      if (!isModelJobType(item.job_type)) throw new Error(`${path} case ${item.id} has an unsupported job_type.`);
      if (typeof item.prompt !== "string" || !item.prompt.trim()) throw new Error(`${path} case ${item.id} requires prompt.`);
      if (typeof item.context !== "string" || !item.context.trim()) throw new Error(`${path} case ${item.id} requires context.`);
      if (!item.expected || typeof item.expected !== "object" || Array.isArray(item.expected)) {
        throw new Error(`${path} case ${item.id} requires expected.`);
      }
      const expected = item.expected as Record<string, unknown>;
      if (typeof expected.valid_structured_output !== "boolean" || typeof expected.must_stop !== "boolean") {
        throw new Error(`${path} case ${item.id} has invalid expected booleans.`);
      }
      cases.push({
        id: item.id,
        job_type: item.job_type,
        prompt: item.prompt,
        context: item.context,
        expected: {
          valid_structured_output: expected.valid_structured_output,
          required_record_ids: stringArray(expected.required_record_ids, `${path} case ${item.id} required_record_ids`),
          forbidden_record_ids: stringArray(expected.forbidden_record_ids, `${path} case ${item.id} forbidden_record_ids`),
          must_stop: expected.must_stop,
        },
      });
    }
  }
  return cases;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const provider = required(args, "provider");
  const model = required(args, "model");
  const fingerprintPath = required(args, "fingerprint");
  const seed = required(args, "seed");
  if (process.env.NOVEL_FORGE_RUN_GEMMA_QUALIFICATION !== "1") {
    throw new Error("Real Gemma qualification requires NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1.");
  }
  const repositoryRoot = process.cwd();
  const fingerprint = loadFingerprint(resolve(repositoryRoot, fingerprintPath));
  requireGemmaQualificationConfiguration(process.env, { provider, model, seed, fingerprint });
  const cases = loadCases(repositoryRoot);
  const runId = `individual-${createHash("sha256")
    .update(`${seed}\0${JSON.stringify(fingerprint)}`)
    .digest("hex")
    .slice(0, 16)}`;
  const outputRoot = resolveGemmaQualificationRunRoot(repositoryRoot, runId);
  const result = await runGemmaQualification({
    cases,
    fingerprint,
    provider,
    model,
    seed,
    worker: new PiPrintWorker({ cwd: repositoryRoot }),
    outputRoot,
  });
  const summary = {
    output_root: outputRoot,
    report: result.paths.report,
    prose_review_kit: result.paths.reviewKit,
    sealed_labels: result.paths.labelSeal,
    report_hash: result.report.report_hash,
  };
  console.log(JSON.stringify(summary, null, 2));
  assertGemmaQualificationPromotion(result.report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
