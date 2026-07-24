import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import type {
  GemmaQualificationCase,
  GemmaQualificationReport,
} from "../domain/gemma-qualification.js";
import {
  assertGemmaFingerprintMatchesProfile,
  type ModelFingerprint,
} from "../domain/model-fingerprint.js";
import { isModelJobType } from "../domain/model-job.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { MODEL_EXECUTION_PROFILES } from "../domain/model-execution-profile.js";

export interface GemmaQualificationPaths {
  report: string;
  reviewKit: string;
  labelSeal: string;
}

export interface GemmaQualificationResult {
  report: GemmaQualificationReport;
  paths: GemmaQualificationPaths;
}

interface QualificationResponse {
  structuredOutput?: Record<string, unknown>;
  prose?: string;
  recordIds: string[];
  mustStop: boolean;
  severeFailures: string[];
}

interface CaseResult {
  caseId: string;
  sampleId: string;
  jobType: GemmaQualificationCase["job_type"];
  firstPassStructured: boolean;
  correctedStructured: boolean;
  response: QualificationResponse | null;
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
  return denominator === 0 ? 1 : numerator / denominator;
}

function parseResponse(text: string): QualificationResponse | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (!Array.isArray(object.record_ids)
    || object.record_ids.some((item) => typeof item !== "string" || !item.trim())
    || typeof object.must_stop !== "boolean"
    || !Array.isArray(object.severe_failures)
    || object.severe_failures.some((item) => typeof item !== "string" || !item.trim())) {
    return null;
  }
  const structuredOutput = object.structured_output;
  const prose = object.prose;
  if (structuredOutput !== undefined
    && (!structuredOutput || typeof structuredOutput !== "object" || Array.isArray(structuredOutput))) {
    return null;
  }
  if (prose !== undefined && (typeof prose !== "string" || !prose.trim())) return null;
  if (structuredOutput === undefined && prose === undefined) return null;
  return {
    ...(structuredOutput === undefined ? {} : { structuredOutput: structuredOutput as Record<string, unknown> }),
    ...(prose === undefined ? {} : { prose }),
    recordIds: [...object.record_ids] as string[],
    mustStop: object.must_stop,
    severeFailures: [...object.severe_failures] as string[],
  };
}

function validatesExpectedShape(
  response: QualificationResponse | null,
  expectedStructured: boolean,
): boolean {
  if (!response) return false;
  return expectedStructured
    ? response.structuredOutput !== undefined
    : response.prose !== undefined;
}

function validateCases(cases: readonly GemmaQualificationCase[]): GemmaQualificationCase[] {
  if (!cases.length) throw new Error("Gemma qualification requires at least one case.");
  const ids = new Set<string>();
  const ordered = [...cases].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  for (const item of ordered) {
    if (!item.id.trim() || !/^[a-z0-9][a-z0-9._-]*$/i.test(item.id)) {
      throw new Error("Gemma qualification case IDs must be nonblank safe identifiers.");
    }
    if (ids.has(item.id)) throw new Error(`Duplicate Gemma qualification case ID: ${item.id}.`);
    ids.add(item.id);
    if (!isModelJobType(item.job_type)) {
      throw new Error(`Gemma qualification case ${item.id} has an unsupported job type.`);
    }
    if (!item.prompt.trim() || !item.context.trim()) {
      throw new Error(`Gemma qualification case ${item.id} requires nonblank prompt and context.`);
    }
    for (const [label, recordIds] of [
      ["required", item.expected.required_record_ids],
      ["forbidden", item.expected.forbidden_record_ids],
    ] as const) {
      if (recordIds.some((recordId) => !recordId.trim())) {
        throw new Error(`Gemma qualification case ${item.id} has a blank ${label} record ID.`);
      }
      if (new Set(recordIds).size !== recordIds.length) {
        throw new Error(`Gemma qualification case ${item.id} has duplicate ${label} record IDs.`);
      }
    }
    const forbidden = new Set(item.expected.forbidden_record_ids);
    if (item.expected.required_record_ids.some((recordId) => forbidden.has(recordId))) {
      throw new Error(`Gemma qualification case ${item.id} cannot require and forbid the same record ID.`);
    }
  }
  return ordered;
}

function opaqueSampleId(seed: string, caseId: string): string {
  return `GQ-${sha256(`${seed}\0${caseId}`).slice(0, 16).toUpperCase()}`;
}

