import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { packetReferenceFindings } from "../src/application/integrity.js";
import { defaultBookStrategy, defaultResearchLedger } from "../src/domain/v1-3-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-phase3-")); }

function readyLedger(sourceId = "SRC-001") {
  const ledger = defaultResearchLedger();
  ledger.items.push({
    id: "RES-001", lane: "story-world", claim: "A two-person release procedure is required.",
    source_ids: [sourceId], confidence: "high", verified_on: "2026-07-15",
    fictionalization: { status: "simplified", reason: "Jurisdiction details compressed." },
    knowledge_scope: { known_by: ["lead"], incorrectly_believed_by: [], unknown_to: ["antagonist"] },
    risk: ["procedure varies"], dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [2], decision_affected: "The lead must recruit a second operator." },
    notes: "", status: "ready",
  });
  return ledger;
}

function packet(requiredResearch: string[]) {
  return {
    chapter: 2, title: "Second", status: "ready" as const, pov: "lead", purpose: "escalate",
    scene_engine: "operation", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "trust changes", story_thread_refs: [], continuity_refs: [], character_refs: ["lead"],
    required_research: requiredResearch, profile_fields: {}, ending_hook: "danger", milestone_gate: null, target_words: 1800,
  };
}

const canon = { schema_version: "1.0.0" as const, facts: [], relationships: [] };
const threads = { schema_version: "1.0.0" as const, threads: [] };
const plot = { schema_version: "1.0.0" as const, acts: [], chapters: [{ chapter: 2, act: "act-1", causality: "therefore", state_change: "changed", setup_ids: [], payoff_ids: [], profile_obligations: [] }] };

test("research-update rejects a ready claim without source provenance", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Guard", projectType: "standalone", profile: "thriller" });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/research-ledger.yaml", content: stringifyYaml(readyLedger()) }],
    }), /missing source|provenance|SRC-001/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("research-update rejects reader-friction confidence above the evidence ceiling", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Friction Guard", projectType: "standalone", profile: "thriller" });
    const strategy = defaultBookStrategy();
    strategy.reader_friction.observations = [
      { id: "OBS-001", title: "A", source_location: "s1", observed_on: "2026-07-15", rating: 2, paraphrase: "Slow middle.", short_excerpt: "", genre_relevance: "high", execution_relevance: "high", category: "pacing-problem", sentiment: "negative" },
      { id: "OBS-002", title: "A", source_location: "s2", observed_on: "2026-07-15", rating: 2, paraphrase: "Middle repeats.", short_excerpt: "", genre_relevance: "high", execution_relevance: "high", category: "pacing-problem", sentiment: "negative" },
      { id: "OBS-003", title: "B", source_location: "s3", observed_on: "2026-07-15", rating: 3, paraphrase: "Mixed pacing.", short_excerpt: "", genre_relevance: "high", execution_relevance: "high", category: "pacing-problem", sentiment: "mixed" },
    ];
    strategy.reader_friction.clusters = [{ id: "CLU-001", label: "Middle pacing", observation_ids: ["OBS-001", "OBS-002", "OBS-003"], titles_affected: ["A", "B"], confidence: "strong", positive_counterweights: [], decision: null, guardrail: null }];
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/book-strategy.yaml", content: stringifyYaml(strategy) }],
    }), /confidence|strong|moderate/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("public-review research updates do not alter manuscript reader evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Separation", projectType: "standalone", profile: "romantasy" });
    const readerPath = join(root, "books", "book-01", "reader-experiments.yaml");
    const before = readFileSync(readerPath, "utf8");
    applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/book-strategy.yaml", content: stringifyYaml(defaultBookStrategy()) }],
    });
    assert.equal(readFileSync(readerPath, "utf8"), before);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("ready packets require ready research-ledger items while legacy source IDs remain advisory", () => {
  const sources = { schema_version: "1.0.0" as const, sources: [{ id: "SRC-001", type: "book", title: "Legacy", location: "notes", verified_on: null, supports: [], notes: "" }] };
  const researching = defaultResearchLedger();
  researching.items.push({
    id: "RES-001", lane: "story-world", claim: "", source_ids: [], confidence: "low", verified_on: null,
    fictionalization: { status: "unchanged", reason: "" }, knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    risk: [], dramatic_uses: [], story_use: { chapters: [], decision_affected: "" }, notes: "", status: "researching",
  });
  assert.ok(packetReferenceFindings(packet(["RES-001"]), canon, threads, sources, plot, researching).some((item) => item.severity === "blocker" && /not ready/i.test(item.message)));
  assert.ok(packetReferenceFindings(packet(["SRC-001"]), canon, threads, sources, plot, researching).some((item) => item.severity === "warning" && /legacy/i.test(item.message)));
  assert.equal(packetReferenceFindings(packet(["RES-001"]), canon, threads, sources, plot, readyLedger("SRC-001")).some((item) => item.severity === "blocker"), false);
});
