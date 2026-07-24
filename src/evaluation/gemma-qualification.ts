import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema } from "../domain/chapter-contract.js";
import { ClaimExtractionArtifactSchema } from "../domain/claim-audit.js";
import {
  computeGemmaQualificationReportHash,
  type GemmaQualificationCase,
  type GemmaQualificationReport,
} from "../domain/gemma-qualification.js";
import {
  assertGemmaFingerprintMatchesProfile,
  GEMMA_3_12B_QAT_PROFILE_ID,
  type ModelFingerprint,
} from "../domain/model-fingerprint.js";
import { isModelJobType, type ModelJobType } from "../domain/model-job.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { MODEL_EXECUTION_PROFILES } from "../domain/model-execution-profile.js";
import { SceneContractSchema } from "../domain/scene-contract.js";
import { SceneCriticOutputSchema } from "../domain/scene-critic-artifact.js";
import { ScenePatchOutputSchema } from "../domain/scene-patch-artifact.js";
import { ScenePlanOutputSchema } from "../domain/scene-plan-artifact.js";
import { SceneStateDeltaOutputSchema } from "../domain/scene-state-delta-artifact.js";
import {
  parseQualityVerificationOutput,
  QualityEventOutputSchema,
  QualityVerificationOutputSchema,
} from "../application/quality-output.js";
import { parseYaml } from "../infrastructure/yaml.js";

export const GEMMA_QUALIFICATION_EVALUATOR_REVISION = "2.0.0" as const;

const FIXTURE_PATHS = [
  "evals/gemma/fixtures/structured-jobs.yaml",
  "evals/gemma/fixtures/authority-distraction.yaml",
  "evals/gemma/fixtures/dramatized-scene.yaml",
] as const;
const RUBRIC_PATH = "evals/gemma/rubrics/prose-review.md";

export interface GemmaQualificationSource {
  path: string;
  content: string;
}

export interface GemmaQualificationRubric extends GemmaQualificationSource {
  version: string;
}

export interface GemmaQualificationAssets {
  cases: GemmaQualificationCase[];
  fixtureSources: GemmaQualificationSource[];
  rubric: GemmaQualificationRubric;
}

export interface GemmaQualificationArguments {
  provider: string;
  model: string;
  fingerprintPath: string;
  seed: string;
}

export interface GemmaQualificationPaths {
  report: string;
  reviewKit: string;
  labelSeal: string;
}

export interface GemmaQualificationResult {
  report: GemmaQualificationReport;
  paths: GemmaQualificationPaths;
}

interface ContextConstraint {
  recordId: string;
  kind: "REQUIRED" | "FORBIDDEN";
  text: string;
}

interface QualificationResponse {
  structuredOutput?: Record<string, unknown>;
  prose?: string;
}

interface CaseResult {
  item: GemmaQualificationCase;
  sampleId: string;
  firstPassStructured: boolean;
  correctedStructured: boolean;
  response: QualificationResponse | null;
  constraints: ContextConstraint[];
  referencedRecordIds: Set<string>;
  missingRequiredIds: string[];
  forbiddenUsedIds: string[];
  correctStop: boolean;
  severeFailure: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator < 1) throw new Error("Gemma qualification rate denominator must be positive.");
  return numerator / denominator;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...expected, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} has unknown keys: ${unknown.join(", ")}.`);
  const missing = expected.filter((key) => !(key in value));
  if (missing.length) throw new Error(`${label} is missing keys: ${missing.join(", ")}.`);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of nonblank strings.`);
  }
  return [...value] as string[];
}

