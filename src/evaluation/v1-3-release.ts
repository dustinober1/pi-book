import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import type { ChapterQueueState } from "../domain/schemas.js";
import { defaultBookStrategy, defaultTasteProfile, defaultVoiceGuardrails } from "../domain/v1-3-schemas.js";
import { defaultPhase4StressTest, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import type { BookStrategyPhase5, RevisionTicketsPhase5 } from "../domain/v1-3-audit-schemas.js";
import type { BookStrategyPhase3 } from "../domain/v1-3-research-schemas.js";
import { bookPlanFindings } from "../application/book-strategy.js";
import { compileVoiceGuardrails, voiceSafetyFindings, type VoiceRuleSet } from "../application/influence-palette.js";
import { buildReviewCluster, maximumClusterConfidence, readerFrictionFindings, type FrictionObservation } from "../application/review-observations.js";
import { revisionLearningCandidates } from "../application/revision-learning.js";
import { sceneAuditFindings } from "../application/scene-audit.js";
import { compareVoiceMetrics, extractVoiceMetrics } from "../application/voice-audit.js";

export type ReleaseEvaluationKind =
  | "influence-translation"
  | "writer-sample-precedence"
  | "one-star-noise"
  | "praise-complaint-pairing"
  | "intentional-tradeoff"
  | "voice-drift"
  | "scene-diversity"
  | "agency-tracking"
  | "guardrail-promotion";

export interface ReleaseEvaluationFixture {
  schema_version: "1.0.0";
  id: string;
  kind: ReleaseEvaluationKind;
  input: unknown;
  expected: unknown;
}

export interface ReleaseEvaluationResult {
  id: string;
  kind: ReleaseEvaluationKind;
  passed: boolean;
  evidence: string[];
  failures: string[];
}

type AnyRecord = Record<string, unknown>;
const EMPTY_RULES: VoiceRuleSet = { must: [], prefer: [], avoid: [], monitor: [] };

function object(value: unknown, label: string): AnyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as AnyRecord;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label} must be a string list.`);
  return value.map((item) => item.trim());
}
function numbers(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item))) throw new Error(`${label} must be an integer list.`);
  return value as number[];
}
function equality(label: string, actual: unknown, expected: unknown, evidence: string[], failures: string[]): void {
  evidence.push(`${label}: ${JSON.stringify(actual)}`);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label} expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}.`);
}
function observation(id: string, title: string, rating: number, sentiment: "negative" | "mixed" | "positive", category = "pacing-problem"): FrictionObservation {
  return {
    id, title, source_location: "release fixture", observed_on: "2026-07-16", rating,
    paraphrase: `${sentiment} ${category} observation`, short_excerpt: "",
    genre_relevance: "high", execution_relevance: "high",
    category: category as FrictionObservation["category"], sentiment,
  };
}
function packet(chapter: number, sceneEngine: string) {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready" as const, pov: "Mara",
    purpose: `advance ${chapter}`, scene_engine: sceneEngine, pressure_movement: "pressure rises",
    character_movement: "Mara chooses", relationship_movement: "trust changes",
    story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"], required_research: [],
    profile_fields: {}, ending_hook: "new pressure", milestone_gate: null, target_words: 1800,
  };
}
function releaseQueue(engines: string[]): ChapterQueueState {
  return { schema_version: "1.0.0", active_window: "release-eval", packets: engines.map((engine, index) => packet(index + 1, engine)) };
}
function releasePlot(chapterCount = 4): PlotGridPhase4 {
  return {
    schema_version: "1.0.0",
    acts: [{ id: "I", purpose: "release evaluation", start_chapter: 1, end_chapter: chapterCount, gate: null }],
    chapters: Array.from({ length: chapterCount }, (_, index) => ({
      chapter: index + 1, act: "I", causality: `because step ${index + 1}`, state_change: `state ${index + 1}`,
      setup_ids: index === 0 ? ["SET-001"] : [], payoff_ids: index === chapterCount - 1 ? ["SET-001"] : [], profile_obligations: [],
    })),
    decisions: [],
  };
}
function completeStrategy(): BookStrategyPhase5 {
  const strategy = defaultBookStrategy() as BookStrategyPhase5;
  strategy.reader_promise = { statement: "A procedural mystery with costly choices.", required_experiences: ["fair clues"] };
  strategy.expectation_map = [{ id: "EXP-001", expectation: "The mystery begins early.", decision: "satisfy", rationale: "Open with evidence.", status: "approved" }];
  strategy.plan_stress_test = defaultPhase4StressTest().map((check) => ({ ...check, status: "pass", rationale: `Checked ${check.id}.`, evidence_refs: ["release fixture"], tradeoff_id: null }));
  strategy.revision_learning_guardrails = [];
  return strategy;
}
function tickets(patternId: string, chapters: number[], reviews: string[]): RevisionTicketsPhase5 {
  const entries: RevisionTicketsPhase5["tickets"] = [];
  let index = 1;
  for (const chapter of chapters) entries.push({
    id: `B01-T${String(index++).padStart(3, "0")}`, severity: "medium", category: "release-eval", chapter,
    evidence: "recurring pattern", problem: "recurring pattern", required_change: "prevent recurrence",
    protected_constraints: [], acceptance_tests: ["pattern absent"], status: "open",
    recurrence: { pattern_id: patternId, milestone_review: null },
  });
  for (const review of reviews) entries.push({
    id: `B01-T${String(index++).padStart(3, "0")}`, severity: "medium", category: "release-eval", chapter: null,
    evidence: "recurring milestone pattern", problem: "recurring pattern", required_change: "prevent recurrence",
    protected_constraints: [], acceptance_tests: ["pattern absent"], status: "open",
    recurrence: { pattern_id: patternId, milestone_review: review },
  });
  return { schema_version: "1.0.0", tickets: entries };
}

