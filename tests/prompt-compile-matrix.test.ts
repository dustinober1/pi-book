import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanStagePromptPlan } from "../src/application/book-plan-prompt-plan.js";
import { compilePrompt } from "../src/application/prompt-compiler.js";
import { bookPlanPhasePrompt, bookPlanPrompt } from "../src/application/prompts.js";
import { bookPlanStageSpec, type BookPlanStageInput } from "../src/application/stage-specs/index.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";
import { isExpectedOverflow, runPromptCompileMatrix } from "../src/evaluation/prompt-compile-matrix.js";
import { getProfile } from "../src/profiles/index.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-prompt-matrix-")); }

function input(genre: "thriller" | "romantasy" | "historical-fiction", hasPublicReviewEvidence: boolean): BookPlanStageInput {
  const profile = getProfile(genre);
  return {
    root: "/matrix/novel",
    bookId: "book-01",
    intakeContext: "Original author idea: A damaged analyst hears a signal nobody else can verify.",
    premiseContext: "Selected premise: the signal is genuine.",
    planningQuestions: profile.planningQuestions,
    profileRules: profile.bookPlanRules,
    profileOutputs: profile.bookPlanOutputs,
    hasPublicReviewEvidence,
    projectHash: "matrix-hash",
  };
}

// The core Phase 1 guarantee: no runtime profile, stage, and genre combination
// can brick a project at prompt compilation. tiny-local reached book planning
// and stopped permanently for two releases because nothing compiled the full
// matrix; this test is the durable fix — an oversized spec is now a build
// failure, not a live-session discovery.
test("every stage prompt plan compiles under every runtime profile and genre", () => {
  const report = runPromptCompileMatrix();
  assert.equal(report.cells.length >= 135, true, `matrix covered ${report.cells.length} cells`);
  assert.deepEqual(
    report.failures.map((cell) => `${cell.stageId}:${cell.variant}:${cell.runtimeProfile}:${cell.genre} -> ${cell.error ?? "compiled but expected overflow"}`),
    [],
  );
});

test("the unsplit book-plan spec still exceeds tiny-local, so the phase split stays necessary", () => {
  const report = runPromptCompileMatrix();
  const pinned = report.cells.filter((cell) => isExpectedOverflow(cell));
  assert.ok(pinned.length >= 3, "the expected-overflow cell covers every genre");
  for (const cell of pinned) assert.match(cell.error ?? "", /Prompt budget exceeded/);
});

test("tiny-local compiles the book plan as two phases feeding one guarded event", () => {
  for (const genre of ["thriller", "romantasy", "historical-fiction"] as const) {
    const plan = bookPlanStagePromptPlan(input(genre, true), RUNTIME_PROFILES["tiny-local"]);
    assert.equal(plan.length, 2, `${genre} phases`);
    assert.equal(plan[0]!.phase, "architecture");
    assert.equal(plan[1]!.phase, "evidence");
    for (const phase of plan) assert.ok(phase.compiled.characterCount <= RUNTIME_PROFILES["tiny-local"].maxPromptChars, `${genre} ${phase.phase} fits`);
    const architecture = plan[0]!.compiled.text;
    const evidence = plan[1]!.compiled.text;
    // Phase 1 must hold work back from the event and hand off to phase 2.
    assert.match(architecture, /Do not call novel_apply_event in this phase/);
    assert.match(architecture, /\/novel-plan book --phase evidence/);
    assert.doesNotMatch(architecture, /call the novel_apply_event tool/);
    // Phase 2 owns the single guarded event and the complete-set requirement.
    assert.match(evidence, /novel_apply_event/);
    assert.match(evidence, /architecture files drafted in the previous phase together with these evidence files/);
    assert.match(evidence, /omitting an architecture file is itself a rejection/i);
  }
});

test("full and local profiles keep the single book-plan prompt", () => {
  for (const id of ["local", "full"] as const) {
    const plan = bookPlanStagePromptPlan(input("historical-fiction", true), RUNTIME_PROFILES[id]);
    assert.equal(plan.length, 1, `${id} stays single-prompt`);
    assert.equal(plan[0]!.phase, "single");
  }
});

