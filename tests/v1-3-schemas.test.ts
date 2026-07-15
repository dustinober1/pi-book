import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { applyTransaction } from "../src/infrastructure/transaction.js";
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
} from "../src/domain/v1-3-schemas.js";
import { v13SchemaForPath } from "../src/domain/v1-3-schema-registry.js";

function researchItem(status: "planned" | "ready", dramaticUses: string[]) {
  return {
    id: "RES-001",
    lane: "story-world",
    claim: status === "ready" ? "The system requires two operators." : "",
    source_ids: status === "ready" ? ["SRC-001"] : [],
    confidence: status === "ready" ? "high" : "low",
    verified_on: status === "ready" ? "2026-07-15" : null,
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    risk: status === "ready" ? ["Procedure varies by jurisdiction."] : [],
    dramatic_uses: dramaticUses,
    story_use: { chapters: [], decision_affected: "" },
    notes: "",
    status,
  };
}

function acceptedVoiceExperiment() {
  return {
    schema_version: "1.0.0",
    id: "VE-001",
    status: "accepted",
    source_scene_path: "series/voice-experiments/VE-001/source-scene.md",
    source_scene_hash: "a".repeat(64),
    variants: [
      { id: "A", path: "series/voice-experiments/VE-001/variant-a.md", content_hash: "b".repeat(64) },
      { id: "B", path: "series/voice-experiments/VE-001/variant-b.md", content_hash: "c".repeat(64) },
      { id: "C", path: "series/voice-experiments/VE-001/variant-c.md", content_hash: "d".repeat(64) },
    ],
    scores: [],
    accepted_traits: [],
    baseline_path: "series/voice-experiments/VE-001/baseline.md",
    baseline_hash: "e".repeat(64),
  };
}

test("1.3 defaults validate as strict empty evidence artifacts", () => {
  parseYaml(stringifyYaml(defaultTasteProfile()), TasteProfileSchema, "taste-profile.yaml");
  parseYaml(stringifyYaml(defaultVoiceGuardrails()), VoiceGuardrailsSchema, "voice-guardrails.yaml");
  parseYaml(stringifyYaml(defaultVoiceExperimentIndex()), VoiceExperimentIndexSchema, "voice-experiments/index.yaml");
  parseYaml(stringifyYaml(defaultResearchLedger()), ResearchLedgerSchema, "research-ledger.yaml");
  parseYaml(stringifyYaml(defaultBookStrategy()), BookStrategySchema, "book-strategy.yaml");
  parseYaml(stringifyYaml(defaultVoiceAudits()), VoiceAuditsSchema, "voice-audits.yaml");
});

test("1.3 schemas reject unknown fields while allowing incomplete planned research", () => {
  assert.throws(
    () => parseYaml(stringifyYaml({ ...defaultTasteProfile(), extra: true }), TasteProfileSchema, "taste-profile.yaml"),
    /schema validation/i,
  );
  parseYaml(stringifyYaml({ schema_version: "1.0.0", items: [researchItem("planned", [])] }), ResearchLedgerSchema, "research-ledger.yaml");
});

test("ready research requires at least one dramatic use", () => {
  assert.throws(
    () => parseYaml(stringifyYaml({ schema_version: "1.0.0", items: [researchItem("ready", [])] }), ResearchLedgerSchema, "research-ledger.yaml"),
    /schema validation/i,
  );
  parseYaml(
    stringifyYaml({ schema_version: "1.0.0", items: [researchItem("ready", ["procedural-constraint"])] }),
    ResearchLedgerSchema,
    "research-ledger.yaml",
  );
});

test("accepted voice experiments require anonymous variants and a non-null baseline", () => {
  const value = acceptedVoiceExperiment();
  parseYaml(stringifyYaml(value), VoiceExperimentFileSchema, "experiment.yaml");
  for (const invalid of [
    { ...value, variants: undefined },
    { ...value, baseline_path: undefined },
    { ...value, baseline_hash: undefined },
    { ...value, baseline_path: null },
    { ...value, baseline_hash: null },
  ]) assert.throws(() => parseYaml(stringifyYaml(invalid), VoiceExperimentFileSchema, "experiment.yaml"), /schema validation/i);
});

test("planned voice experiments may exist before variants or a baseline are produced", () => {
  const value = {
    ...acceptedVoiceExperiment(),
    status: "planned",
    variants: [],
    baseline_path: null,
    baseline_hash: null,
  };
  parseYaml(stringifyYaml(value), VoiceExperimentFileSchema, "experiment.yaml");
});

test("the 1.3 registry recognizes every new canonical YAML path", () => {
  for (const path of [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    "series/voice-experiments/VE-001/experiment.yaml",
    "books/book-01/research-ledger.yaml",
    "books/book-01/book-strategy.yaml",
    "books/book-01/voice-audits.yaml",
  ]) assert.ok(v13SchemaForPath(path), path);
  assert.equal(v13SchemaForPath("books/book-01/manuscript/chapters/001.md"), null);
});

test("transactions enforce the 1.3 schema registry", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-v13-schema-"));
  try {
    assert.throws(() => applyTransaction(root, [{
      path: "series/taste-profile.yaml",
      content: stringifyYaml({ ...defaultTasteProfile(), extra: true }),
    }]), /schema validation/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