function evaluateInfluence(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const taste = defaultTasteProfile();
  taste.influences.push({
    id: "INF-001", reference: text(input.reference, "reference"), influence_type: "voice",
    admired_for: ["high-level craft"], not_for: ["signature phrasing"],
    derived_traits: strings(input.derived_traits, "derived_traits"), status: "approved",
  });
  const safe = voiceSafetyFindings({ taste, voiceProfile: text(input.safe_profile, "safe_profile"), guardrails: defaultVoiceGuardrails() }).map((item) => item.code).sort();
  const unsafe = voiceSafetyFindings({ taste, voiceProfile: text(input.unsafe_profile, "unsafe_profile"), guardrails: defaultVoiceGuardrails() }).map((item) => item.code).sort();
  equality("safe_codes", safe, strings(expected.safe_codes, "expected.safe_codes").sort(), evidence, failures);
  equality("unsafe_codes", unsafe, strings(expected.unsafe_codes, "expected.unsafe_codes").sort(), evidence, failures);
}
function evaluatePrecedence(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const shared = text(input.shared_rule, "shared_rule");
  const influenceOnly = text(input.influence_only, "influence_only");
  const result = compileVoiceGuardrails({
    explicitWriterDecisions: EMPTY_RULES,
    writerSamples: { must: [shared], prefer: [], avoid: [], monitor: [] },
    acceptedBaseline: EMPTY_RULES, approvedVoiceProfile: EMPTY_RULES,
    influenceReferences: { must: [], prefer: [influenceOnly], avoid: [shared], monitor: [] },
    genreDefaults: { must: [], prefer: [shared], avoid: [], monitor: [] },
  });
  const suppressed = result.suppressed.find((item) => item.rule === shared && item.layer === "influence-references");
  equality("winning_layer", suppressed?.winnerLayer ?? null, expected.winning_layer, evidence, failures);
  equality("must_include", result.guardrails.must, strings(expected.must_include, "expected.must_include"), evidence, failures);
  equality("prefer_include", result.guardrails.prefer, strings(expected.prefer_include, "expected.prefer_include"), evidence, failures);
}
function evaluateOneStar(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  if (!Array.isArray(input.observations)) throw new Error("observations must be a list.");
  const observations = input.observations.map((row, index) => {
    const item = object(row, `observation ${index + 1}`);
    return observation(`OBS-${String(index + 1).padStart(3, "0")}`, text(item.title, "title"), Number(item.rating), "negative", "execution-problem");
  });
  equality("maximum_confidence", maximumClusterConfidence(observations, []), expected.maximum_confidence, evidence, failures);
}
function evaluatePairing(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const title = text(input.title, "title");
  const category = text(input.category, "category");
  const observations = [observation("OBS-001", title, 2, "negative", category), observation("OBS-002", title, 5, "positive", category)];
  const cluster = buildReviewCluster({ id: "CLU-001", label: "paired evidence", observationIds: ["OBS-001"] }, observations);
  equality("negative_ids", cluster.observation_ids, strings(expected.negative_ids, "expected.negative_ids"), evidence, failures);
  equality("positive_counterweights", cluster.positive_counterweights, strings(expected.positive_counterweights, "expected.positive_counterweights"), evidence, failures);
}
function evaluateTradeoff(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const clusterId = text(input.cluster_id, "cluster_id");
  const tradeoffId = text(input.tradeoff_id, "tradeoff_id");
  const strategy = defaultBookStrategy() as BookStrategyPhase3;
  strategy.reader_friction.observations.push(observation("OBS-001", "Comparable", 2, "negative"));
  strategy.reader_friction.clusters.push({ id: clusterId, label: "intentional friction", observation_ids: ["OBS-001"], titles_affected: ["Comparable"], confidence: "weak", positive_counterweights: [], decision: "accept-as-tradeoff", guardrail: null });
  strategy.reader_friction.accepted_tradeoffs.push({ id: tradeoffId, statement: "Preserve deliberate ambiguity.", source_cluster_ids: [clusterId], mitigation: `Clarify stakes elsewhere while preserving the intentional friction from ${clusterId}.` });
  const findings = readerFrictionFindings(strategy);
  equality("visible_tradeoff", strategy.reader_friction.accepted_tradeoffs.some((item) => item.id === tradeoffId) && !findings.some((item) => item.severity === "blocker"), expected.visible_tradeoff, evidence, failures);
  equality("approved_guardrail", strategy.review_derived_guardrails.some((item) => item.status === "approved" && item.source_cluster_ids.includes(clusterId)), expected.approved_guardrail, evidence, failures);
}
function evaluateVoiceDrift(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const baseline = extractVoiceMetrics(text(input.baseline_text, "baseline_text"));
  const current = extractVoiceMetrics(text(input.current_text, "current_text"));
  const deltas = compareVoiceMetrics(current, baseline as unknown as Record<string, number>);
  for (const metric of strings(expected.changed_metrics, "expected.changed_metrics")) {
    const value = deltas[metric];
    evidence.push(`${metric}: ${value}`);
    if (value === undefined || value === 0) failures.push(`${metric} did not change.`);
  }
  equality("interpretation", "evidence-only", expected.interpretation, evidence, failures);
}
function evaluateScene(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const engines = strings(input.engines, "engines");
  const finding = sceneAuditFindings(releaseQueue(engines), releasePlot(engines.length)).find((item) => item.code === expected.finding_code);
  equality("finding_code", finding?.code ?? null, expected.finding_code, evidence, failures);
  equality("chapters", finding?.chapters ?? [], numbers(expected.chapters, "expected.chapters"), evidence, failures);
}
function evaluateAgency(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  const decision = object(input.decision, "decision");
  const strategy = completeStrategy();
  const plot = releasePlot(4);
  plot.decisions = [{
    id: "DEC-001", chapter: Number(decision.chapter), choice: text(decision.choice, "choice"),
    immediate_gain: text(decision.immediate_gain, "immediate_gain"), deferred_cost: text(decision.deferred_cost, "deferred_cost"),
    irreversible_effect: text(decision.irreversible_effect, "irreversible_effect"),
    payoff_window: object(decision.payoff_window, "payoff_window") as { start_chapter: number; end_chapter: number }, status: "planned",
  }];
  const queue = releaseQueue(["search", "pursuit", "confrontation", "escape"]);
  const validCodes = bookPlanFindings({ strategy, plot, queue }).filter((item) => item.severity === "blocker").map((item) => item.code).sort();
  equality("valid_codes", validCodes, strings(expected.valid_codes, "expected.valid_codes").sort(), evidence, failures);
  plot.decisions = [{ ...plot.decisions[0]!, immediate_gain: "", payoff_window: { start_chapter: 2, end_chapter: 1 } }];
  const invalidCodes = [...new Set(bookPlanFindings({ strategy, plot, queue }).filter((item) => item.severity === "blocker").map((item) => item.code))].sort();
  equality("invalid_codes", invalidCodes, strings(expected.invalid_codes, "expected.invalid_codes").sort(), evidence, failures);
}
function eligibility(value: unknown): boolean {
  const input = object(value, "promotion input");
  return revisionLearningCandidates(tickets("PAT-release", numbers(input.chapters, "chapters"), strings(input.milestone_reviews, "milestone_reviews")))[0]?.eligible ?? false;
}
function evaluatePromotion(input: AnyRecord, expected: AnyRecord, evidence: string[], failures: string[]): void {
  if ("chapters" in input && "milestone_reviews" in input) {
    equality("eligible", eligibility(input), expected.eligible, evidence, failures);
    return;
  }
  equality("below_eligible", eligibility(input.below_threshold), expected.below_eligible, evidence, failures);
  equality("chapter_eligible", eligibility(input.chapter_threshold), expected.chapter_eligible, evidence, failures);
  equality("review_eligible", eligibility(input.review_threshold), expected.review_eligible, evidence, failures);
}

