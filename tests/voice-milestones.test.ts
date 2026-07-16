import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
import {
  assertVoiceAuditCompleteForGate,
  nextVoiceAuditRequirement,
  voiceAuditRequirementForScope,
} from "../src/application/voice-drift.js";

function audit(milestone: string, milestoneRef: string, chapters: number[]) {
  return {
    id: `VA-${milestoneRef.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`,
    scope: milestone, baseline_hash: "a".repeat(64), run_at: "2026-07-15T12:00:00Z",
    signals: {}, findings: [], verdict: "stable", status: "approved",
    milestone, milestone_ref: milestoneRef, chapter_refs: chapters, pov: null,
    baseline_scope: "project", interpretation: "evidence-only",
  };
}

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-voice-milestone-"));
  try {
    const root = initializeProject(parent, { projectName: "Milestones", projectType: "standalone", profile: "thriller" });
    return { parent, root };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
}

function writeAudits(root: string, audits: unknown[]): void {
  writeFileSync(join(root, "books", "book-01", "voice-audits.yaml"), stringifyYaml({ schema_version: "1.0.0", audits }), "utf8");
}

test("Chapter 1 audit is due while the first chapter gate is pending", () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = "first-chapter-approval";
    project.gates["first-chapter-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.current_chapter = 1;
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const due = nextVoiceAuditRequirement(root);
    assert.ok(due, "Expected a voice audit requirement to be returned");
    assert.equal(due.milestone, "chapter-1");
    assert.equal(due.milestone_ref, "chapter-1");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("Chapter 3 audit becomes due before drafting continues", () => {
  const { parent, root } = setup();
  try {
    writeAudits(root, [audit("chapter-1", "chapter-1", [1])]);
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.current_chapter = 3;
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const due = nextVoiceAuditRequirement(root);
    assert.ok(due, "Expected a voice audit requirement to be returned");
    assert.equal(due.milestone, "chapter-3");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a missed Chapter 3 audit cannot be bypassed by a later act gate", () => {
  const { parent, root } = setup();
  try {
    writeAudits(root, [audit("chapter-1", "chapter-1", [1])]);
    const project = readProject(root);
    project.current_stage = "act-review";
    project.next_gate = "act-1-review";
    project.gates["act-1-review"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.current_chapter = 8;
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    const due = nextVoiceAuditRequirement(root);
    assert.ok(due, "Expected the missed Chapter 3 audit to be returned");
    assert.equal(due.milestone_ref, "chapter-3");
    assert.throws(() => assertVoiceAuditCompleteForGate(root, "act-1-review"), /chapter-3/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("each act boundary uses the active gate as its stable milestone reference", () => {
  const { parent, root } = setup();
  try {
    writeAudits(root, [audit("chapter-1", "chapter-1", [1]), audit("chapter-3", "chapter-3", [3])]);
    const project = readProject(root);
    project.current_stage = "act-review";
    project.next_gate = "act-1-review";
    project.gates["act-1-review"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const due = nextVoiceAuditRequirement(root);
    assert.ok(due, "Expected a voice audit requirement to be returned");
    assert.equal(due.milestone, "act-boundary");
    assert.equal(due.milestone_ref, "act-1-review");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("manuscript review requires its own audit evidence", () => {
  const { parent, root } = setup();
  try {
    writeAudits(root, [audit("chapter-1", "chapter-1", [1]), audit("chapter-3", "chapter-3", [3])]);
    const project = readProject(root);
    project.current_stage = "manuscript-review";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const due = nextVoiceAuditRequirement(root);
    assert.ok(due, "Expected a voice audit requirement to be returned");
    assert.equal(due.milestone, "manuscript-review");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("explicit recalibration creates a recalibration requirement", () => {
  const { parent, root } = setup();
  try {
    const requirement = voiceAuditRequirementForScope(root, "recalibration");
    assert.ok(requirement, "Expected a recalibration requirement to be returned");
    assert.equal(requirement.milestone, "recalibration");
    assert.match(requirement.milestone_ref, /^recalibration-/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("gate approval requires its audit for new projects but keeps older projects compatible", () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = "first-chapter-approval";
    project.gates["first-chapter-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    assert.throws(() => assertVoiceAuditCompleteForGate(root, "first-chapter-approval"), /voice audit/i);
    unlinkSync(join(root, "books", "book-01", "voice-audits.yaml"));
    assert.doesNotThrow(() => assertVoiceAuditCompleteForGate(root, "first-chapter-approval"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
