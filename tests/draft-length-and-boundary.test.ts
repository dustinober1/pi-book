import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash, validateNovelEvent } from "../src/application/events.js";
import {
  DRAFT_LENGTH_ADVISORY_FLOOR,
  DRAFT_LENGTH_BLOCKING_FLOOR,
  draftLengthFinding,
} from "../src/application/draft-length.js";
import { outOfBandWriteFindings } from "../src/application/working-tree-guard.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { commitFixture, draftText } from "./support/draft-fixture.js";

const TARGET = 1000;

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
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-draft-length-"));
  const root = initializeProject(parent, { projectName: "Length", projectType: "standalone", profile: "thriller" });
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
  commitFixture(root, "length fixture");
  return { parent, root };
}

function draftEvent(root: string, content: string) {
  return {
    eventType: "draft-chapter" as const, expectedStage: "drafting" as const,
    expectedProjectHash: projectStateHash(root), chapter: 1,
    files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content }],
  };
}

test("a draft inside the planned band produces no length finding", () => {
  assert.equal(draftLengthFinding(1, 1000, draftText("Opening", 950)), null);
  assert.equal(draftLengthFinding(1, 1000, draftText("Opening", 1050)), null);
});

test("a draft below the guarded floor is an advisory that names both counts", () => {
  const finding = draftLengthFinding(6, 9000, draftText("The Service Hatch", 7000));
  assert.equal(finding?.severity, "advisory");
  assert.match(finding?.message ?? "", /9,000/);
  assert.match(finding?.message ?? "", /78%/);
  assert.match(finding?.message ?? "", /shortfall/);
});

test("a draft far below the plan is a blocker naming the accepted range", () => {
  // The real session that motivated this drafted 5,211 words against a 9,000
  // word packet and nothing anywhere reported it.
  const finding = draftLengthFinding(6, 9000, draftText("The Service Hatch", 5211));
  assert.equal(finding?.severity, "blocker");
  assert.match(finding?.message ?? "", /5,400 words to 13,500 words/);
  assert.match(finding?.message ?? "", /plan-change/);
});

test("an overlong draft is reported as an overrun rather than a shortfall", () => {
  const finding = draftLengthFinding(2, 1000, draftText("Long", 1300));
  assert.equal(finding?.severity, "advisory");
  assert.match(finding?.message ?? "", /overrun/);
  assert.doesNotMatch(finding?.message ?? "", /shortfall/);
});

test("a zero or absent target is not a finding", () => {
  assert.equal(draftLengthFinding(1, 0, draftText("Opening", 10)), null);
  assert.equal(draftLengthFinding(1, Number.NaN, draftText("Opening", 10)), null);
});

test("the blocking floor is well below the advisory floor", () => {
  assert.ok(DRAFT_LENGTH_BLOCKING_FLOOR < DRAFT_LENGTH_ADVISORY_FLOOR);
});

test("a short draft-chapter event is rejected as a retryable payload problem", () => {
  const { parent, root } = setup();
  try {
    const result = validateNovelEvent(root, draftEvent(root, draftText("Opening", 200)));
    assert.equal(result.valid, false);
    assert.match(result.rejection?.message ?? "", /Draft-length validation blocked draft-chapter/);
    assert.equal(result.rejection?.code, "payload-validation");
    assert.equal(result.rejection?.retryable, true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a draft inside the band applies and carries the guarded-execution disclosure", () => {
  const { parent, root } = setup();
  try {
    const result = applyNovelEvent(root, draftEvent(root, draftText("Opening", 950)));
    const disclosure = result.advisories.find((item) => /without guarded scene execution/.test(item));
    assert.ok(disclosure, `expected a guarded-execution advisory, got ${JSON.stringify(result.advisories)}`);
    assert.match(disclosure ?? "", /no scene critics, no targeted repair, and no ordered acceptance/);
    assert.match(disclosure ?? "", /books\/book-01\/contracts\/chapters\/CH-001\.yaml/);
    assert.match(disclosure ?? "", /Say so plainly in your summary/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the dry run reports the same disclosure before anything is applied", () => {
  const { parent, root } = setup();
  try {
    const result = validateNovelEvent(root, draftEvent(root, draftText("Opening", 950)));
    assert.equal(result.valid, true);
    assert.ok(result.advisories.some((item) => /without guarded scene execution/.test(item)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an advisory-band draft applies and reports the shortfall alongside the disclosure", () => {
  const { parent, root } = setup();
  try {
    const result = applyNovelEvent(root, draftEvent(root, draftText("Opening", 700)));
    assert.ok(result.advisories.some((item) => /outside the planned range/.test(item)));
    assert.ok(result.advisories.some((item) => /without guarded scene execution/.test(item)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a submitted path written out of band with matching content is an advisory", () => {
  const { parent, root } = setup();
  try {
    const content = draftText("Opening", 950);
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), content, "utf8");
    const findings = outOfBandWriteFindings(root, [{ path: "books/book-01/manuscript/chapters/01-opening.md", content }]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.severity, "advisory");
    assert.match(findings[0]?.message ?? "", /already written into the project tree outside a guarded event/);
    assert.equal(validateNovelEvent(root, draftEvent(root, content)).valid, true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a submitted path holding different uncommitted work is a blocker", () => {
  const { parent, root } = setup();
  try {
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), draftText("Stale", 950), "utf8");
    const result = validateNovelEvent(root, draftEvent(root, draftText("Opening", 950)));
    assert.equal(result.valid, false);
    assert.match(result.rejection?.message ?? "", /Working-tree validation blocked draft-chapter/);
    assert.match(result.rejection?.message ?? "", /would discard that work/);
    assert.equal(result.rejection?.code, "payload-validation");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a clean project tree produces no working-tree findings", () => {
  const { parent, root } = setup();
  try {
    assert.deepEqual(outOfBandWriteFindings(root, [{ path: "books/book-01/manuscript/chapters/01-opening.md", content: draftText("Opening", 950) }]), []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
