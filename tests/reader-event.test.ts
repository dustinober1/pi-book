import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-readers-")); }

function readerEvidence(): string {
  return stringifyYaml({
    schema_version: "1.0.0",
    experiments: [{
      id: "RE-001",
      status: "delayed-pending",
      scope: "first-chapter",
      variant: "A",
      blind: true,
      target_reader: "procedural thriller readers",
      sample_path: "books/book-01/manuscript/chapters/01-opening.md",
      immediate_responses: [{
        reader_id: "R-001",
        segment: "core",
        recorded_at: "2026-07-13T20:00:00Z",
        continued_reading: true,
        would_buy: true,
        confusions: [],
        trust_breaks: [],
        lines_that_worked: ["The exit sign changed its testimony."],
        remembered_hook: "",
        remembered_moments: [],
        friend_description: "",
        disagreement_question: "",
        lingering_question: "",
        recommendation_target: "",
        recommendation_reason: "",
        told_someone: null,
      }],
      delayed_after_hours: 48,
      delayed_responses: [],
      metrics: {
        continuation_rate: 1,
        purchase_intent_rate: 1,
        delayed_hook_recall_rate: null,
        signature_moment_recall_rate: null,
        specific_recommendation_rate: null,
        talkability_rate: null,
      },
      verdict: "insufficient-signal",
      next_action: "Collect the delayed response without showing the sample again.",
    }],
  });
}

test("reader-test events record real evidence without advancing stage and are allowed during a pending creative gate", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Event", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = "first-chapter-approval";
    project.gates["first-chapter-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    const before = projectStateHash(root);
    const result = applyNovelEvent(root, {
      eventType: "reader-test",
      expectedStage: "drafting",
      expectedProjectHash: before,
      scope: "first-chapter",
      files: [{ path: "books/book-01/reader-experiments.yaml", content: readerEvidence() }],
    });

    assert.equal(result.stage, "drafting");
    assert.equal(readProject(root).next_gate, "first-chapter-approval");
    assert.equal(existsSync(join(root, "books", "book-01", "reader-experiments.yaml")), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("reader-test events cannot rewrite manuscript prose", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Guard", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    assert.throws(() => applyNovelEvent(root, {
      eventType: "reader-test",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content: "rewritten" }],
    }), /not allowed/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
