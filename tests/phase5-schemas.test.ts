import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  VoiceAuditsPhase5Schema,
} from "../src/domain/v1-3-audit-schemas.js";
import { completeStrategy } from "./phase4-fixtures.js";

test("legacy Phase 4 strategy, revision tickets, and voice audits remain readable", () => {
  parseYaml(stringifyYaml(completeStrategy()), BookStrategyPhase5Schema, "book-strategy.yaml");
  parseYaml(stringifyYaml({ schema_version: "1.0.0", tickets: [] }), RevisionTicketsPhase5Schema, "revision-tickets.yaml");
  parseYaml(stringifyYaml({ schema_version: "1.0.0", audits: [] }), VoiceAuditsPhase5Schema, "voice-audits.yaml");
});

test("Phase 5 contracts accept recurrence, metric deltas, exceptions, and learning rules", () => {
  const tickets = {
    schema_version: "1.0.0",
    tickets: [{
      id: "B01-T001", severity: "medium", category: "scene-diversity", chapter: 2,
      evidence: "same interview loop", problem: "Repeated state-neutral interview",
      required_change: "Change the scene engine or state movement", protected_constraints: [],
      acceptance_tests: ["State changes"], status: "open",
      recurrence: { pattern_id: "PAT-dialogue-loop", milestone_review: "act-1-review" },
    }],
  };
  parseYaml(stringifyYaml(tickets), RevisionTicketsPhase5Schema, "revision-tickets.yaml");

  const audits = {
    schema_version: "1.0.0",
    audits: [{
      id: "VA-001", scope: "chapter-3", baseline_hash: "a".repeat(64), run_at: "2026-07-15T00:00:00.000Z",
      signals: { dialogue_ratio: 0.4 }, findings: ["Dialogue ratio changed by 0.1"], verdict: "drift-review", status: "draft",
      pov: "Mara", chapters: [3], baseline_metrics: { dialogue_ratio: 0.3 }, deltas: { dialogue_ratio: 0.1 },
      protected_exceptions: ["intentional interrogation density"], assessment: "evidence-only",
    }],
  };
  parseYaml(stringifyYaml(audits), VoiceAuditsPhase5Schema, "voice-audits.yaml");

  const strategy = {
    ...completeStrategy(),
    revision_learning_guardrails: [{
      id: "LRN-001", pattern_id: "PAT-dialogue-loop", rule: "Every interview must change case, relationship, power, or knowledge state.",
      source_ticket_ids: ["B01-T001", "B01-T002", "B01-T003"], distinct_chapters: [2, 4, 6], milestone_reviews: [], status: "proposed",
    }],
  };
  parseYaml(stringifyYaml(strategy), BookStrategyPhase5Schema, "book-strategy.yaml");
  assert.equal(strategy.revision_learning_guardrails.length, 1);
});
