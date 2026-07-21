import test from "node:test";
import assert from "node:assert/strict";
import { defaultQualityProjectState, resolveQualityConfig } from "../src/domain/quality-profile.js";
import { assessChapterQualityRisk, buildQualityPassPlan } from "../src/application/quality-risk.js";

const packet = {
  chapter: 1,
  title: "The Lying Door",
  status: "ready" as const,
  pov: "Mara",
  purpose: "Enter the archive under false authority.",
  scene_engine: "credential versus physical evidence",
  pressure_movement: "access narrows",
  character_movement: "Mara chooses proof over safety",
  relationship_movement: "trust fractures",
  story_thread_refs: ["ST-001", "ST-002"],
  continuity_refs: ["CAN-001", "HC-001"],
  character_refs: ["CHAR-001", "CHAR-002"],
  required_research: ["RES-001", "RES-002", "RES-003"],
  profile_fields: { reveal_ids: ["REV-001"] },
  ending_hook: "The archive edits its own evacuation record.",
  milestone_gate: null,
  target_words: 3_000,
};

const plot = {
  schema_version: "1.0.0" as const,
  acts: [
    { id: "ACT-1", purpose: "setup", start_chapter: 1, end_chapter: 2, gate: "act-1-review" },
    { id: "ACT-2", purpose: "confrontation", start_chapter: 3, end_chapter: 4, gate: null },
  ],
  chapters: [
    { chapter: 1, act: "ACT-1", causality: "entry triggers pursuit", state_change: "access becomes evidence", setup_ids: ["SET-001", "SET-002"], payoff_ids: ["PAY-001"], profile_obligations: ["reveal:REV-002"] },
    { chapter: 2, act: "ACT-1", causality: "", state_change: "", setup_ids: [], payoff_ids: [], profile_obligations: [] },
    { chapter: 3, act: "ACT-2", causality: "", state_change: "", setup_ids: [], payoff_ids: [], profile_obligations: [] },
    { chapter: 4, act: "ACT-2", causality: "", state_change: "", setup_ids: [], payoff_ids: [], profile_obligations: [] },
  ],
};

const remarkability = {
  schema_version: "1.0.0" as const,
  safe_obvious_version: "",
  author_only_advantage: "",
  productive_discomfort: "",
  retellable_hook: "",
  signature_moments: [{ id: "RM-001", description: "The exit sign changes its testimony.", intended_reader_memory: "The building lies.", planned_location: "chapter-01", status: "planned" as const }],
  productive_disagreements: [],
  recurring_motifs: [],
  lingering_question: "",
  hand_sell_reason: "",
  accepted_reader_costs: [],
};

const historicalContext = {
  constraints: [{ id: "HC-001", risk: "high" as const, research_ids: ["RES-001"] }],
};

const inventionLedger = {
  entries: [{ id: "INV-001", risk: "medium" as const, affected_chapters: [1] }],
};

test("risk scoring is deterministic, additive, and explainable", () => {
  const risk = assessChapterQualityRisk({
    packet,
    plot,
    remarkability,
    historicalContext,
    inventionLedger,
    approvedLearningGuardrail: true,
  });
  assert.deepEqual(risk, {
    score: 17,
    level: "high",
    keyScene: true,
    reasons: [
      "opening-or-structural-position:+3",
      "signature-moment:+3",
      "research-density:+2",
      "historical-high-risk:+4",
      "setup-payoff-reveal-density:+2",
      "canon-relationship-thread-density:+2",
      "approved-learning-guardrail:+1",
    ],
  });

  const routine = assessChapterQualityRisk({
    packet: { ...packet, chapter: 3, story_thread_refs: [], continuity_refs: [], character_refs: [], required_research: [], profile_fields: {} },
    plot,
    remarkability: { ...remarkability, signature_moments: [] },
  });
  assert.deepEqual(routine, { score: 0, level: "low", keyScene: false, reasons: [] });
});

test("quality tier plans spend only where the tier and risk justify it", () => {
  const high = assessChapterQualityRisk({ packet, plot, remarkability, historicalContext, inventionLedger });
  const low = { score: 0, level: "low" as const, keyScene: false, reasons: [] as string[] };

  const economy = buildQualityPassPlan(resolveQualityConfig(defaultQualityProjectState()), high);
  assert.deepEqual(economy, {
    tier: "economy",
    scenePlan: false,
    candidateCount: 1,
    criticLanes: [],
    revisionPasses: 0,
    finalReviewer: false,
    claimAudit: false,
  });

  const balancedState = defaultQualityProjectState();
  balancedState.tier = "balanced";
  assert.deepEqual(buildQualityPassPlan(resolveQualityConfig(balancedState), low), {
    tier: "balanced",
    scenePlan: true,
    candidateCount: 1,
    criticLanes: ["combined"],
    revisionPasses: 0,
    finalReviewer: false,
    claimAudit: false,
  });

  const premiumState = defaultQualityProjectState();
  premiumState.tier = "premium";
  assert.deepEqual(buildQualityPassPlan(resolveQualityConfig(premiumState), high), {
    tier: "premium",
    scenePlan: true,
    candidateCount: 2,
    criticLanes: ["continuity", "voice", "causality", "research"],
    revisionPasses: 1,
    finalReviewer: false,
    claimAudit: false,
  });
  assert.deepEqual(buildQualityPassPlan(resolveQualityConfig(premiumState), low).criticLanes, ["continuity", "voice", "causality"]);

  const editorialState = defaultQualityProjectState();
  editorialState.tier = "editorial";
  const editorial = buildQualityPassPlan(resolveQualityConfig(editorialState), high);
  assert.equal(editorial.finalReviewer, true);
  assert.equal(editorial.claimAudit, true);
});