function correctionPrompt(expectedStructured: boolean): string {
  return [
    "GEMMA QUALIFICATION CORRECTION",
    "Your previous response was not valid for this qualification case.",
    "Return exactly one JSON object and no surrounding text.",
    expectedStructured
      ? "Required keys: structured_output (object), record_ids (string array), must_stop (boolean), severe_failures (string array)."
      : "Required keys: prose (nonblank string), record_ids (string array), must_stop (boolean), severe_failures (string array).",
    "This is the single allowed correction attempt.",
  ].join("\n");
}

function initialPrompt(item: GemmaQualificationCase): string {
  return [
    "GEMMA INDIVIDUAL-JOB QUALIFICATION",
    item.prompt,
    "Return exactly one JSON object and no surrounding text.",
    item.expected.valid_structured_output
      ? "Required keys: structured_output (object), record_ids (string array), must_stop (boolean), severe_failures (string array)."
      : "Required keys: prose (nonblank string), record_ids (string array), must_stop (boolean), severe_failures (string array).",
  ].join("\n");
}

async function executeCase(input: {
  item: GemmaQualificationCase;
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
  let response = parseResponse(first.text);
  const firstPassStructured = validatesExpectedShape(response, input.item.expected.valid_structured_output);
  let correctedStructured = firstPassStructured;
  if (!firstPassStructured) {
    const corrected = await input.worker.run({
      ...requestBase,
      callId: `${input.sampleId}-A2`,
      prompt: `${correctionPrompt(input.item.expected.valid_structured_output)}\n\n${initialPrompt(input.item)}`,
      context: input.item.context,
    });
    response = parseResponse(corrected.text);
    correctedStructured = validatesExpectedShape(response, input.item.expected.valid_structured_output);
  }
  return {
    caseId: input.item.id,
    sampleId: input.sampleId,
    jobType: input.item.job_type,
    firstPassStructured,
    correctedStructured,
    response,
  };
}

function atomicWrite(path: string, content: string, mode = 0o600): void {
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  try {
    writeFileSync(temporary, content, { encoding: "utf8", mode, flag: "wx" });
    renameSync(temporary, path);
    chmodSync(path, mode);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function writeArtifacts(input: {
  outputRoot: string;
  report: GemmaQualificationReport;
  results: readonly CaseResult[];
}): GemmaQualificationPaths {
  if (existsSync(input.outputRoot) && lstatSync(input.outputRoot).isSymbolicLink()) {
    throw new Error("Gemma qualification output root cannot be a symbolic link.");
  }
  mkdirSync(input.outputRoot, { recursive: true, mode: 0o700 });
  chmodSync(input.outputRoot, 0o700);
  const paths = {
    report: join(input.outputRoot, "gemma-qualification-report.json"),
    reviewKit: join(input.outputRoot, "gemma-prose-review-kit.md"),
    labelSeal: join(input.outputRoot, "gemma-label-seal.json"),
  };
  const prose = input.results
    .filter((result) => result.response?.prose)
    .sort((left, right) => {
      const leftKey = sha256(`${input.report.report_hash}\0${left.sampleId}`);
      const rightKey = sha256(`${input.report.report_hash}\0${right.sampleId}`);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  const reviewKit = prose.length
    ? `${prose.map((result, index) => [
      `# Sample ${index + 1}`,
      "",
      `Opaque ID: ${result.sampleId}`,
      "",
      result.response!.prose!,
    ].join("\n")).join("\n\n---\n\n")}\n`
    : "# Gemma Prose Review Kit\n\nNo prose samples were generated.\n";
  const labelSeal = {
    schema_version: "1.0.0",
    labels: prose.map((result) => ({
      sample_id: result.sampleId,
      case_id: result.caseId,
      job_type: result.jobType,
    })),
  };
  for (const path of Object.values(paths)) {
    if (existsSync(path)) throw new Error(`Gemma qualification artifact already exists: ${path}.`);
  }
  atomicWrite(paths.report, `${JSON.stringify(input.report, null, 2)}\n`);
  atomicWrite(paths.reviewKit, reviewKit);
  atomicWrite(paths.labelSeal, `${JSON.stringify(labelSeal, null, 2)}\n`);
  return paths;
}

export function requireGemmaQualificationConfiguration(
  env: Readonly<Record<string, string | undefined>>,
  input: {
    provider: string;
    model: string;
    seed: string;
    fingerprint: ModelFingerprint;
  },
): void {
  if (env.NOVEL_FORGE_RUN_GEMMA_QUALIFICATION !== "1") {
    throw new Error("Real Gemma qualification requires NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1.");
  }
  if (!input.provider.trim()) throw new Error("Gemma qualification requires an explicit provider.");
  if (!input.model.trim()) throw new Error("Gemma qualification requires an explicit model.");
  if (!input.seed.trim()) throw new Error("Gemma qualification requires a nonblank seed.");
  assertFingerprintBinding(input);
}

function assertFingerprintBinding(input: {
  provider: string;
  model: string;
  fingerprint: ModelFingerprint;
}): void {
  if (!input.provider.trim()) throw new Error("Gemma qualification requires an explicit provider.");
  if (!input.model.trim()) throw new Error("Gemma qualification requires an explicit model.");
  if (input.fingerprint.schema_version !== "1.0.0") {
    throw new Error("Gemma qualification fingerprint schema version must be 1.0.0.");
  }
  assertGemmaFingerprintMatchesProfile(
    input.fingerprint,
    MODEL_EXECUTION_PROFILES["gemma-3-12b-it-qat-q4_0"],
  );
  if (input.provider !== input.fingerprint.provider) {
    throw new Error("Gemma qualification provider must exactly match the fingerprint provider.");
  }
  if (input.model !== input.fingerprint.model) {
    throw new Error("Gemma qualification model must exactly match the fingerprint model.");
  }
}

export function resolveGemmaQualificationRunRoot(repositoryRoot: string, runId: string): string {
  if (!runId || isAbsolute(runId) || runId === "." || runId === ".."
    || runId.includes("/") || runId.includes("\\")
    || !/^[a-z0-9][a-z0-9._-]*$/i.test(runId)) {
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
  if (!outputRoot.startsWith(`${runsRoot}${sep}`)) {
    throw new Error("Gemma qualification run ID escapes the runs directory.");
  }
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
}): Promise<GemmaQualificationResult> {
  if (!input.seed.trim()) throw new Error("Gemma qualification requires a nonblank seed.");
  assertFingerprintBinding(input);
  const cases = validateCases(input.cases);
  const results: CaseResult[] = [];
  for (const item of cases) {
    results.push(await executeCase({
      item,
      sampleId: opaqueSampleId(input.seed, item.id),
      provider: input.provider,
      model: input.model,
      worker: input.worker,
    }));
  }

  const structured = results.filter((result) => {
    const item = cases.find((candidate) => candidate.id === result.caseId)!;
    return item.expected.valid_structured_output;
  });
  let requiredRecords = 0;
  let presentRequiredRecords = 0;
  let forbiddenRecordUses = 0;
  let correctStops = 0;
  let severeFailures = 0;
  for (const [index, result] of results.entries()) {
    const item = cases[index]!;
    const used = result.response?.recordIds ?? [];
    requiredRecords += item.expected.required_record_ids.length;
    presentRequiredRecords += item.expected.required_record_ids.filter((recordId) => used.includes(recordId)).length;
    forbiddenRecordUses += item.expected.forbidden_record_ids
      .reduce((count, recordId) => count + used.filter((usedId) => usedId === recordId).length, 0);
    if (result.response?.mustStop === item.expected.must_stop) correctStops += 1;
    severeFailures += result.response?.severeFailures.length ?? 1;
  }
  const canonicalFingerprint: ModelFingerprint = {
    schema_version: input.fingerprint.schema_version,
    profile_id: input.fingerprint.profile_id,
    provider: input.fingerprint.provider,
    model: input.fingerprint.model,
    backend: input.fingerprint.backend,
    backend_version: input.fingerprint.backend_version,
    quantization: input.fingerprint.quantization,
    context_window_tokens: input.fingerprint.context_window_tokens,
    maximum_output_tokens: input.fingerprint.maximum_output_tokens,
    chat_template_hash: input.fingerprint.chat_template_hash,
    model_file_hash: input.fingerprint.model_file_hash,
  };
  const unsigned = {
    schema_version: "1.0.0" as const,
    fingerprint: canonicalFingerprint,
    case_count: cases.length,
    first_pass_structured_rate: ratio(
      structured.filter((result) => result.firstPassStructured).length,
      structured.length,
    ),
    corrected_structured_rate: ratio(
      structured.filter((result) => result.correctedStructured).length,
      structured.length,
    ),
    required_record_rate: ratio(presentRequiredRecords, requiredRecords),
    forbidden_record_uses: forbiddenRecordUses,
    correct_stop_rate: ratio(correctStops, cases.length),
    severe_failure_count: severeFailures,
  };
  const report: GemmaQualificationReport = {
    ...unsigned,
    report_hash: sha256(stableJson(unsigned)),
  };
  return {
    report,
    paths: writeArtifacts({ outputRoot: input.outputRoot, report, results }),
  };
}
