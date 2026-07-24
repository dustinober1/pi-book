import assert from "node:assert/strict";
import { chmodSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type { GemmaQualificationCase, GemmaQualificationReport } from "../src/domain/gemma-qualification.js";
import {
  assertGemmaQualificationPromotion,
  evaluateGemmaQualificationPromotion,
} from "../src/domain/gemma-qualification.js";
import {
  requireGemmaQualificationConfiguration,
  resolveGemmaQualificationRunRoot,
  runGemmaQualification,
} from "../src/evaluation/gemma-qualification.js";

const fingerprint = {
  schema_version: "1.0.0",
  profile_id: "gemma-3-12b-it-qat-q4_0",
  provider: "local",
  model: "google/gemma-3-12b-it-qat-q4_0-gguf",
  backend: "llama.cpp",
  backend_version: "b6000",
  quantization: "Q4_0",
  context_window_tokens: 16_384,
  maximum_output_tokens: 4_096,
  chat_template_hash: "template-hash",
  model_file_hash: "model-hash",
} as const;

function qualificationCase(
  id: string,
  overrides: Partial<GemmaQualificationCase["expected"]> = {},
): GemmaQualificationCase {
  return {
    id,
    job_type: "extract-state-delta",
    prompt: `PRIVATE_PROMPT_${id}`,
    context: `PRIVATE_CONTEXT_${id}`,
    expected: {
      valid_structured_output: true,
      required_record_ids: [`REQ-${id}`],
      forbidden_record_ids: [`FORBIDDEN-${id}`],
      must_stop: false,
      ...overrides,
    },
  };
}

function response(id: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    structured_output: { status: "ok" },
    record_ids: [`REQ-${id}`],
    must_stop: false,
    severe_failures: [],
    ...overrides,
  });
}

class ScriptedWorker implements Pick<QualityWorker, "run"> {
  readonly requests: QualityWorkerRequest[] = [];
  readonly #responses: string[];

  constructor(responses: string[]) {
    this.#responses = [...responses];
  }

  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    const text = this.#responses.shift();
    if (text === undefined) throw new Error("Scripted worker exhausted.");
    return {
      text,
      usage: {
        callId: request.callId,
        stage: request.stage,
        pass: request.pass,
        estimated: true,
        elapsedMs: 1,
        promptHash: "a".repeat(64),
        contextHash: "b".repeat(64),
        outputHash: "c".repeat(64),
      },
    };
  }
}

