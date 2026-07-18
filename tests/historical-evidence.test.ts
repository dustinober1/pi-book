import test from "node:test";
import assert from "node:assert/strict";
import type { ChapterQueueState, GenreConfig, PlotGridState } from "../src/domain/schemas.js";
import type { HistoricalContext, InventionLedger } from "../src/domain/historical-fiction.js";
import type { SourceRegisterV13 } from "../src/domain/v1-3-research-schemas.js";
import type { ResearchLedger } from "../src/domain/v1-3-schemas.js";
import type { DecisionLedger } from "../src/domain/v1-4-schemas.js";
import { defaultHistoricalContext, defaultInventionLedger } from "../src/domain/historical-fiction.js";
import { historicalFictionProfile } from "../src/profiles/historical-fiction.js";
import { historicalIntegrityFindings, type HistoricalIntegrityInput } from "../src/application/historical-integrity.js";

function fixture(): HistoricalIntegrityInput {
  const genre = historicalFictionProfile.defaultGenreConfig();
  const context: HistoricalContext = {
    ...defaultHistoricalContext("book-01"),
    temporal_scope: "Paris, 1848",
    geographic_scope: "Paris",
    calendar: "Gregorian display labels",
    chronology: [{
      id: "HIST-001", sequence: 1, display_date: "24 February 1848", certainty: "documented",
      event: "The monarchy falls.", source_ids: ["SRC-001"], research_ids: ["RES-001"],
      story_effect: "The household loses official protection.", uncertainty: "", invention_ref: null,
    }],
    constraints: [{
      id: "HC-001", category: "transport", statement: "Barricades block carriage routes.",
      dramatic_consequence: "The protagonist must cross on foot.", source_ids: ["SRC-001"],
      research_ids: ["RES-001"], risk: "high", confidence: "high",
    }],
    knowledge_boundaries: [{
      id: "KB-001", character_or_group: "Lucie", as_of: "HIST-001",
      known: ["The palace is abandoned."], believed: [], mistaken: [],
      cannot_yet_know: ["The king has abdicated."], research_ids: ["RES-001"],
    }],
  };
  const inventions: InventionLedger = {
    ...defaultInventionLedger("book-01"),
    entries: [{
      id: "INV-001", claim: "Lucie crosses a private courtyard.", classification: "invented",
      risk: "low", source_ids: [], research_ids: [], rationale: "The household is fictional.",
      story_necessity: "Provides a route around the barricade.", affected_chapters: [1],
      portrayal_risks: [], continuity_risks: [], disclosure: "none", writer_decision_id: null,
      major_counterfactual: false,
    }],
  };
  const research: ResearchLedger = { schema_version: "1.0.0", items: [{
    id: "RES-001", lane: "story-world", claim: "Barricades disrupted carriage traffic.",
    source_ids: ["SRC-001"], confidence: "high", verified_on: "2026-07-18",
    risk: ["transport"], dramatic_uses: ["procedural-constraint"], status: "ready",
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    story_use: { chapters: [1], decision_affected: "Lucie crosses the district on foot." }, notes: "",
  }] };
  const sources: SourceRegisterV13 = { schema_version: "1.0.0", sources: [{
    id: "SRC-001", type: "book", title: "Paris in 1848", location: "library",
    verified_on: "2026-07-18", supports: ["Barricades disrupted traffic."], notes: "",
    reliability: "high", observed_on: null, supports_research_ids: ["RES-001"],
  }] };
  const queue: ChapterQueueState = { schema_version: "1.0.0", active_window: "chapter-1", packets: [{
    chapter: 1, title: "The Barricade", status: "ready", pov: "Lucie", purpose: "cross the city",
    scene_engine: "journey", pressure_movement: "the safe route closes", character_movement: "Lucie acts",
    relationship_movement: "trust strains", story_thread_refs: [], continuity_refs: [], character_refs: [],
    required_research: ["RES-001"], profile_fields: {
      historical_risk: "high", chronology_refs: ["HIST-001"], constraint_refs: ["HC-001"],
      invention_refs: ["INV-001"], knowledge_boundary: "KB-001",
      historical_pressure: "Barricades make the direct route impossible.",
      material_world: "Broken paving stones become fortifications.",
    }, ending_hook: "The courtyard gate is chained.", milestone_gate: null, target_words: 2500,
  }] };
  const plot: PlotGridState = { schema_version: "1.0.0", acts: [], chapters: [{
    chapter: 1, act: "act-1", causality: "Because the route closes, Lucie crosses the courtyard.",
    state_change: "Lucie is trapped inside the district.", setup_ids: [], payoff_ids: [], profile_obligations: [],
  }] };
  const decisions: DecisionLedger = { schema_version: "1.0.0", assumptions: [], decisions: [] };
  return { genre, context, inventions, research, sources, queue, plot, decisions };
}

