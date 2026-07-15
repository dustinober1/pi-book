import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  BookStrategySchema,
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceAuditsSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
  defaultBookStrategy,
  defaultResearchLedger,
  defaultTasteProfile,
  defaultVoiceAudits,
  defaultVoiceExperimentIndex,
  defaultVoiceGuardrails,
  type ResearchLedger,
} from "../src/domain/v1-3-schemas.js";
import { v13SchemaForPath } from "../src/domain/v1-3-schema-registry.js";

function rejectsUnknown(value: unknown, schema: object, label: string): void {
  assert.throws(
    () => parseYaml(stringifyYaml({ ...(value as Record<string, unknown>), unknown: true }), schema as never, label),
    /schema validation/i,
  );
}

test("taste profile preserves writer-first precedence and rejects unknown keys", () => {
  const taste = defaultTasteProfile();
  assert.deepEqual(taste.precedence, [
    "explicit-writer-decisions",
    "writer-samples",
    "accepted-voice-baseline",
    "approved-voice-profile",
    "influence-references",
    "genre-defaults",
  ]);
  assert.equal(taste.opening_experiment.status, "not-started");
  assert.doesNotThrow(() => parseYaml(stringifyYaml(taste), TasteProfileSchema, "taste-profile.yaml"));
  rejectsUnknown(taste, TasteProfileSchema, "taste-profile.yaml");
});

test("voice guardrails and experiment index have strict empty defaults", () => {
  const guardrails = defaultVoiceGuardrails();
  const index = defaultVoiceExperimentIndex();
  assert.equal(guardrails.status, "draft");
  assert.equal(guardrails.baseline.path, null);
  assert.deepEqual(index.experiments, []);
  assert.doesNotThrow(() => parseYaml(stringifyYaml(guardrails), VoiceGuardrailsSchema, "voice-guardrails.yaml"));
  assert.doesNotThrow(() => parseYaml(stringifyYaml(index), VoiceExperimentIndexSchema, "voice-experiments/index.yaml"));
  rejectsUnknown(guardrails, VoiceGuardrailsSchema, "voice-guardrails.yaml");
  rejectsUnknown(index, VoiceExperimentIndexSchema, "voice-experiments/index.yaml");
});

test("voice experiment files validate bounded anonymous experiment metadata", () => {
  const experiment = {
    schema_version: "1.0.0",
    id: "VE-001",
    status: "planned",
    source_scene_path: "series/voice-experiments/VE-001/source-scene.md",
    variant_paths: [],
    score_dimensions: ["project-fit", "propulsion", "intimacy", "naturalness", "distinctiveness", "density"],
    accepted_variant: null,
    baseline_path: null,
    source_hash: "",
    created_at: "",
    updated_at: "",
  } as const;
  assert.doesNotThrow(() => parseYaml(stringifyYaml(experiment), VoiceExperimentFileSchema, "experiment.yaml"));
  rejectsUnknown(experiment, VoiceExperimentFileSchema, "experiment.yaml");
});

test("research ledger accepts story-use and knowledge-scope records", () => {
  const ledger: ResearchLedger = defaultResearchLedger();
  ledger.items.push({
    id: "RES-001",
    lane: "story-world",
    claim: "A pressure door requires two independent confirmations.",
    source_ids: ["SRC-001"],
    confidence: "high",
    verified_on: "2026-07-15",
    story_use: {
      chapters: [4],
      dramatic_functions: ["procedural-constraint"],
      decision_affected: "The protagonist cannot safely open the door alone.",
    },
    knowledge_scope: {
      known_by: ["protagonist"],
      incorrectly_believed_by: [],
      unknown_to: ["antagonist"],
    },
    fictionalization: { status: "unchanged", reason: "" },
    risks: [],
    status: "ready",
  });
  const parsed = parseYaml<ResearchLedger>(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger.yaml");
  assert.equal(parsed.items[0]?.story_use.dramatic_functions[0], "procedural-constraint");
  rejectsUnknown(ledger, ResearchLedgerSchema, "research-ledger.yaml");
});

test("book strategy and voice audits remain empty rather than inventing evidence", () => {
  const strategy = defaultBookStrategy();
  const audits = defaultVoiceAudits();
  assert.equal(strategy.reader_promise.core_experience, "");
  assert.deepEqual(strategy.reader_friction.clusters, []);
  assert.deepEqual(audits.audits, []);
  assert.doesNotThrow(() => parseYaml(stringifyYaml(strategy), BookStrategySchema, "book-strategy.yaml"));
  assert.doesNotThrow(() => parseYaml(stringifyYaml(audits), VoiceAuditsSchema, "voice-audits.yaml"));
  rejectsUnknown(strategy, BookStrategySchema, "book-strategy.yaml");
  rejectsUnknown(audits, VoiceAuditsSchema, "voice-audits.yaml");
});

test("1.3 schema registry maps only canonical artifact paths", () => {
  assert.equal(v13SchemaForPath("series/taste-profile.yaml"), TasteProfileSchema);
  assert.equal(v13SchemaForPath("series/voice-guardrails.yaml"), VoiceGuardrailsSchema);
  assert.equal(v13SchemaForPath("series/voice-experiments/index.yaml"), VoiceExperimentIndexSchema);
  assert.equal(v13SchemaForPath("series/voice-experiments/VE-001/experiment.yaml"), VoiceExperimentFileSchema);
  assert.equal(v13SchemaForPath("books/book-01/research-ledger.yaml"), ResearchLedgerSchema);
  assert.equal(v13SchemaForPath("books/book-01/book-strategy.yaml"), BookStrategySchema);
  assert.equal(v13SchemaForPath("books/book-01/voice-audits.yaml"), VoiceAuditsSchema);
  assert.equal(v13SchemaForPath("books/book-01/manuscript/chapters/001.md"), null);
});