test("scripted qualification is deterministic, corrects once, and separates private machine, prose, and sealed-label artifacts", async () => {
  const firstRoot = mkdtempSync(join(tmpdir(), "novel-forge-gemma-qualification-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "novel-forge-gemma-qualification-"));
  try {
    const cases = [
      qualificationCase("z-stop", { must_stop: true }),
      {
        ...qualificationCase("m-prose", { valid_structured_output: false }),
        job_type: "draft-scene" as const,
      },
      qualificationCase("a-clean"),
      qualificationCase("b-corrected"),
    ];
    const scripted = [
      response("a-clean"),
      "not json",
      response("b-corrected"),
      JSON.stringify({
        prose: "ONLY_PROSE_SENTINEL",
        record_ids: ["REQ-m-prose"],
        must_stop: false,
        severe_failures: [],
      }),
      response("z-stop", { must_stop: true }),
    ];
    const worker = new ScriptedWorker(scripted);
    const result = await runGemmaQualification({
      cases,
      fingerprint,
      provider: fingerprint.provider,
      model: fingerprint.model,
      seed: "fixed-seed",
      worker,
      outputRoot: firstRoot,
    });

    assert.deepEqual(
      worker.requests.map((request) => request.prompt.includes("CORRECTION") ? "correction" : request.context),
      ["PRIVATE_CONTEXT_a-clean", "PRIVATE_CONTEXT_b-corrected", "correction", "PRIVATE_CONTEXT_m-prose", "PRIVATE_CONTEXT_z-stop"],
    );
    assert.equal(worker.requests.filter((request) => request.prompt.includes("CORRECTION")).length, 1);
    assert.equal(result.report.case_count, 4);
    assert.equal(result.report.first_pass_structured_rate, 2 / 3);
    assert.equal(result.report.corrected_structured_rate, 1);
    assert.equal(result.report.required_record_rate, 1);
    assert.equal(result.report.forbidden_record_uses, 0);
    assert.equal(result.report.correct_stop_rate, 1);
    assert.equal(result.report.severe_failure_count, 0);
    assert.equal(evaluateGemmaQualificationPromotion(result.report).qualified, false);

    const machine = readFileSync(result.paths.report, "utf8");
    const review = readFileSync(result.paths.reviewKit, "utf8");
    const labels = readFileSync(result.paths.labelSeal, "utf8");
    for (const privateValue of [
      "PRIVATE_PROMPT",
      "PRIVATE_CONTEXT",
      "ONLY_PROSE_SENTINEL",
      "not json",
      "structured_output",
    ]) {
      assert.equal(machine.includes(privateValue), false, `${privateValue} leaked into machine report`);
    }
    assert.match(review, /ONLY_PROSE_SENTINEL/);
    for (const sealedLabel of ["m-prose", "draft-scene"]) {
      assert.equal(machine.includes(sealedLabel), false, `${sealedLabel} leaked into machine report`);
      assert.equal(review.includes(sealedLabel), false, `${sealedLabel} leaked into blinded review kit`);
    }
    assert.doesNotMatch(review, /PRIVATE_PROMPT|PRIVATE_CONTEXT/);
    assert.match(labels, /m-prose/);
    assert.doesNotMatch(labels, /ONLY_PROSE_SENTINEL|PRIVATE_PROMPT|PRIVATE_CONTEXT/);
    assert.equal(lstatSync(result.paths.labelSeal).mode & 0o077, 0);
    assert.equal(readdirSync(firstRoot).some((name) => name.includes(".tmp-")), false);

    const repeat = await runGemmaQualification({
      cases: [...cases].reverse(),
      fingerprint,
      provider: fingerprint.provider,
      model: fingerprint.model,
      seed: "fixed-seed",
      worker: new ScriptedWorker(scripted),
      outputRoot: secondRoot,
    });
    assert.deepEqual(repeat.report, result.report);
    assert.equal(readFileSync(repeat.paths.reviewKit, "utf8"), review);
    assert.equal(readFileSync(repeat.paths.labelSeal, "utf8"), labels);
  } finally {
    chmodSync(firstRoot, 0o700);
    chmodSync(secondRoot, 0o700);
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});

test("a persistently malformed response receives no more than one correction", async () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-gemma-correction-"));
  try {
    const worker = new ScriptedWorker(["bad-first", "bad-second"]);
    const result = await runGemmaQualification({
      cases: [qualificationCase("malformed")],
      fingerprint,
      provider: fingerprint.provider,
      model: fingerprint.model,
      seed: "fixed-seed",
      worker,
      outputRoot: root,
    });
    assert.equal(worker.requests.length, 2);
    assert.equal(result.report.first_pass_structured_rate, 0);
    assert.equal(result.report.corrected_structured_rate, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function report(overrides: Partial<GemmaQualificationReport> = {}): GemmaQualificationReport {
  return {
    schema_version: "1.0.0",
    fingerprint,
    case_count: 100,
    first_pass_structured_rate: 0.95,
    corrected_structured_rate: 0.99,
    required_record_rate: 1,
    forbidden_record_uses: 0,
    correct_stop_rate: 0.95,
    severe_failure_count: 0,
    report_hash: "a".repeat(64),
    ...overrides,
  };
}

test("promotion gates accept exact boundaries and reject every value just beyond them", () => {
  assert.deepEqual(evaluateGemmaQualificationPromotion(report()), { qualified: true, failures: [] });
  const failures: Array<[Partial<GemmaQualificationReport>, RegExp]> = [
    [{ first_pass_structured_rate: 0.949999 }, /first-pass/i],
    [{ corrected_structured_rate: 0.989999 }, /corrected/i],
    [{ required_record_rate: 0.999999 }, /required-record/i],
    [{ required_record_rate: 1.000001 }, /required-record/i],
    [{ forbidden_record_uses: 1 }, /forbidden-record/i],
    [{ correct_stop_rate: 0.949999 }, /stop/i],
    [{ severe_failure_count: 1 }, /severe/i],
  ];
  for (const [overrides, message] of failures) {
    const result = evaluateGemmaQualificationPromotion(report(overrides));
    assert.equal(result.qualified, false);
    assert.match(result.failures.join("\n"), message);
    assert.throws(() => assertGemmaQualificationPromotion(report(overrides)), message);
  }
});

test("configuration is opt-in and binds the exact provider and model to a valid Gemma fingerprint", () => {
  const input = { provider: fingerprint.provider, model: fingerprint.model, seed: "seed", fingerprint };
  assert.throws(() => requireGemmaQualificationConfiguration({}, input), /NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1/);
  assert.throws(() => requireGemmaQualificationConfiguration(
    { NOVEL_FORGE_RUN_GEMMA_QUALIFICATION: "1" },
    { ...input, seed: " " },
  ), /seed/i);
  assert.throws(() => requireGemmaQualificationConfiguration(
    { NOVEL_FORGE_RUN_GEMMA_QUALIFICATION: "1" },
    { ...input, provider: "other" },
  ), /provider.*fingerprint/i);
  assert.throws(() => requireGemmaQualificationConfiguration(
    { NOVEL_FORGE_RUN_GEMMA_QUALIFICATION: "1" },
    { ...input, model: "google/gemma-3-12b-it" },
  ), /model.*fingerprint/i);
  assert.doesNotThrow(() => requireGemmaQualificationConfiguration(
    { NOVEL_FORGE_RUN_GEMMA_QUALIFICATION: "1" },
    input,
  ));
});

test("qualification run paths cannot escape the ignored runs directory", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-gemma-path-"));
  try {
    assert.equal(
      resolveGemmaQualificationRunRoot(root, "run-123"),
      join(root, "evals", "gemma", "runs", "run-123"),
    );
    for (const unsafe of ["../escape", "/absolute", ".", "run/subdir", "run\\subdir", ""]) {
      assert.throws(() => resolveGemmaQualificationRunRoot(root, unsafe), /run id/i);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
