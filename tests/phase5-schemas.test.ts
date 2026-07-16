import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  VoiceAuditsPhase5Schema,
} from "../src/domain/v1-3-audit-schemas.js";

test("legacy Phase 1 voice audit records remain readable", () => {
  const value = {
    schema_version: "1.0.0",
    audits: [{
      id: "VA-001", scope: "chapter-1", baseline_hash: "a".repeat(64), run_at: "2026-07-15T12:00:00Z",
      signals: { dialogue_ratio: 0.25 }, findings: [], verdict: "stable", status: "approved",
    }],
  };
  parseYaml(stringifyYaml(value), VoiceAuditsPhase5Schema, "voice-audits.yaml");
});

test("extended voice audits retain milestone, POV, metrics, deltas, and protected exceptions", () => {
  const metrics = {
    sample_words: 100, sentence_count: 10, paragraph_count: 4,
    sentence_mean: 10, sentence_median: 9, sentence_p90: 15,
    paragraph_mean: 25, paragraph_median: 24,
    dialogue_ratio: 0.2, fragment_ratio: 0.1, rhetorical_question_rate: 0.1,
    filter_word_rate: 0.02, body_language_repetition_rate: 0.01, interiority_density: 0.03,
  };
  const value = {
    schema_version: "1.0.0",
    audits: [{
      id: "VA-002", scope: "chapter-3", baseline_hash: "b".repeat(64), run_at: "2026-07-15T13:00:00Z",
      signals: { dialogue_ratio: 0.05 }, findings: ["evidence only"], verdict: "accepted-variation", status: "approved",
      milestone: "chapter-3", milestone_ref: "chapter-3", chapter_refs: [3], pov: "Mara",
      baseline_scope: "pov", baseline_metrics: metrics, observed_metrics: metrics,
      deltas: { dialogue_ratio: 0 }, interpretation: "evidence-only",
      protected_exceptions: [{ id: "EX-001", signal: "fragment_ratio", reason: "panic scene", status: "approved" }],
    }],
  };
  parseYaml(stringifyYaml(value), VoiceAuditsPhase5Schema, "voice-audits.yaml");
});

test("metric rates outside zero to one are rejected", () => {
  const value = {
    schema_version: "1.0.0",
    audits: [{
      id: "VA-003", scope: "chapter-3", baseline_hash: "c".repeat(64), run_at: "2026-07-15T13:00:00Z",
      signals: {}, findings: [], verdict: "stable", status: "approved",
      milestone: "chapter-3", milestone_ref: "chapter-3", chapter_refs: [3], pov: null,
      baseline_scope: "project",
      baseline_metrics: { sample_words: 10, sentence_count: 1, paragraph_count: 1, sentence_mean: 10, sentence_median: 10, sentence_p90: 10, paragraph_mean: 10, paragraph_median: 10, dialogue_ratio: 2, fragment_ratio: 0, rhetorical_question_rate: 0, filter_word_rate: 0, body_language_repetition_rate: 0, interiority_density: 0 },
      observed_metrics: { sample_words: 10, sentence_count: 1, paragraph_count: 1, sentence_mean: 10, sentence_median: 10, sentence_p90: 10, paragraph_mean: 10, paragraph_median: 10, dialogue_ratio: 0, fragment_ratio: 0, rhetorical_question_rate: 0, filter_word_rate: 0, body_language_repetition_rate: 0, interiority_density: 0 },
      deltas: {}, interpretation: "evidence-only", protected_exceptions: [],
    }],
  };
  assert.throws(() => parseYaml(stringifyYaml(value), VoiceAuditsPhase5Schema, "voice-audits.yaml"), /dialogue_ratio/i);
});

test("revision recurrence and learned guardrail extensions are optional and typed", () => {
  const tickets = {
    schema_version: "1.0.0",
    tickets: [{
      id: "B01-T001", severity: "medium", category: "scene-diversity", chapter: 2,
      evidence: "repeated interview", problem: "Interview does not change state", required_change: "Change the state",
      protected_constraints: [], acceptance_tests: [], status: "open",
      recurrence: {
        pattern_key: "scene-diversity|interview-does-not-change-state",
        occurrence_chapters: [2, 5, 8], milestone_review_ids: ["MR-001"],
        promotion_status: "candidate", candidate_guardrail: "Every interview must change case, relationship, or power state.",
      },
    }],
  };
  parseYaml(stringifyYaml(tickets), RevisionTicketsPhase5Schema, "revision-tickets.yaml");

  const strategy = {
    schema_version: "1.0.0", reader_promise: { statement: "promise", required_experiences: ["experience"] }, expectation_map: [],
    reader_friction: { observations: [], clusters: [], accepted_tradeoffs: [] }, originality: { risks: [], mitigations: [] },
    review_derived_guardrails: [{
      id: "GR-001", rule: "Every interview must change state.", source_cluster_ids: [], status: "approved",
      source_ticket_ids: ["B01-T001"], source_milestone_ids: ["MR-001"], approved_at: "2026-07-15T14:00:00Z",
    }], plan_stress_test: [],
  };
  parseYaml(stringifyYaml(strategy), BookStrategyPhase5Schema, "book-strategy.yaml");
});