test("public-review rules are omitted whole without evidence and return when it exists", () => {
  const without = bookPlanStageSpec(input("thriller", false));
  const withEvidence = bookPlanStageSpec(input("thriller", true));
  // Omission is by whole rule, never truncation: the strongest rules vanish
  // completely and a named guard takes their place.
  assert.ok(!without.must.some((rule) => /One-star-only evidence/.test(rule)));
  assert.ok(!without.must.some((rule) => /prevent, mitigate, accept-as-tradeoff/.test(rule)));
  assert.ok(without.must.some((rule) => /rebuild the plan so the full public-review evidence rules load/.test(rule)));
  // With evidence, every rule loads unchanged.
  for (const rule of [
    /Public-review observations are market evidence/,
    /One-star-only evidence can never exceed moderate/,
    /prevent, mitigate, accept-as-tradeoff, or irrelevant-to-project/,
    /Only prevent or mitigate clusters/,
  ]) assert.ok(withEvidence.must.some((entry) => rule.test(entry)), String(rule));
  // The load-bearing avoid rules survive in both shapes.
  for (const spec of [without, withEvidence]) {
    assert.ok(spec.avoid.some((rule) => /Never invent public-review evidence/.test(rule)));
  }
});

test("a real project's book-plan prompt tracks its recorded public-review evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Gate", projectType: "standalone", profile: "thriller" });
    const fresh = bookPlanPrompt(root, RUNTIME_PROFILES.full);
    assert.doesNotMatch(fresh, /One-star-only evidence/);
    assert.match(fresh, /rebuild the plan so the full public-review evidence rules load/);

    // Recording an observation must bring the full rules back on the next build.
    const strategyPath = join(root, "books/book-01/book-strategy.yaml");
    const strategy = readFileSync(strategyPath, "utf8").replace(
      "reader_friction:\n  observations: []",
      [
        "reader_friction:",
        "  observations:",
        "    - id: OBS-001",
        "      title: Pacing complaint",
        '      source_location: "manual"',
        '      observed_on: "2026-08-01"',
        "      rating: 2",
        '      paraphrase: "Middle sagged for this reader."',
        '      short_excerpt: "the middle dragged"',
        "      genre_relevance: high",
        "      execution_relevance: high",
        "      category: pacing",
        "      sentiment: negative",
      ].join("\n"),
    );
    writeFileSync(strategyPath, strategy, "utf8");
    const informed = bookPlanPrompt(root, RUNTIME_PROFILES.full);
    assert.match(informed, /One-star-only evidence can never exceed moderate/);
    assert.doesNotMatch(informed, /rebuild the plan so the full public-review evidence rules load/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("bookPlanPhasePrompt compiles a requested phase directly", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Phase Direct", projectType: "standalone", profile: "thriller" });
    const evidence = bookPlanPhasePrompt(root, "evidence", RUNTIME_PROFILES["tiny-local"]);
    assert.match(evidence, /phase 2 of 2/);
    assert.match(evidence, /one complete book-plan event/);
    const architecture = bookPlanPhasePrompt(root, "architecture", RUNTIME_PROFILES["tiny-local"]);
    assert.match(architecture, /phase 1 of 2/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the phased split loses no normative rule relative to the whole spec", () => {
  for (const genre of ["thriller", "romantasy", "historical-fiction"] as const) {
    for (const hasEvidence of [false, true]) {
      const whole = bookPlanStageSpec(input(genre, hasEvidence));
      const plan = bookPlanStagePromptPlan(input(genre, hasEvidence), RUNTIME_PROFILES["tiny-local"]);
      assert.equal(plan.length, 2);
      const combined = plan.map((phase) => phase.compiled.text).join("\n");
      for (const rule of [...whole.must, ...whole.avoid]) {
        assert.ok(combined.includes(rule), `${genre} evidence=${hasEvidence} keeps: ${rule.slice(0, 60)}`);
      }
      for (const output of whole.outputs) {
        assert.ok(combined.includes(output), `${genre} evidence=${hasEvidence} keeps output: ${output}`);
      }
    }
  }
});

test("compilePrompt still refuses to truncate: an over-budget phase throws rather than shortens", () => {
  const oversized = bookPlanStageSpec(input("historical-fiction", true));
  assert.throws(() => compilePrompt(oversized, RUNTIME_PROFILES["tiny-local"]), /Prompt budget exceeded.*No normative rule was truncated/s);
});