export function evaluateV13ReleaseFixture(fixture: ReleaseEvaluationFixture): ReleaseEvaluationResult {
  const cloned = structuredClone(fixture);
  const evidence: string[] = [];
  const failures: string[] = [];
  try {
    if (fixture.schema_version !== "1.0.0") throw new Error(`${fixture.id} requires schema_version 1.0.0.`);
    if (!fixture.id.trim()) throw new Error("Release fixture requires an id.");
    const input = object(fixture.input, `${fixture.id}.input`);
    const expected = object(fixture.expected, `${fixture.id}.expected`);
    if (fixture.kind === "influence-translation") evaluateInfluence(input, expected, evidence, failures);
    else if (fixture.kind === "writer-sample-precedence") evaluatePrecedence(input, expected, evidence, failures);
    else if (fixture.kind === "one-star-noise") evaluateOneStar(input, expected, evidence, failures);
    else if (fixture.kind === "praise-complaint-pairing") evaluatePairing(input, expected, evidence, failures);
    else if (fixture.kind === "intentional-tradeoff") evaluateTradeoff(input, expected, evidence, failures);
    else if (fixture.kind === "voice-drift") evaluateVoiceDrift(input, expected, evidence, failures);
    else if (fixture.kind === "scene-diversity") evaluateScene(input, expected, evidence, failures);
    else if (fixture.kind === "agency-tracking") evaluateAgency(input, expected, evidence, failures);
    else if (fixture.kind === "guardrail-promotion") evaluatePromotion(input, expected, evidence, failures);
    else failures.push(`Unsupported release evaluation kind: ${String(fixture.kind)}.`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  if (JSON.stringify(fixture) !== JSON.stringify(cloned)) failures.push("Evaluation mutated its fixture input.");
  return { id: fixture.id, kind: fixture.kind, passed: failures.length === 0, evidence, failures };
}

export function loadV13ReleaseFixtures(root: string): ReleaseEvaluationFixture[] {
  return readdirSync(root)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => YAML.parse(readFileSync(join(root, name), "utf8")) as ReleaseEvaluationFixture);
}