export function parseGemmaQualificationFixture(text: string, label: string): GemmaQualificationCase[] {
  const value = parseYaml<Record<string, unknown>>(text, undefined, label);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} root must be an object.`);
  exactKeys(value, ["schema_version", "cases"], `${label} root`);
  if (value.schema_version !== "1.0.0" || !Array.isArray(value.cases)) {
    throw new Error(`${label} requires schema_version 1.0.0 and a cases array.`);
  }
  return value.cases.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} case ${index + 1} must be an object.`);
    }
    const item = raw as Record<string, unknown>;
    exactKeys(item, ["id", "job_type", "prompt", "context", "expected"], `${label} case ${index + 1}`);
    if (typeof item.id !== "string" || !item.id.trim()) throw new Error(`${label} case ${index + 1} requires id.`);
    if (!isModelJobType(item.job_type)) throw new Error(`${label} case ${item.id} has an unsupported job_type.`);
    if (typeof item.prompt !== "string" || !item.prompt.trim()) throw new Error(`${label} case ${item.id} requires prompt.`);
    if (typeof item.context !== "string" || !item.context.trim()) throw new Error(`${label} case ${item.id} requires context.`);
    if (!item.expected || typeof item.expected !== "object" || Array.isArray(item.expected)) {
      throw new Error(`${label} case ${item.id} requires expected.`);
    }
    const expected = item.expected as Record<string, unknown>;
    exactKeys(
      expected,
      ["valid_structured_output", "required_record_ids", "forbidden_record_ids", "must_stop"],
      `${label} case ${item.id} expected`,
      ["chapter"],
    );
    if (typeof expected.valid_structured_output !== "boolean" || typeof expected.must_stop !== "boolean") {
      throw new Error(`${label} case ${item.id} has invalid expected booleans.`);
    }
    if (expected.chapter !== undefined
      && (!Number.isInteger(expected.chapter) || Number(expected.chapter) < 1)) {
      throw new Error(`${label} case ${item.id} expected chapter must be a positive integer.`);
    }
    if (item.job_type === "verify-chapter" && expected.chapter === undefined) {
      throw new Error(`${label} case ${item.id} expected chapter is required for verify-chapter.`);
    }
    if (item.job_type !== "verify-chapter" && expected.chapter !== undefined) {
      throw new Error(`${label} case ${item.id} expected chapter is only valid for verify-chapter.`);
    }
    return {
      id: item.id,
      job_type: item.job_type,
      prompt: item.prompt,
      context: item.context,
      expected: {
        valid_structured_output: expected.valid_structured_output,
        required_record_ids: stringArray(expected.required_record_ids, `${label} case ${item.id} required_record_ids`),
        forbidden_record_ids: stringArray(expected.forbidden_record_ids, `${label} case ${item.id} forbidden_record_ids`),
        must_stop: expected.must_stop,
        ...(expected.chapter === undefined ? {} : { chapter: Number(expected.chapter) }),
      },
    };
  });
}

function parseRubric(content: string, path: string): GemmaQualificationRubric {
  const match = content.match(/<!--\s*gemma-prose-rubric-version:\s*([A-Za-z0-9._-]+)\s*-->/);
  if (!match?.[1]) throw new Error(`${path} requires a gemma-prose-rubric-version marker.`);
  return { path, version: match[1], content };
}

export function loadGemmaQualificationAssets(repositoryRoot: string): GemmaQualificationAssets {
  const fixtureSources = FIXTURE_PATHS.map((path) => ({
    path,
    content: readFileSync(resolve(repositoryRoot, path), "utf8"),
  }));
  const cases = fixtureSources.flatMap((source) => parseGemmaQualificationFixture(source.content, source.path));
  const rubricContent = readFileSync(resolve(repositoryRoot, RUBRIC_PATH), "utf8");
  validateCases(cases);
  return { cases, fixtureSources, rubric: parseRubric(rubricContent, RUBRIC_PATH) };
}

export function parseGemmaQualificationArguments(argv: readonly string[]): GemmaQualificationArguments {
  const allowed = new Set(["provider", "model", "fingerprint", "seed"]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) throw new Error(`Unexpected positional argument: ${argument}.`);
    const key = argument.slice(2);
    if (!allowed.has(key)) throw new Error(`Unknown Gemma qualification option: --${key}.`);
    if (values.has(key)) throw new Error(`Gemma qualification option --${key} may be provided only once.`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--") || !value.trim()) throw new Error(`--${key} requires a value.`);
    values.set(key, value.trim());
    index += 1;
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) throw new Error(`--${key} is required.`);
    return value;
  };
  return {
    provider: required("provider"),
    model: required("model"),
    fingerprintPath: required("fingerprint"),
    seed: required("seed"),
  };
}

function stringOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`Gemma fingerprint ${label} must be a nonblank string or null.`);
  return value;
}

export function loadGemmaQualificationFingerprint(path: string): ModelFingerprint {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read Gemma fingerprint ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Gemma fingerprint must be one JSON object.");
  const object = value as Record<string, unknown>;
  exactKeys(object, [
    "schema_version", "profile_id", "provider", "model", "backend", "backend_version",
    "quantization", "context_window_tokens", "maximum_output_tokens", "chat_template_hash", "model_file_hash",
  ], "Gemma fingerprint");
  const integer = (key: string): number => {
    const candidate = object[key];
    if (!Number.isInteger(candidate) || Number(candidate) < 1) throw new Error(`Gemma fingerprint ${key} must be a positive integer.`);
    return Number(candidate);
  };
  if (object.schema_version !== "1.0.0") throw new Error("Gemma fingerprint schema_version must be 1.0.0.");
  if (object.profile_id !== GEMMA_3_12B_QAT_PROFILE_ID) {
    throw new Error(`Gemma fingerprint profile_id must be ${GEMMA_3_12B_QAT_PROFILE_ID}.`);
  }
  for (const key of ["provider", "model", "backend"] as const) {
    if (typeof object[key] !== "string" || !object[key].trim()) throw new Error(`Gemma fingerprint ${key} must be nonblank.`);
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

function structuredSchema(jobType: ModelJobType): TSchema | null {
  switch (jobType) {
    case "compile-chapter-contract": return ChapterContractSchema;
    case "compile-scene-contract": return SceneContractSchema;
    case "plan-scene": return ScenePlanOutputSchema;
    case "extract-state-delta": return SceneStateDeltaOutputSchema;
    case "extract-factual-claims": return ClaimExtractionArtifactSchema;
    case "critic-continuity": return SceneCriticOutputSchema;
    case "patch-spans": return ScenePatchOutputSchema;
    case "synthesize-event-output": return QualityEventOutputSchema;
    case "verify-chapter": return QualityVerificationOutputSchema;
    default: return null;
  }
}

function parseConstraints(item: GemmaQualificationCase): ContextConstraint[] {
  const constraints: ContextConstraint[] = [];
  for (const [index, line] of item.context.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.match(/^RECORD ([A-Za-z0-9][A-Za-z0-9._-]*) \| (REQUIRED|FORBIDDEN) \| (.+)$/);
    if (!match?.[1] || !match[2] || !match[3]?.trim()) {
      throw new Error(`Gemma qualification case ${item.id} context line ${index + 1} must use RECORD <id> | REQUIRED|FORBIDDEN | <constraint>.`);
    }
    constraints.push({ recordId: match[1], kind: match[2] as ContextConstraint["kind"], text: match[3].trim() });
  }
  const byId = new Map(constraints.map((constraint) => [constraint.recordId, constraint]));
  for (const recordId of item.expected.required_record_ids) {
    if (byId.get(recordId)?.kind !== "REQUIRED") throw new Error(`Case ${item.id} required record ${recordId} lacks a REQUIRED context constraint.`);
  }
  for (const recordId of item.expected.forbidden_record_ids) {
    if (byId.get(recordId)?.kind !== "FORBIDDEN") throw new Error(`Case ${item.id} forbidden record ${recordId} lacks a FORBIDDEN context constraint.`);
  }
  return constraints;
}

function validateCases(cases: readonly GemmaQualificationCase[]): Array<{ item: GemmaQualificationCase; constraints: ContextConstraint[] }> {
  if (!cases.length) throw new Error("Gemma qualification requires at least one case.");
  const ordered = [...cases].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const ids = new Set<string>();
  for (const item of ordered) {
    if (!item.id.trim() || !/^[a-z0-9][a-z0-9._-]*$/i.test(item.id)) throw new Error("Gemma qualification case IDs must be safe identifiers.");
    if (ids.has(item.id)) throw new Error(`Duplicate Gemma qualification case ID: ${item.id}.`);
    ids.add(item.id);
    if (!item.prompt.trim() || !item.context.trim()) throw new Error(`Gemma qualification case ${item.id} requires prompt and context.`);
    if (item.expected.valid_structured_output) {
      if (!structuredSchema(item.job_type)) throw new Error(`Gemma qualification has no trusted structured validator for ${item.job_type}.`);
    } else if (item.job_type !== "draft-scene") {
      throw new Error(`Only draft-scene qualification cases may produce prose.`);
    }
    for (const list of [item.expected.required_record_ids, item.expected.forbidden_record_ids]) {
      if (list.some((recordId) => !recordId.trim()) || new Set(list).size !== list.length) {
        throw new Error(`Gemma qualification case ${item.id} has invalid record obligations.`);
      }
    }
    const forbidden = new Set(item.expected.forbidden_record_ids);
    if (item.expected.required_record_ids.some((recordId) => forbidden.has(recordId))) {
      throw new Error(`Gemma qualification case ${item.id} cannot require and forbid the same record.`);
    }
    if (item.job_type === "verify-chapter"
      && (!Number.isInteger(item.expected.chapter) || Number(item.expected.chapter) < 1)) {
      throw new Error(`Gemma qualification case ${item.id} requires a positive expected chapter.`);
    }
    if (item.job_type !== "verify-chapter" && item.expected.chapter !== undefined) {
      throw new Error(`Gemma qualification case ${item.id} may specify an expected chapter only for verify-chapter.`);
    }
  }
  if (!ordered.some((item) => item.expected.valid_structured_output)) {
    throw new Error("Gemma qualification requires at least one structured gate case.");
  }
  if (!ordered.some((item) => item.expected.required_record_ids.length > 0)) {
    throw new Error("Gemma qualification requires at least one required-record obligation.");
  }
  if (!ordered.some((item) => item.expected.must_stop)) {
    throw new Error("Gemma qualification requires at least one stop/escalation obligation.");
  }
  return ordered.map((item) => ({ item, constraints: parseConstraints(item) }));
}

function parseResponse(text: string, item: GemmaQualificationCase): QualificationResponse | null {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (item.expected.valid_structured_output) {
    if (Object.keys(object).length !== 1 || !("structured_output" in object)) return null;
    const schema = structuredSchema(item.job_type);
    if (!schema || !Value.Check(schema, object.structured_output)) return null;
    if (item.job_type === "verify-chapter") {
      try {
        parseQualityVerificationOutput(
          JSON.stringify(object.structured_output),
          item.expected.chapter!,
          `Gemma qualification case ${item.id} verification output`,
        );
      } catch {
        return null;
      }
    }
    return { structuredOutput: object.structured_output as Record<string, unknown> };
  }
  if (Object.keys(object).length !== 1 || typeof object.prose !== "string" || !object.prose.trim()) return null;
  return { prose: object.prose };
}

function referencedIds(
  jobType: ModelJobType,
  output: Record<string, unknown>,
  obligations: readonly string[],
): Set<string> {
  const object = output as any;
  let values: string[] = [];
  switch (jobType) {
    case "compile-chapter-contract":
    case "compile-scene-contract":
      values = object.required_record_ids;
      break;
    case "plan-scene":
      values = object.evidence_record_ids;
      break;
    case "extract-state-delta":
      values = object.mutations.map((item: any) => item.record_id);
      break;
    case "extract-factual-claims":
      values = object.claims.flatMap((claim: any) => [...claim.research_ids, ...claim.invention_ids]);
      break;
    case "critic-continuity":
    case "patch-spans":
    case "synthesize-event-output":
    case "verify-chapter":
      values = [];
      break;
  }
  return new Set(values.filter((value) => obligations.includes(value)));
}

function derivedStop(jobType: ModelJobType, output: Record<string, unknown>): boolean {
  if (jobType === "verify-chapter") return output.verdict === "reject";
  if (jobType === "critic-continuity") return output.verdict === "block";
  return false;
}

function includesConstraint(text: string, constraint: string): boolean {
  return text.toLocaleLowerCase("en-US").includes(constraint.toLocaleLowerCase("en-US"));
}

function evaluateCase(
  item: GemmaQualificationCase,
  constraints: ContextConstraint[],
  sampleId: string,
  firstPassStructured: boolean,
  correctedStructured: boolean,
  response: QualificationResponse | null,
): CaseResult {
  const obligations = [...item.expected.required_record_ids, ...item.expected.forbidden_record_ids];
  const outputText = response?.structuredOutput ? stableJson(response.structuredOutput) : response?.prose ?? "";
  const references = response?.structuredOutput
    ? referencedIds(item.job_type, response.structuredOutput, obligations)
    : new Set(constraints
      .filter((constraint) => includesConstraint(outputText, constraint.text))
      .map((constraint) => constraint.recordId));
  const missingRequiredIds = item.expected.required_record_ids.filter((recordId) => !references.has(recordId));
  const forbiddenUsedIds = item.expected.forbidden_record_ids.filter((recordId) => {
    const constraint = constraints.find((candidate) => candidate.recordId === recordId);
    return references.has(recordId) || Boolean(constraint && includesConstraint(outputText, constraint.text));
  });
  const stop = response?.structuredOutput ? derivedStop(item.job_type, response.structuredOutput) : false;
  const correctStop = response !== null && stop === item.expected.must_stop;
  const contradiction = constraints
    .filter((constraint) => constraint.kind === "FORBIDDEN")
    .some((constraint) => includesConstraint(outputText, constraint.text));
  return {
    item,
    sampleId,
    firstPassStructured,
    correctedStructured,
    response,
    constraints,
    referencedRecordIds: references,
    missingRequiredIds,
    forbiddenUsedIds,
    correctStop,
    severeFailure: !correctedStructured || missingRequiredIds.length > 0 || forbiddenUsedIds.length > 0 || !correctStop || contradiction,
  };
}

function opaqueSampleId(seed: string, caseId: string): string {
  return `GQ-${sha256(`${seed}\0${caseId}`).slice(0, 16).toUpperCase()}`;
}

function schemaInstruction(jobType: ModelJobType): string {
  const names: Partial<Record<ModelJobType, string>> = {
    "compile-chapter-contract": "ChapterContractSchema",
    "compile-scene-contract": "SceneContractSchema",
    "plan-scene": "ScenePlanOutputSchema",
    "extract-state-delta": "SceneStateDeltaOutputSchema",
    "extract-factual-claims": "ClaimExtractionArtifactSchema",
    "critic-continuity": "SceneCriticOutputSchema",
    "patch-spans": "ScenePatchOutputSchema",
    "synthesize-event-output": "QualityEventOutputSchema",
    "verify-chapter": "QualityVerificationOutputSchema",
  };
  return `The structured_output value must satisfy the exact ${names[jobType]} contract.`;
}

function initialPrompt(item: GemmaQualificationCase): string {
  return [
    "GEMMA INDIVIDUAL-JOB QUALIFICATION",
    item.prompt,
    "Return exactly one JSON object and no surrounding text.",
    item.expected.valid_structured_output
      ? `The envelope must have exactly one key named structured_output. ${schemaInstruction(item.job_type)}`
      : "The envelope must have exactly one key named prose with a nonblank string value.",
    "Use governing records and never use forbidden records. Do not add detached self-ratings or record lists.",
  ].join("\n");
}

function correctionPrompt(item: GemmaQualificationCase): string {
  return [
    "GEMMA QUALIFICATION CORRECTION",
    "Your previous response failed the trusted output validator.",
    "This is the single allowed correction attempt.",
    initialPrompt(item),
  ].join("\n");
}

async function executeCase(input: {
  item: GemmaQualificationCase;
  constraints: ContextConstraint[];
  sampleId: string;
  provider: string;
  model: string;
  worker: Pick<QualityWorker, "run">;
}): Promise<CaseResult> {
  const requestBase = {
    stage: "qualification",
    pass: "verification" as const,
    jobType: input.item.job_type,
    provider: input.provider,
    model: input.model,
    timeoutMs: 10 * 60_000,
  };
  const first = await input.worker.run({
    ...requestBase,
    callId: `${input.sampleId}-A1`,
    prompt: initialPrompt(input.item),
    context: input.item.context,
  });
  let response = parseResponse(first.text, input.item);
  const firstPassStructured = response !== null;
  let correctedStructured = firstPassStructured;
  if (!firstPassStructured) {
    const corrected = await input.worker.run({
      ...requestBase,
      callId: `${input.sampleId}-A2`,
      prompt: correctionPrompt(input.item),
      context: input.item.context,
    });
    response = parseResponse(corrected.text, input.item);
    correctedStructured = response !== null;
  }
  return evaluateCase(
    input.item,
    input.constraints,
    input.sampleId,
    firstPassStructured,
    correctedStructured,
    response,
  );
}

function canonicalFingerprint(fingerprint: ModelFingerprint): ModelFingerprint {
  return {
    schema_version: fingerprint.schema_version,
    profile_id: fingerprint.profile_id,
    provider: fingerprint.provider,
    model: fingerprint.model,
    backend: fingerprint.backend,
    backend_version: fingerprint.backend_version,
    quantization: fingerprint.quantization,
    context_window_tokens: fingerprint.context_window_tokens,
    maximum_output_tokens: fingerprint.maximum_output_tokens,
    chat_template_hash: fingerprint.chat_template_hash,
    model_file_hash: fingerprint.model_file_hash,
  };
}

function provenance(input: {
  fixtureSources: readonly GemmaQualificationSource[];
  rubric: GemmaQualificationRubric;
  seed: string;
}): GemmaQualificationReport["provenance"] {
  if (!input.fixtureSources.length) throw new Error("Gemma qualification requires frozen fixture sources.");
  if (!input.rubric.path.trim() || !input.rubric.version.trim() || !input.rubric.content.trim()) {
    throw new Error("Gemma qualification requires a versioned prose rubric.");
  }
  const ordered = [...input.fixtureSources].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (ordered.some((source) => !source.path.trim() || !source.content.trim()) || new Set(ordered.map((source) => source.path)).size !== ordered.length) {
    throw new Error("Gemma qualification fixture sources require unique paths and nonblank exact content.");
  }
  return {
    evaluator_revision: GEMMA_QUALIFICATION_EVALUATOR_REVISION,
    fixture_suite_hash: sha256(stableJson(ordered)),
    rubric_hash: sha256(stableJson(input.rubric)),
    rubric_version: input.rubric.version,
    seed_hash: sha256(input.seed),
  };
}

function reserveArtifactSet(outputRoot: string): { lock: string; staging: string } {
  const parent = dirname(outputRoot);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (lstatSync(parent).isSymbolicLink()) throw new Error("Gemma qualification output parent cannot be a symbolic link.");
  const lock = `${outputRoot}.lock`;
  if (existsSync(outputRoot)) throw new Error(`Gemma qualification output already exists: ${outputRoot}.`);
  try {
    mkdirSync(lock, { mode: 0o700 });
  } catch {
    throw new Error(`Gemma qualification run is already reserved or in progress: ${outputRoot}.`);
  }
  if (existsSync(outputRoot)) {
    rmSync(lock, { recursive: true, force: true });
    throw new Error(`Gemma qualification output already exists: ${outputRoot}.`);
  }
  return { lock, staging: `${outputRoot}.staging-${process.pid}-${randomBytes(6).toString("hex")}` };
}

function artifactPaths(root: string): GemmaQualificationPaths {
  return {
    report: join(root, "gemma-qualification-report.json"),
    reviewKit: join(root, "gemma-prose-review-kit.md"),
    labelSeal: join(root, "gemma-label-seal.json"),
  };
}

function publishArtifacts(input: {
  outputRoot: string;
  reservation: { lock: string; staging: string };
  report: GemmaQualificationReport;
  results: readonly CaseResult[];
  beforeArtifactPublish?: () => void;
}): GemmaQualificationPaths {
  let published = false;
  try {
    mkdirSync(input.reservation.staging, { mode: 0o700 });
    const staged = artifactPaths(input.reservation.staging);
    const prose = input.results
      .filter((result) => result.response?.prose)
      .sort((left, right) => {
        const leftKey = sha256(`${input.report.report_hash}\0${left.sampleId}`);
        const rightKey = sha256(`${input.report.report_hash}\0${right.sampleId}`);
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      });
    const review = prose.length
      ? `${prose.map((result, index) => {
        const required = result.constraints.filter((constraint) => constraint.kind === "REQUIRED");
        const forbidden = result.constraints.filter((constraint) => constraint.kind === "FORBIDDEN");
        return [
          `# Sample ${index + 1}`,
          "",
          `Opaque ID: ${result.sampleId}`,
          "",
          "## Blinded governing evidence",
          ...required.map((constraint) => `- Governing constraint: ${constraint.text}`),
          ...forbidden.map((constraint) => `- Forbidden outcome: ${constraint.text}`),
          `- Expected response posture: ${result.item.expected.must_stop ? "stop/escalate" : "continue"}`,
          "",
          "## Prose",
          "",
          result.response!.prose!,
        ].join("\n");
      }).join("\n\n---\n\n")}\n`
      : "# Gemma Prose Review Kit\n\nNo prose samples were generated.\n";
    const labelSeal = {
      schema_version: "1.0.0",
      labels: prose.map((result) => ({
        sample_id: result.sampleId,
        case_id: result.item.id,
        job_type: result.item.job_type,
      })),
    };
    writeFileSync(staged.report, `${JSON.stringify(input.report, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    writeFileSync(staged.reviewKit, review, { encoding: "utf8", mode: 0o600, flag: "wx" });
    writeFileSync(staged.labelSeal, `${JSON.stringify(labelSeal, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    input.beforeArtifactPublish?.();
    renameSync(input.reservation.staging, input.outputRoot);
    published = true;
    for (const path of Object.values(artifactPaths(input.outputRoot))) chmodSync(path, 0o600);
    rmSync(input.reservation.lock, { recursive: true, force: true });
    return artifactPaths(input.outputRoot);
  } catch (error) {
    rmSync(input.reservation.staging, { recursive: true, force: true });
    if (published) rmSync(input.outputRoot, { recursive: true, force: true });
    throw error;
  }
}

function assertFingerprintBinding(input: {
  provider: string;
  model: string;
  fingerprint: ModelFingerprint;
}): void {
  if (!input.provider.trim()) throw new Error("Gemma qualification requires an explicit provider.");
  if (!input.model.trim()) throw new Error("Gemma qualification requires an explicit model.");
  if (input.fingerprint.schema_version !== "1.0.0") throw new Error("Gemma qualification fingerprint schema version must be 1.0.0.");
  assertGemmaFingerprintMatchesProfile(input.fingerprint, MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"]);
  if (input.provider !== input.fingerprint.provider) throw new Error("Gemma qualification provider must exactly match the fingerprint provider.");
  if (input.model !== input.fingerprint.model) throw new Error("Gemma qualification model must exactly match the fingerprint model.");
}

export function requireGemmaQualificationConfiguration(
  env: Readonly<Record<string, string | undefined>>,
  input: { provider: string; model: string; seed: string; fingerprint: ModelFingerprint },
): void {
  if (env.NOVEL_FORGE_RUN_GEMMA_QUALIFICATION !== "1") {
    throw new Error("Real Gemma qualification requires NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1.");
  }
  if (!input.seed.trim()) throw new Error("Gemma qualification requires a nonblank seed.");
  assertFingerprintBinding(input);
}

export function resolveGemmaQualificationRunRoot(repositoryRoot: string, runId: string): string {
  if (!runId || isAbsolute(runId) || runId === "." || runId === ".."
    || runId.includes("/") || runId.includes("\\") || !/^[a-z0-9][a-z0-9._-]*$/i.test(runId)) {
    throw new Error("Gemma qualification run ID must be one safe path segment.");
  }
  const runsRoot = resolve(repositoryRoot, "evals", "gemma", "runs");
  let existing = resolve(repositoryRoot);
  for (const segment of ["evals", "gemma", "runs"]) {
    existing = join(existing, segment);
    if (existsSync(existing) && lstatSync(existing).isSymbolicLink()) {
      throw new Error("Gemma qualification runs path cannot contain symbolic links.");
    }
  }
  const outputRoot = resolve(runsRoot, runId);
  if (!outputRoot.startsWith(`${runsRoot}${sep}`)) throw new Error("Gemma qualification run ID escapes the runs directory.");
  return outputRoot;
}

export async function runGemmaQualification(input: {
  cases: readonly GemmaQualificationCase[];
  fingerprint: ModelFingerprint;
  provider: string;
  model: string;
  seed: string;
  worker: Pick<QualityWorker, "run">;
  outputRoot: string;
  fixtureSources: readonly GemmaQualificationSource[];
  rubric: GemmaQualificationRubric;
  beforeArtifactPublish?: () => void;
}): Promise<GemmaQualificationResult> {
  if (!input.seed.trim()) throw new Error("Gemma qualification requires a nonblank seed.");
  assertFingerprintBinding(input);
  const reportProvenance = provenance(input);
  const frozenCases = input.fixtureSources.flatMap(
    (source) => parseGemmaQualificationFixture(source.content, source.path),
  );
  const canonicalCases = (cases: readonly GemmaQualificationCase[]): string => stableJson(
    [...cases].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  if (canonicalCases(input.cases) !== canonicalCases(frozenCases)) {
    throw new Error("Gemma qualification cases must exactly match the parsed frozen fixture sources.");
  }
  const cases = validateCases(frozenCases);
  const reservation = reserveArtifactSet(input.outputRoot);
  try {
    const results: CaseResult[] = [];
    for (const { item, constraints } of cases) {
      results.push(await executeCase({
        item,
        constraints,
        sampleId: opaqueSampleId(input.seed, item.id),
        provider: input.provider,
        model: input.model,
        worker: input.worker,
      }));
    }
    const structured = results.filter((result) => result.item.expected.valid_structured_output);
    const requiredCount = results.reduce((sum, result) => sum + result.item.expected.required_record_ids.length, 0);
    const usedRequiredCount = results.reduce(
      (sum, result) => sum + result.item.expected.required_record_ids.length - result.missingRequiredIds.length,
      0,
    );
    const unsigned: Omit<GemmaQualificationReport, "report_hash"> = {
      schema_version: "1.0.0",
      fingerprint: canonicalFingerprint(input.fingerprint),
      provenance: reportProvenance,
      case_count: results.length,
      first_pass_structured_rate: ratio(structured.filter((result) => result.firstPassStructured).length, structured.length),
      corrected_structured_rate: ratio(structured.filter((result) => result.correctedStructured).length, structured.length),
      required_record_rate: ratio(usedRequiredCount, requiredCount),
      forbidden_record_uses: results.reduce((sum, result) => sum + result.forbiddenUsedIds.length, 0),
      correct_stop_rate: ratio(results.filter((result) => result.correctStop).length, results.length),
      severe_failure_count: results.filter((result) => result.severeFailure).length,
    };
    const report: GemmaQualificationReport = {
      ...unsigned,
      report_hash: computeGemmaQualificationReportHash(unsigned),
    };
    return {
      report,
      paths: publishArtifacts({
        outputRoot: input.outputRoot,
        reservation,
        report,
        results,
        ...(input.beforeArtifactPublish ? { beforeArtifactPublish: input.beforeArtifactPublish } : {}),
      }),
    };
  } catch (error) {
    rmSync(reservation.staging, { recursive: true, force: true });
    rmSync(reservation.lock, { recursive: true, force: true });
    throw error;
  }
}
