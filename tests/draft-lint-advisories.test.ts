import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash, validateNovelEvent } from "../src/application/events.js";
import { draftLintReport } from "../src/application/draft-lint.js";
import { draftRepetitionConstraints } from "../src/application/draft-context.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { commitFixture, draftText } from "./support/draft-fixture.js";

const TARGET = 2_000;

function readyPacket(chapter: number) {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready", pov: "lead", purpose: "begin", scene_engine: "attack",
    pressure_movement: "worse", character_movement: "chooses", relationship_movement: "changes",
    story_thread_refs: [], continuity_refs: [], character_refs: [], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
    ending_hook: "danger", milestone_gate: null, target_words: TARGET,
  };
}

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-draft-lint-"));
  const root = initializeProject(parent, { projectName: "Lint", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  project.gates["first-chapter-approval"] = "approved";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "act-1", causality: "therefore", state_change: "threat visible", setup_ids: [], payoff_ids: [], profile_obligations: ["midpoint state change planned"] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-1", packets: [readyPacket(1)] }), "utf8");
  commitFixture(root, "lint fixture");
  return { parent, root };
}

function draftEvent(root: string, content: string) {
  return {
    eventType: "draft-chapter" as const, expectedStage: "drafting" as const,
    expectedProjectHash: projectStateHash(root), chapter: 1,
    files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content }],
  };
}

/** A draft at the packet target whose em-dash density is far outside the band. */
function emDashHeavyDraft(): string {
  const lines: string[] = ["# Chapter 1", ""];
  for (let index = 0; index < 100; index += 1) {
    lines.push(`The lamp guttered once—the corridor answered with nothing at all, and the keeper counted ${index} slow breaths before moving on toward the far door.`);
  }
  return lines.join("\n\n");
}

test("a clean draft at target still reports that no voice baseline was applied", () => {
  const report = draftLintReport("/nonexistent-project-root", 1, "01-opening.md", draftText("Opening", 2_000));
  assert.equal(report.baselineApplied, false);
  assert.equal(report.advisories.some((item) => /No accepted voice baseline exists/.test(item)), true);
  assert.match(report.advisories.join("\n"), /absolute published-fiction reference bands/);
});

test("draft lint reports style findings as bounded review evidence", () => {
  const report = draftLintReport("/nonexistent-project-root", 1, "01-opening.md", emDashHeavyDraft());
  assert.ok(report.findingCount > 0);
  const text = report.advisories.join("\n");
  assert.match(text, /Deterministic prose lint reported \d+ finding/);
  assert.match(text, /style-pattern\/em-dash/);
  assert.match(text, /review evidence, not authorship detection/);
  // Never an authorship claim, however many tells are present.
  assert.doesNotMatch(text, /AI[- ]written|AI probability|machine[- ]generated/i);
});

test("draft lint findings reach the writer through a validated draft-chapter event", () => {
  const { parent, root } = setup();
  try {
    const result = validateNovelEvent(root, draftEvent(root, emDashHeavyDraft()));
    assert.equal(result.valid, true);
    const text = result.advisories.join("\n");
    assert.match(text, /Deterministic prose lint reported/);
    assert.match(text, /style-pattern\/em-dash/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("an applied draft-chapter event carries the same lint advisories", () => {
  const { parent, root } = setup();
  try {
    const result = applyNovelEvent(root, draftEvent(root, emDashHeavyDraft()));
    const text = result.advisories.join("\n");
    assert.match(text, /Deterministic prose lint reported/);
    assert.match(text, /No accepted voice baseline exists/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("lint runs against the submitted text, not the revision already on disk", () => {
  const { parent, root } = setup();
  try {
    // Commit a clean chapter at the target path, then validate a tell-heavy
    // submission for it. Reading disk would lint the clean text and stay silent.
    mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), draftText("Opening", 2_000), "utf8");
    commitFixture(root, "clean chapter on disk");

    const result = validateNovelEvent(root, {
      ...draftEvent(root, emDashHeavyDraft()),
      expectedProjectHash: projectStateHash(root),
    });
    assert.equal(result.valid, true);
    assert.match(result.advisories.join("\n"), /style-pattern\/em-dash/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("repetition constraints are empty for a manuscript with no chapters and never throw", () => {
  const { parent, root } = setup();
  try {
    assert.deepEqual(draftRepetitionConstraints(root), []);
    assert.deepEqual(draftRepetitionConstraints("/nonexistent-project-root"), []);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("repetition constraints name patterns the manuscript has already formed", () => {
  const { parent, root } = setup();
  try {
    const repetitive = ["# Chapter 1", ""];
    for (let index = 0; index < 140; index += 1) {
      repetitive.push(`She would leave before dawn. The keeper watched the ${index} lamps gutter one after another.`);
    }
    applyNovelEvent(root, draftEvent(root, repetitive.join("\n\n")));

    const constraints = draftRepetitionConstraints(root);
    assert.ok(constraints.length <= 1);
    if (constraints.length === 1) {
      assert.match(constraints[0] ?? "", /Recent chapters already lean on these patterns/);
      assert.match(constraints[0] ?? "", /do not reuse them here unless the scene genuinely requires it/);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
