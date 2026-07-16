import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { applyGuardrailDecision, promotionCandidates } from "../src/application/revision-learning.js";
import { defaultBookStrategy } from "../src/domain/v1-3-schemas.js";
import type { BookStrategyPhase5, RevisionTicketsPhase5 } from "../src/domain/v1-3-audit-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { synthesizeTickets, type ReviewFinding } from "../src/review/review.js";

function setup(stage: "drafting" | "act-review"): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-event-"));
  const root = initializeProject(parent, { projectName: "Phase 5 Event", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return { parent, root };
}

function finding(chapter: number): ReviewFinding {
  return {
    severity: "medium", category: "scene-diversity", chapter,
    evidence: `Chapter ${chapter} repeats a state-neutral interview.`,
    problem: "Interview does not change case, relationship, or power state",
    requiredChange: "Every interview must change case, relationship, or power state.",
    acceptanceTests: ["The scene changes state."],
  };
}

test("review event rejects a promotion candidate below the exact recurrence threshold", () => {
  const { parent, root } = setup("act-review");
  try {
    const tickets = {
      schema_version: "1.0.0",
      tickets: [{
        id: "B01-T001", severity: "medium", category: "scene-diversity", chapter: 2,
        evidence: "one occurrence", problem: "Interview does not change state", required_change: "Change state",
        protected_constraints: [], acceptance_tests: [], status: "open",
        recurrence: { pattern_key: "scene-diversity|interview", occurrence_chapters: [2], milestone_review_ids: ["MR-001"], promotion_status: "candidate", candidate_guardrail: "Every interview changes state." },
      }],
    };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "review", expectedStage: "act-review", expectedProjectHash: projectStateHash(root), scope: "act",
      files: [
        { path: "books/book-01/review-report.md", content: "# Review\n\nEvidence." },
        { path: "books/book-01/revision-tickets.yaml", content: stringifyYaml(tickets) },
      ],
    }), /three distinct chapters|two milestone reviews|promotion candidate/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("review event accepts a typed milestone voice audit and recurrence evidence", () => {
  const { parent, root } = setup("act-review");
  try {
    let tickets = { schema_version: "1.0.0", tickets: [] } as RevisionTicketsPhase5;
    tickets = synthesizeTickets(tickets, [finding(2)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
    const audit = {
      schema_version: "1.0.0",
      audits: [{
        id: "VA-001", scope: "act", baseline_hash: "a".repeat(64), run_at: "2026-07-15T12:00:00Z",
        signals: { dialogue_ratio: 0.02 }, findings: ["Evidence only"], verdict: "stable", status: "approved",
        milestone: "act-boundary", milestone_ref: "act-1-review", chapter_refs: [2], pov: null,
        baseline_scope: "project", interpretation: "evidence-only",
      }],
    };
    const result = applyNovelEvent(root, {
      eventType: "review", expectedStage: "act-review", expectedProjectHash: projectStateHash(root), scope: "act",
      files: [
        { path: "books/book-01/review-report.md", content: "# Review\n\nEvidence." },
        { path: "books/book-01/revision-tickets.yaml", content: stringifyYaml(tickets) },
        { path: "books/book-01/voice-audits.yaml", content: stringifyYaml(audit) },
      ],
    });
    assert.ok(result.changed.includes("books/book-01/voice-audits.yaml"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("writer-approved promotion updates strategy evidence without manuscript writes or stage changes", () => {
  const { parent, root } = setup("drafting");
  try {
    let tickets = { schema_version: "1.0.0", tickets: [] } as RevisionTicketsPhase5;
    for (const chapter of [2, 5, 8]) tickets = synthesizeTickets(tickets, [finding(chapter)], 1, { milestoneReviewId: "MR-001" }) as RevisionTicketsPhase5;
    writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml(tickets), "utf8");
    const candidate = promotionCandidates(tickets)[0]!;
    const strategy = applyGuardrailDecision(defaultBookStrategy() as BookStrategyPhase5, candidate, "approved", "2026-07-15T13:00:00Z");
    const beforeStage = readProject(root).current_stage;
    const result = applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "drafting", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/book-strategy.yaml", content: stringifyYaml(strategy) }],
    });
    assert.equal(result.stage, beforeStage);
    assert.equal(result.changed.some((path) => path.includes("manuscript/chapters")), false);
    assert.deepEqual(result.changed.filter((path) => path.startsWith("books/book-01/")), ["books/book-01/book-strategy.yaml"]);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
