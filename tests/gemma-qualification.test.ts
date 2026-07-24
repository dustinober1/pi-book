import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stringify as stringifyYaml } from "yaml";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import type {
  GemmaQualificationCase,
  GemmaQualificationReport,
} from "../src/domain/gemma-qualification.js";
import {
  assertGemmaQualificationPromotion,
  computeGemmaQualificationReportHash,
  evaluateGemmaQualificationPromotion,
} from "../src/domain/gemma-qualification.js";
import {
  loadGemmaQualificationAssets,
  loadGemmaQualificationFingerprint,
  parseGemmaQualificationArguments,
  parseGemmaQualificationFixture,
  requireGemmaQualificationConfiguration,
  resolveGemmaQualificationRunRoot,
  runGemmaQualification,
  type GemmaQualificationSource,
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

const rubric = {
  path: "rubrics/prose-review.md",
  version: "1.0.0",
  content: "<!-- gemma-prose-rubric-version: 1.0.0 -->\n# Review\n",
} as const;

function context(id: string): string {
  return [
    `RECORD REQ-${id} | REQUIRED | the governing fact remains in force`,
    `RECORD FORBIDDEN-${id} | FORBIDDEN | the discarded outcome occurs`,
  ].join("\n");
}

function qualificationCase(
  id: string,
  overrides: Partial<GemmaQualificationCase> = {},
): GemmaQualificationCase {
  return {
    id,
    job_type: "plan-scene",
    prompt: `PRIVATE_PROMPT_${id}`,
    context: context(id),
    expected: {
      valid_structured_output: true,
      required_record_ids: [`REQ-${id}`],
      forbidden_record_ids: [`FORBIDDEN-${id}`],
      must_stop: false,
    },
    ...overrides,
  };
}

function planResponse(id: string, evidence = [`REQ-${id}`]): string {
  return JSON.stringify({
    structured_output: {
      schema_version: "1.0.0",
      steps: [{ required_beat: "beat", execution: "execute", pressure: "pressure" }],
      turn_execution: "turn",
      ending_execution: "ending",
      evidence_record_ids: evidence,
    },
  });
}

function verificationResponse(id: string, verdict: "accept" | "reject"): string {
  return JSON.stringify({
    structured_output: {
      schema_version: "1.0.0",
      chapter: 1,
      verdict,
      findings: [{ evidence: `[REQ-${id}] governing evidence`, required_change: "Resolve the conflict." }],
    },
  });
}

function fixtureSources(cases: readonly GemmaQualificationCase[]): readonly GemmaQualificationSource[] {
  return [{
    path: "fixtures/test.yaml",
    content: stringifyYaml({ schema_version: "1.0.0", cases }),
  }];
}

class ScriptedWorker implements Pick<QualityWorker, "run"> {
  readonly requests: QualityWorkerRequest[] = [];
  readonly #responses: Array<string | Error>;

  constructor(responses: Array<string | Error>) {
    this.#responses = [...responses];
  }

  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    const value = this.#responses.shift();
    if (value === undefined) throw new Error("Scripted worker exhausted.");
    if (value instanceof Error) throw value;
    return {
      text: value,
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

function baseInput(
  outputRoot: string,
  cases: readonly GemmaQualificationCase[],
  worker: Pick<QualityWorker, "run">,
) {
  return {
    cases,
    fingerprint,
    provider: fingerprint.provider,
    model: fingerprint.model,
    seed: "fixed-seed",
    worker,
    outputRoot,
    fixtureSources: fixtureSources(cases),
    rubric,
  };
}

test("trusted job validators derive structured validity, authority use, stop behavior, and severe failures", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-independent-"));
  try {
    const cases = [
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
      qualificationCase("a-plan"),
    ];
    const selfGradedInvalid = JSON.stringify({
      structured_output: {},
      record_ids: ["REQ-a-plan"],
      must_stop: false,
      severe_failures: [],
    });
    const result = await runGemmaQualification(baseInput(
      join(parent, "run"),
      cases,
      new ScriptedWorker([selfGradedInvalid, selfGradedInvalid, verificationResponse("z-stop", "reject")]),
    ));
    assert.equal(result.report.first_pass_structured_rate, 0.5);
    assert.equal(result.report.corrected_structured_rate, 0.5);
    assert.equal(result.report.required_record_rate, 0);
    assert.equal(result.report.correct_stop_rate, 0.5);
    assert.equal(result.report.severe_failure_count, 1);
    assert.equal(evaluateGemmaQualificationPromotion(result.report).qualified, false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("only genuine production authority bindings satisfy required-record obligations", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-authority-fields-"));
  try {
    const cases = [
      qualificationCase("a-anchor"),
      qualificationCase("b-delta", { job_type: "extract-state-delta" }),
      qualificationCase("c-critic", { job_type: "critic-continuity" }),
      qualificationCase("d-patch", { job_type: "patch-spans" }),
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
    ];
    const worker = new ScriptedWorker([
      planResponse("a-anchor"),
      JSON.stringify({
        structured_output: {
          schema_version: "1.0.0",
          mutations: [],
          thread_changes: [{
            thread_id: "REQ-b-delta",
            operation: "advanced",
            description: "The thread advances.",
            evidence_quote: "A quoted change.",
          }],
        },
      }),
      JSON.stringify({
        structured_output: {
          schema_version: "1.0.0",
          verdict: "repair",
          findings: [{
            severity: "high",
            category: "continuity",
            evidence_quote: "REQ-c-critic",
            required_change: "Repair the continuity issue.",
          }],
        },
      }),
      JSON.stringify({
        structured_output: {
          schema_version: "1.0.0",
          operations: [{
            operation: "replace",
            anchor_quote: "old text",
            replacement: "new text",
            finding_refs: ["REQ-d-patch"],
          }],
        },
      }),
      verificationResponse("z-stop", "reject"),
    ]);
    const result = await runGemmaQualification(baseInput(join(parent, "run"), cases, worker));
    assert.equal(result.report.required_record_rate, 0.25);
    assert.equal(result.report.severe_failure_count, 3);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("qualification rejects cases that do not come from the exact frozen fixture sources", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-source-unity-"));
  try {
    const suiteA = [
      qualificationCase("a-plan"),
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
    ];
    const suiteB = [
      qualificationCase("b-plan"),
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
    ];
    const worker = new ScriptedWorker([]);
    await assert.rejects(
      runGemmaQualification({
        ...baseInput(join(parent, "run"), suiteB, worker),
        fixtureSources: fixtureSources(suiteA),
      }),
      /cases.*frozen fixture sources|fixture sources.*cases/i,
    );
    assert.equal(worker.requests.length, 0);
    assert.equal(readdirSync(parent).length, 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("verify-chapter uses production chapter-target semantic validation", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-verification-chapter-"));
  try {
    const cases = [
      qualificationCase("a-plan"),
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
    ];
    const wrongChapter = JSON.stringify({
      structured_output: {
        schema_version: "1.0.0",
        chapter: 2,
        verdict: "reject",
        findings: [{ evidence: "Wrong target.", required_change: "Target the expected chapter." }],
      },
    });
    const worker = new ScriptedWorker([planResponse("a-plan"), wrongChapter, wrongChapter]);
    const result = await runGemmaQualification(baseInput(join(parent, "run"), cases, worker));
    assert.equal(worker.requests.length, 3);
    assert.equal(result.report.first_pass_structured_rate, 0.5);
    assert.equal(result.report.corrected_structured_rate, 0.5);
    assert.equal(result.report.severe_failure_count, 1);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("scripted qualification is deterministic, corrects once, and keeps labels sealed while making prose review usable", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-qualification-"));
  try {
    const cases = [
      qualificationCase("z-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-z-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
      qualificationCase("m-prose", {
        job_type: "draft-scene",
        expected: {
          valid_structured_output: false,
          required_record_ids: ["REQ-m-prose"],
          forbidden_record_ids: ["FORBIDDEN-m-prose"],
          must_stop: false,
        },
      }),
      qualificationCase("a-clean"),
      qualificationCase("b-corrected"),
    ];
    const scripted = [
      planResponse("a-clean"),
      "not json",
      planResponse("b-corrected"),
      JSON.stringify({ prose: "She recognizes that the governing fact remains in force and refuses the dangerous alternative." }),
      verificationResponse("z-stop", "reject"),
    ];
    const worker = new ScriptedWorker(scripted);
    const result = await runGemmaQualification(baseInput(join(parent, "run-a"), cases, worker));
    assert.deepEqual(
      worker.requests.map((request) => request.prompt.includes("CORRECTION") ? "correction" : request.context),
      [context("a-clean"), context("b-corrected"), "correction", context("m-prose"), context("z-stop")],
    );
    assert.equal(worker.requests.filter((request) => request.prompt.includes("CORRECTION")).length, 1);
    assert.equal(result.report.first_pass_structured_rate, 2 / 3);
    assert.equal(result.report.corrected_structured_rate, 1);
    assert.equal(result.report.required_record_rate, 1);
    assert.equal(result.report.forbidden_record_uses, 0);
    assert.equal(result.report.correct_stop_rate, 1);
    assert.equal(result.report.severe_failure_count, 0);

    const machine = readFileSync(result.paths.report, "utf8");
    const review = readFileSync(result.paths.reviewKit, "utf8");
    const labels = readFileSync(result.paths.labelSeal, "utf8");
    for (const privateValue of [
      "PRIVATE_PROMPT",
      "RECORD REQ-",
      "the governing fact remains in force",
      "the discarded outcome occurs",
      "not json",
      "structured_output",
      "m-prose",
      "draft-scene",
    ]) {
      assert.equal(machine.includes(privateValue), false, `${privateValue} leaked into machine report`);
    }
    assert.match(review, /Governing constraint: the governing fact remains in force/);
    assert.match(review, /Forbidden outcome: the discarded outcome occurs/);
    assert.match(review, /Expected response posture: continue/);
    assert.match(review, /She recognizes that the governing fact remains in force/);
    assert.doesNotMatch(review, /m-prose|draft-scene|REQ-|FORBIDDEN-|PRIVATE_PROMPT|RECORD /);
    assert.match(labels, /m-prose/);
    assert.doesNotMatch(labels, /governing fact|discarded outcome|PRIVATE_PROMPT/);

    const repeat = await runGemmaQualification({
      ...baseInput(
        join(parent, "run-b"),
        [...cases].reverse(),
        new ScriptedWorker(scripted),
      ),
      fixtureSources: fixtureSources(cases),
    });
    assert.deepEqual(repeat.report, result.report);
    assert.equal(readFileSync(repeat.paths.reviewKit, "utf8"), review);
    assert.equal(readFileSync(repeat.paths.labelSeal, "utf8"), labels);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("severe failures are evaluator-derived for missing, forbidden, stop, and deterministic prose contradictions", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-severe-"));
  try {
    const cases = [
      qualificationCase("a-missing"),
      qualificationCase("b-forbidden"),
      qualificationCase("c-prose", {
        job_type: "draft-scene",
        expected: {
          valid_structured_output: false,
          required_record_ids: ["REQ-c-prose"],
          forbidden_record_ids: ["FORBIDDEN-c-prose"],
          must_stop: false,
        },
      }),
      qualificationCase("d-stop", {
        job_type: "verify-chapter",
        expected: {
          valid_structured_output: true,
          required_record_ids: [],
          forbidden_record_ids: ["FORBIDDEN-d-stop"],
          must_stop: true,
          chapter: 1,
        },
      }),
    ];
    const result = await runGemmaQualification(baseInput(join(parent, "run"), cases, new ScriptedWorker([
      planResponse("a-missing", []),
      planResponse("b-forbidden", ["REQ-b-forbidden", "FORBIDDEN-b-forbidden"]),
      JSON.stringify({ prose: "The governing fact remains in force, then the discarded outcome occurs." }),
      verificationResponse("d-stop", "accept"),
    ])));
    assert.equal(result.report.severe_failure_count, 4);
    assert.equal(result.report.required_record_rate, 2 / 3);
    assert.equal(result.report.forbidden_record_uses, 2);
    assert.equal(result.report.correct_stop_rate, 0.75);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("qualification reserves and publishes the artifact set transactionally with one concurrent winner", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-transaction-"));
  try {
    const outputRoot = join(parent, "run");
    const stopCase = qualificationCase("stop", {
      job_type: "verify-chapter",
      expected: {
        valid_structured_output: true,
        required_record_ids: ["REQ-stop"],
        forbidden_record_ids: ["FORBIDDEN-stop"],
        must_stop: true,
        chapter: 1,
      },
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const firstWorker: Pick<QualityWorker, "run"> = {
      async run(request) {
        await blocked;
        return new ScriptedWorker([verificationResponse("stop", "reject")]).run(request);
      },
    };
    const first = runGemmaQualification(baseInput(outputRoot, [stopCase], firstWorker));
    await assert.rejects(
      runGemmaQualification(baseInput(outputRoot, [stopCase], new ScriptedWorker([verificationResponse("stop", "reject")]))),
      /reserved|already exists|in progress/i,
    );
    release();
    await first;
    assert.deepEqual(readdirSync(outputRoot).sort(), [
      "gemma-label-seal.json",
      "gemma-prose-review-kit.md",
      "gemma-qualification-report.json",
    ]);
    assert.equal(readdirSync(parent).some((name) => name.includes(".lock") || name.includes(".staging")), false);

    const failedRoot = join(parent, "failed");
    await assert.rejects(
      runGemmaQualification({
        ...baseInput(failedRoot, [stopCase], new ScriptedWorker([verificationResponse("stop", "reject")])),
        beforeArtifactPublish() { throw new Error("injected publication failure"); },
      }),
      /injected publication failure/,
    );
    assert.equal(readdirSync(parent).some((name) => name.startsWith("failed")), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("provenance binds frozen fixtures, rubric/version, seed, evaluator revision, and report integrity", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-provenance-"));
  try {
    const stopCase = qualificationCase("stop", {
      job_type: "verify-chapter",
      expected: {
        valid_structured_output: true,
        required_record_ids: ["REQ-stop"],
        forbidden_record_ids: ["FORBIDDEN-stop"],
        must_stop: true,
        chapter: 1,
      },
    });
    const exactFixture = fixtureSources([stopCase])[0]!.content;
    const run = async (name: string, fixtureContent: string, rubricContent: string) => runGemmaQualification({
      ...baseInput(join(parent, name), [stopCase], new ScriptedWorker([verificationResponse("stop", "reject")])),
      fixtureSources: [{ path: "fixture.yaml", content: fixtureContent }],
      rubric: { ...rubric, content: rubricContent },
    });
    const baseline = await run("baseline", exactFixture, rubric.content);
    const changedFixture = await run("fixture", `${exactFixture}\n# byte-level fixture revision\n`, rubric.content);
    const changedRubric = await run("rubric", exactFixture, `${rubric.content}\nchanged`);
    assert.notEqual(baseline.report.report_hash, changedFixture.report.report_hash);
    assert.notEqual(baseline.report.report_hash, changedRubric.report.report_hash);
    assert.deepEqual(
      {
        ...baseline.report,
        provenance: changedFixture.report.provenance,
        report_hash: changedFixture.report.report_hash,
      },
      changedFixture.report,
    );
    assert.match(baseline.report.provenance.fixture_suite_hash, /^[a-f0-9]{64}$/);
    assert.match(baseline.report.provenance.rubric_hash, /^[a-f0-9]{64}$/);
    assert.match(baseline.report.provenance.seed_hash, /^[a-f0-9]{64}$/);
    assert.equal(baseline.report.provenance.rubric_version, "1.0.0");
    assert.equal(baseline.report.provenance.evaluator_revision, "2.0.0");

    const tampered = { ...baseline.report, case_count: baseline.report.case_count + 1 };
    assert.throws(() => assertGemmaQualificationPromotion(tampered), /hash|integrity/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("empty structured, required-record, and stop/escalation denominators reject before inference", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-denominator-"));
  try {
    const proseOnly = qualificationCase("prose", {
      job_type: "draft-scene",
      expected: {
        valid_structured_output: false,
        required_record_ids: ["REQ-prose"],
        forbidden_record_ids: [],
        must_stop: true,
      },
    });
    const noRequired = qualificationCase("stop", {
      job_type: "verify-chapter",
      expected: {
        valid_structured_output: true,
        required_record_ids: [],
        forbidden_record_ids: [],
        must_stop: true,
        chapter: 1,
      },
    });
    const noStop = qualificationCase("plan");
    for (const [name, cases, message] of [
      ["structured", [proseOnly], /structured.*case/i],
      ["required", [noRequired], /required-record.*obligation/i],
      ["stop", [noStop], /stop.*obligation/i],
    ] as const) {
      const worker = new ScriptedWorker([]);
      await assert.rejects(runGemmaQualification(baseInput(join(parent, name), cases, worker)), message);
      assert.equal(worker.requests.length, 0);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

function sealedReport(overrides: Partial<GemmaQualificationReport> = {}): GemmaQualificationReport {
  const unsigned = {
    schema_version: "1.0.0" as const,
    fingerprint,
    provenance: {
      evaluator_revision: "2.0.0" as const,
      fixture_suite_hash: "1".repeat(64),
      rubric_hash: "2".repeat(64),
      rubric_version: "1.0.0",
      seed_hash: "3".repeat(64),
    },
    case_count: 100,
    first_pass_structured_rate: 0.95,
    corrected_structured_rate: 0.99,
    required_record_rate: 1,
    forbidden_record_uses: 0,
    correct_stop_rate: 0.95,
    severe_failure_count: 0,
    ...overrides,
  };
  return { ...unsigned, report_hash: computeGemmaQualificationReportHash(unsigned) };
}

test("verified promotion accepts exact boundaries and rejects all six adjacent failures", () => {
  assert.deepEqual(evaluateGemmaQualificationPromotion(sealedReport()), { qualified: true, failures: [] });
  const failures: Array<[Partial<GemmaQualificationReport>, RegExp]> = [
    [{ first_pass_structured_rate: 0.949999 }, /first-pass/i],
    [{ corrected_structured_rate: 0.989999 }, /corrected/i],
    [{ required_record_rate: 0.999999 }, /required-record/i],
    [{ forbidden_record_uses: 1 }, /forbidden-record/i],
    [{ correct_stop_rate: 0.949999 }, /stop/i],
    [{ severe_failure_count: 1 }, /severe/i],
  ];
  for (const [overrides, message] of failures) {
    const report = sealedReport(overrides);
    const result = evaluateGemmaQualificationPromotion(report);
    assert.equal(result.qualified, false);
    assert.match(result.failures.join("\n"), message);
    assert.throws(() => assertGemmaQualificationPromotion(report), message);
  }
  assert.throws(() => assertGemmaQualificationPromotion(sealedReport({ schema_version: "wrong" as "1.0.0" })), /schema/i);
  assert.throws(() => assertGemmaQualificationPromotion(sealedReport({ case_count: 0 })), /case count/i);
  const extended = { ...sealedReport(), raw_prompt: "must not be accepted" };
  const { report_hash: _oldHash, ...extendedUnsigned } = extended;
  extended.report_hash = computeGemmaQualificationReportHash(extendedUnsigned);
  assert.throws(
    () => assertGemmaQualificationPromotion(extended as GemmaQualificationReport),
    /report.*unknown/i,
  );
  const provenanceExtended = {
    ...sealedReport(),
    provenance: { ...sealedReport().provenance, fixture_contents: "must not be accepted" },
  };
  const { report_hash: _oldProvenanceHash, ...provenanceUnsigned } = provenanceExtended;
  provenanceExtended.report_hash = computeGemmaQualificationReportHash(provenanceUnsigned);
  assert.throws(
    () => assertGemmaQualificationPromotion(provenanceExtended as GemmaQualificationReport),
    /provenance.*unknown/i,
  );
});

test("malformed nested report metadata produces sanitized qualification validation errors", () => {
  const assertSanitized = (report: unknown): void => {
    assert.throws(
      () => assertGemmaQualificationPromotion(report as GemmaQualificationReport),
      (error: unknown) => error instanceof Error
        && !(error instanceof TypeError)
        && /Gemma qualification/i.test(error.message),
    );
  };
  assertSanitized({ ...sealedReport(), fingerprint: null });
  assertSanitized({ ...sealedReport(), fingerprint: 42 });
  assertSanitized({ ...sealedReport(), provenance: null });
  assertSanitized({ ...sealedReport(), provenance: "invalid" });
  assertSanitized({ ...sealedReport(), fingerprint: { ...fingerprint, provider: 42 } });
  assertSanitized({
    ...sealedReport(),
    provenance: { ...sealedReport().provenance, rubric_version: 42 },
  });
});

test("shipped fixtures, rubric, package entries, and strict CLI loaders are exercised without inference", () => {
  const assets = loadGemmaQualificationAssets(process.cwd());
  assert.equal(assets.fixtureSources.length, 3);
  assert.ok(assets.cases.length >= 3);
  assert.equal(assets.rubric.version, "1.0.0");
  assert.match(assets.rubric.content, /Fidelity/);
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { files: string[]; scripts: Record<string, string> };
  assert.equal(packageJson.scripts["eval:gemma"], "node --import tsx scripts/qualify-gemma.ts");
  for (const entry of ["evals/gemma/README.md", "evals/gemma/fixtures/", "evals/gemma/rubrics/"]) {
    assert.ok(packageJson.files.includes(entry), `${entry} is missing from package files`);
  }

  const args = parseGemmaQualificationArguments([
    "--provider", "local",
    "--model", fingerprint.model,
    "--fingerprint", "fingerprint.json",
    "--seed", "seed",
  ]);
  assert.deepEqual(args, {
    provider: "local",
    model: fingerprint.model,
    fingerprintPath: "fingerprint.json",
    seed: "seed",
  });
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-gemma-fingerprint-"));
  try {
    const path = join(parent, "fingerprint.json");
    writeFileSync(path, `${JSON.stringify(fingerprint)}\n`);
    const loaded = loadGemmaQualificationFingerprint(path);
    assert.deepEqual(loaded, fingerprint);
    assert.doesNotThrow(() => requireGemmaQualificationConfiguration(
      { NOVEL_FORGE_RUN_GEMMA_QUALIFICATION: "1" },
      { provider: args.provider, model: args.model, seed: args.seed, fingerprint: loaded },
    ));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("fixture parser strictly rejects unknown root, case, and expected keys", () => {
  const base = [
    "schema_version: 1.0.0",
    "cases:",
    "  - id: strict",
    "    job_type: verify-chapter",
    "    prompt: verify",
    "    context: |",
    "      RECORD REQ-strict | REQUIRED | required fact",
    "      RECORD FORBIDDEN-strict | FORBIDDEN | forbidden fact",
    "    expected:",
    "      valid_structured_output: true",
    "      required_record_ids: [REQ-strict]",
    "      forbidden_record_ids: [FORBIDDEN-strict]",
    "      must_stop: true",
    "      chapter: 1",
  ].join("\n");
  assert.equal(parseGemmaQualificationFixture(base, "strict.yaml").length, 1);
  assert.throws(() => parseGemmaQualificationFixture(`${base}\nunknown_root: true\n`, "strict.yaml"), /unknown.*root/i);
  assert.throws(() => parseGemmaQualificationFixture(base.replace("    job_type:", "    unknown_case: true\n    job_type:"), "strict.yaml"), /unknown.*case/i);
  assert.throws(() => parseGemmaQualificationFixture(base.replace("      must_stop:", "      unknown_expected: true\n      must_stop:"), "strict.yaml"), /unknown.*expected/i);
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
