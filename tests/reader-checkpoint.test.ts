import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash, validateNovelEvent } from "../src/application/events.js";
import { readerCheckpointFindings } from "../src/application/reader-checkpoint.js";
import type { ReaderExperimentsState } from "../src/domain/schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { commitFixture } from "./support/draft-fixture.js";

function response(readerId: string) {
  return {
    reader_id: readerId, source: "human" as const, segment: "target", recorded_at: "2026-01-01T00:00:00Z",
    continued_reading: true, would_buy: true, confusions: [], trust_breaks: [], lines_that_worked: ["the hatch"],
    remembered_hook: "the hatch", remembered_moments: ["the hatch"], friend_description: "tense",
    disagreement_question: "was she right", lingering_question: "who opened it",
    recommendation_target: "thriller readers", recommendation_reason: "pace", told_someone: true,
  };
}

function experiment(overrides: Record<string, unknown> = {}) {
  return {
    id: "RE-001", status: "immediate-complete", scope: "first-chapter", variant: "", blind: true,
    target_reader: "thriller readers", sample_path: "books/book-01/reader-kit/sample.md",
    minimum_reader_count: 3, immediate_responses: [], delayed_after_hours: 48, delayed_responses: [],
    metrics: {
      continuation_rate: null, purchase_intent_rate: null, delayed_hook_recall_rate: null,
      signature_moment_recall_rate: null, specific_recommendation_rate: null, talkability_rate: null,
    },
    verdict: "insufficient-signal",
    next_action: "collect more responses",
    ...overrides,
  };
}

function experimentsState(experiments: unknown[]): ReaderExperimentsState {
  return { schema_version: "1.0.0", experiments } as ReaderExperimentsState;
}

function setup(experiments: unknown[] | null): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-reader-checkpoint-"));
  const root = initializeProject(parent, { projectName: "Checkpoint", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "packaging";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  if (experiments !== null) {
    writeFileSync(join(root, "books", "book-01", "reader-experiments.yaml"), stringifyYaml(experimentsState(experiments)), "utf8");
  }
  commitFixture(root, "reader checkpoint fixture");
  return { parent, root };
}

function packageEvent(root: string) {
  return {
    eventType: "package" as const,
    expectedStage: "packaging" as const,
    expectedProjectHash: projectStateHash(root),
    files: [{ path: "books/book-01/package.md", content: "# Package\n\nSubmission notes.\n" }],
  };
}

test("no reader experiments at all is a blocker that names the remedy", () => {
  const findings = readerCheckpointFindings(null);
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.ok(finding);
  assert.equal(finding.severity, "blocker");
  assert.equal(finding.code, "no-human-reader-evidence");
  assert.match(finding.message, /This book has no reader experiments/);
  assert.match(finding.message, /they are not readers/);
  assert.match(finding.message, /reader-test event/);
});

test("experiments without a single human response are a blocker", () => {
  const findings = readerCheckpointFindings(experimentsState([experiment()]));
  assert.equal(findings[0]?.code, "no-human-reader-evidence");
  assert.match(findings[0]?.message ?? "", /1 reader experiment but not one recorded human response/);
});

test("a cancelled experiment does not count as evidence", () => {
  const findings = readerCheckpointFindings(experimentsState([
    experiment({ status: "cancelled", immediate_responses: [response("r1")] }),
  ]));
  assert.equal(findings[0]?.code, "no-human-reader-evidence");
});

test("real human responses clear the blocker and leave only warnings", () => {
  const findings = readerCheckpointFindings(experimentsState([
    experiment({ immediate_responses: [response("r1"), response("r2")] }),
  ]));
  assert.equal(findings.some((item) => item.severity === "blocker"), false);
  assert.equal(findings.some((item) => item.code === "thin-reader-evidence"), true);
  assert.equal(findings.some((item) => item.code === "no-delayed-reader-evidence"), true);
});

test("a fully collected experiment produces no findings", () => {
  const findings = readerCheckpointFindings(experimentsState([
    experiment({
      status: "complete",
      immediate_responses: [response("r1"), response("r2"), response("r3")],
      delayed_responses: [response("r1")],
    }),
  ]));
  assert.deepEqual(findings, []);
});

test("a package event without human reader evidence is rejected as a human gate", () => {
  const { parent, root } = setup(null);
  try {
    const result = validateNovelEvent(root, packageEvent(root));
    assert.equal(result.valid, false);
    assert.equal(result.rejection?.code, "human-gate-required");
    assert.equal(result.rejection?.retryable, false);
    assert.match(result.rejection?.message ?? "", /requires evidence that a human has read this book/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a package event with human reader evidence is accepted and carries its warnings", () => {
  const { parent, root } = setup([
    experiment({ immediate_responses: [response("r1"), response("r2")] }),
  ]);
  try {
    const result = applyNovelEvent(root, packageEvent(root));
    assert.equal(result.stage, "packaging");
    const text = result.advisories.join("\n");
    assert.match(text, /fewer responses than its own minimum_reader_count/);
    assert.match(text, /No reader experiment has delayed responses/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
