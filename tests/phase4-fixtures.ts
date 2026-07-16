import { defaultBookStrategy, defaultResearchLedger, type ResearchLedger } from "../src/domain/v1-3-schemas.js";
import { defaultPhase4StressTest, type BookStrategyPhase4, type PlotGridPhase4 } from "../src/domain/v1-3-architecture-schemas.js";
import type { ChapterQueueState } from "../src/domain/schemas.js";
import type { SourceRegisterV13 } from "../src/domain/v1-3-research-schemas.js";

export function packet(chapter: number, sceneEngine = `engine-${chapter}`) {
  return {
    chapter,
    title: `Chapter ${chapter}`,
    status: "ready" as const,
    pov: "Mara",
    purpose: `advance ${chapter}`,
    scene_engine: sceneEngine,
    pressure_movement: "pressure rises",
    character_movement: "Mara chooses",
    relationship_movement: "trust changes",
    story_thread_refs: ["ST-001"],
    continuity_refs: ["CAN-001"],
    character_refs: ["Mara"],
    required_research: chapter === 2 ? ["RES-001"] : [],
    profile_fields: {
      threat_delta: "+1",
      evidence_delta: `EV-${chapter}`,
      reader_forecast_change: "new possibility",
      protagonist_choice: "continues",
    },
    ending_hook: "new pressure",
    milestone_gate: null,
    target_words: 1800,
  };
}

export function queueFixture(): ChapterQueueState {
  return {
    schema_version: "1.0.0",
    active_window: "act-1",
    packets: [packet(1), packet(2), packet(3), packet(4)],
  };
}

export function completePlot(): PlotGridPhase4 {
  return {
    schema_version: "1.0.0",
    acts: [{ id: "I", purpose: "entry", start_chapter: 1, end_chapter: 4, gate: null }],
    chapters: [
      { chapter: 1, act: "I", causality: "because the threat appears", state_change: "Mara commits", setup_ids: ["ST-001"], payoff_ids: [], profile_obligations: ["genre promise"] },
      { chapter: 2, act: "I", causality: "therefore she investigates", state_change: "evidence changes", setup_ids: [], payoff_ids: [], profile_obligations: ["pressure"] },
      { chapter: 3, act: "I", causality: "because the evidence fails", state_change: "trust breaks", setup_ids: [], payoff_ids: [], profile_obligations: ["reversal"] },
      { chapter: 4, act: "I", causality: "therefore she acts", state_change: "thread advances", setup_ids: [], payoff_ids: ["ST-001"], profile_obligations: ["payoff"] },
    ],
    decisions: [{
      id: "DEC-001",
      chapter: 2,
      choice: "Mara enters the restricted archive.",
      immediate_gain: "She obtains the missing log.",
      deferred_cost: "Security now tracks her.",
      irreversible_effect: "Her official access is revoked.",
      payoff_window: { start_chapter: 3, end_chapter: 4 },
      status: "planned",
    }],
  };
}

export function completeStrategy(): BookStrategyPhase4 {
  const base = defaultBookStrategy() as BookStrategyPhase4;
  base.reader_promise = { statement: "A procedural mystery with costly choices.", required_experiences: ["fair clues", "escalating institutional pressure"] };
  base.expectation_map = [{ id: "EXP-001", expectation: "The central mystery begins early.", decision: "satisfy", rationale: "Open with the breach.", status: "approved" }];
  base.review_derived_guardrails = [{ id: "GR-001", rule: "preserve costly choices", source_cluster_ids: [], status: "approved" }];
  base.plan_stress_test = defaultPhase4StressTest().map((check) => ({ ...check, status: "pass", rationale: `Checked ${check.id}.`, evidence_refs: ["books/book-01/plot-grid.yaml"], tradeoff_id: null }));
  return base;
}

export function researchFixture(status: "ready" | "researching" = "ready"): ResearchLedger {
  const ledger = defaultResearchLedger();
  if (status === "ready") {
    ledger.items.push({
      id: "RES-001",
      lane: "story-world",
      claim: "Restricted archives use a two-person release procedure.",
      source_ids: ["SRC-001"],
      confidence: "high",
      verified_on: "2026-07-15",
      fictionalization: { status: "simplified", reason: "Compress jurisdictional detail." },
      knowledge_scope: { known_by: ["Mara"], incorrectly_believed_by: [], unknown_to: ["Jonah"] },
      risk: ["procedure varies"],
      dramatic_uses: ["procedural-constraint"],
      story_use: { chapters: [2], decision_affected: "Mara must recruit a second operator." },
      notes: "",
      status: "ready",
    });
  } else {
    ledger.items.push({
      id: "RES-001",
      lane: "story-world",
      claim: "Restricted archives may use a two-person release procedure.",
      source_ids: [],
      confidence: "low",
      verified_on: null,
      fictionalization: { status: "unchanged", reason: "" },
      knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
      risk: [],
      dramatic_uses: [],
      story_use: { chapters: [2], decision_affected: "" },
      notes: "",
      status: "researching",
    });
  }
  ledger.items.push({
    id: "RES-002",
    lane: "human-authenticity",
    claim: "UNREQUIRED CLAIM MARKER",
    source_ids: ["SRC-001"],
    confidence: "medium",
    verified_on: "2026-07-15",
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    risk: [],
    dramatic_uses: ["credibility-detail"],
    story_use: { chapters: [4], decision_affected: "Later scene texture." },
    notes: "",
    status: "ready",
  });
  return ledger;
}

export function sourcesFixture(): SourceRegisterV13 {
  return {
    schema_version: "1.0.0",
    sources: [{
      id: "SRC-001",
      type: "primary-document",
      title: "Archive Operations Manual",
      location: "research/archive-manual.md",
      verified_on: "2026-07-15",
      supports: [],
      notes: "",
      reliability: "primary",
      observed_on: "2026-07-15",
      supports_research_ids: ["RES-001", "RES-002"],
    }],
  };
}
