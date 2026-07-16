import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideNextRun } from "../src/application/run.js";
import { guardrailPromotionPrompt, reviewPrompt, voiceAuditPrompt } from "../src/application/prompts.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
import type { GuardrailPromotionCandidate } from "../src/application/revision-learning.js";

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-prompts-"));
  const root = initializeProject(parent, { projectName: "Phase 5 Prompts", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

test("voice audit prompt uses research-update and treats metrics as evidence", () => {
  const { parent, root } = setup();
  try {
    const prompt = voiceAuditPrompt(root, { milestone: "chapter-3", milestone_ref: "chapter-3", chapter_refs: [3], scope: "chapter" });
    assert.match(prompt, /research-update/);
    assert.match(prompt, /voice-audits\.yaml/);
    assert.match(prompt, /evidence, not quotas/i);
    assert.match(prompt, /chapter-3/);
    assert.match(prompt, /do not rewrite manuscript prose/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("milestone review prompt includes voice, scene-state, and recurrence instructions", () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "act-review";
    project.next_gate = "act-1-review";
    project.gates["act-1-review"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const prompt = reviewPrompt(root, "act");
    assert.match(prompt, /voice metrics are evidence, not quotas/i);
    assert.match(prompt, /scene_engine/i);
    assert.match(prompt, /state change/i);
    assert.match(prompt, /three distinct chapters|two milestone reviews/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("normal continuation queues a due Chapter 3 voice audit before more drafting", () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const book = readBook(root);
    book.current_chapter = 3;
    writeFileSync(join(root, "books", "book-01", "BOOK.yaml"), stringifyYaml(book), "utf8");
    writeFileSync(join(root, "books", "book-01", "voice-audits.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      audits: [{ id: "VA-001", scope: "chapter", baseline_hash: "a".repeat(64), run_at: "2026-07-15T12:00:00Z", signals: {}, findings: [], verdict: "stable", status: "approved", milestone: "chapter-1", milestone_ref: "chapter-1", chapter_refs: [1], pov: null, baseline_scope: "project", interpretation: "evidence-only" }],
    }), "utf8");
    const decision = decideNextRun(root);
    assert.equal(decision.action, "voice-audit");
    assert.match(decision.prompt ?? "", /chapter-3/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("promotion prompt asks for a writer decision and limits mutation to strategy evidence", () => {
  const { parent, root } = setup();
  try {
    const candidate: GuardrailPromotionCandidate = {
      pattern_key: "scene-diversity|state-neutral-interview",
      rule: "Every interview must change case, relationship, or power state.",
      source_ticket_ids: ["B01-T001", "B01-T002", "B01-T003"],
      occurrence_chapters: [2, 5, 8], milestone_review_ids: ["MR-001"],
    };
    const prompt = guardrailPromotionPrompt(root, candidate);
    assert.match(prompt, /writer.*approve.*reject/i);
    assert.match(prompt, /research-update/);
    assert.match(prompt, /book-strategy\.yaml/);
    assert.match(prompt, /must not write manuscript/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
