import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getProjectStatus } from "../src/application/status.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-status-impact-")); }

test("status defers empty remarkability during early planning but blocks after book planning", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Status Impact", projectType: "standalone", profile: "thriller" });
    assert.equal(getProjectStatus(root).blockers.some((item) => /retellable hook/i.test(item)), false);

    const project = readProject(root);
    project.current_stage = "chapter-queue";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    assert.ok(getProjectStatus(root).blockers.some((item) => /retellable hook/i.test(item)));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("status reports dishonest validated reader evidence as a blocker", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Claim", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(root, "books", "book-01", "reader-experiments.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      experiments: [{
        id: "RE-001",
        status: "complete",
        scope: "first-chapter",
        variant: "A",
        blind: true,
        target_reader: "core thriller readers",
        sample_path: "books/book-01/manuscript/chapters/01-opening.md",
        minimum_reader_count: 3,
        immediate_responses: [],
        delayed_after_hours: 48,
        delayed_responses: [],
        metrics: {
          continuation_rate: null,
          purchase_intent_rate: null,
          delayed_hook_recall_rate: null,
          signature_moment_recall_rate: null,
          specific_recommendation_rate: null,
          talkability_rate: null,
        },
        verdict: "validated",
        next_action: "Use the validation claim.",
      }],
    }), "utf8");

    const status = getProjectStatus(root);
    assert.ok(status.blockers.some((item) => /validated verdict|delayed responses|minimum reader count/i.test(item)));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