function codes(input: HistoricalIntegrityInput): string[] {
  return historicalIntegrityFindings(input).map((finding) => finding.code);
}

test("complete historical evidence joins without findings", () => {
  assert.deepEqual(historicalIntegrityFindings(fixture()), []);
});

test("historical integrity rejects settings drift duplicate IDs and unknown references", () => {
  const settingsDrift = fixture();
  settingsDrift.context.settings.story_mode = "war";
  assert.ok(codes(settingsDrift).includes("historical-settings-mismatch"));

  const duplicate = fixture();
  duplicate.context.chronology.push({ ...duplicate.context.chronology[0]!, event: "A duplicate record." });
  assert.ok(codes(duplicate).includes("duplicate-historical-id"));

  const unknown = fixture();
  unknown.queue.packets[0]!.profile_fields["chronology_refs"] = ["HIST-999"];
  unknown.queue.packets[0]!.profile_fields["constraint_refs"] = ["HC-999"];
  unknown.queue.packets[0]!.profile_fields["invention_refs"] = ["INV-999"];
  unknown.queue.packets[0]!.profile_fields["knowledge_boundary"] = "KB-999";
  const unknownCodes = codes(unknown);
  assert.ok(unknownCodes.includes("unknown-chronology-reference"));
  assert.ok(unknownCodes.includes("unknown-constraint-reference"));
  assert.ok(unknownCodes.includes("unknown-invention-reference"));
  assert.ok(unknownCodes.includes("unknown-knowledge-boundary"));
});

test("historical integrity enforces chronology sequence and affected chapters", () => {
  const input = fixture();
  input.context.chronology.push({
    ...input.context.chronology[0]!, id: "HIST-002", sequence: 1, event: "Another event.",
  });
  input.inventions.entries[0]!.affected_chapters = [99];
  const result = codes(input);
  assert.ok(result.includes("duplicate-chronology-sequence"));
  assert.ok(result.includes("unknown-affected-chapter"));
});

test("historical packet risk requires proportionate ready research or declared invention", () => {
  const high = fixture();
  high.research.items[0]!.confidence = "low";
  assert.ok(codes(high).includes("high-risk-research-required"));

  const medium = fixture();
  medium.queue.packets[0]!.profile_fields["historical_risk"] = "medium";
  medium.queue.packets[0]!.required_research = [];
  medium.queue.packets[0]!.profile_fields["invention_refs"] = [];
  assert.ok(codes(medium).includes("medium-risk-support-required"));

  const low = fixture();
  low.queue.packets[0]!.profile_fields["historical_risk"] = "low";
  low.queue.packets[0]!.required_research = [];
  low.queue.packets[0]!.profile_fields["invention_refs"] = [];
  assert.equal(codes(low).includes("medium-risk-support-required"), false);
  assert.equal(codes(low).includes("high-risk-research-required"), false);
});

test("major counterfactuals require permissive policy and an exact active writer decision", () => {
  const blocked = fixture();
  blocked.inventions.entries[0] = {
    ...blocked.inventions.entries[0]!, classification: "counterfactual", risk: "high",
    disclosure: "prominent", major_counterfactual: true, writer_decision_id: "DEC-001",
  };
  let result = codes(blocked);
  assert.ok(result.includes("major-counterfactual-prohibited"));
  assert.ok(result.includes("historical-invention-decision-required"));

  const approved = fixture();
  (approved.genre.settings as Record<string, unknown>)["counterfactual_policy"] = "explicit-writer-approved";
  approved.context.settings.counterfactual_policy = "explicit-writer-approved";
  approved.inventions.entries[0] = {
    ...approved.inventions.entries[0]!, classification: "counterfactual", risk: "high",
    disclosure: "prominent", major_counterfactual: true, writer_decision_id: "DEC-001",
  };
  approved.decisions.decisions.push({
    id: "DEC-001", scope: "book-01", subject: "historical-invention:INV-001",
    choice: "accept:counterfactual:high:prominent", decidedAt: "2026-07-18",
    evidenceRefs: ["invention-ledger:INV-001"], replaces: null,
  });
  result = codes(approved);
  assert.equal(result.includes("major-counterfactual-prohibited"), false);
  assert.equal(result.includes("historical-invention-decision-required"), false);
});
