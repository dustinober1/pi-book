import type { ResolvedQualityConfig, QualityTierId } from "../domain/quality-profile.js";
import type { ChapterPacket, PlotGridState, RemarkabilityState } from "../domain/schemas.js";

export interface ChapterQualityRisk {
  score: number;
  level: "low" | "medium" | "high";
  keyScene: boolean;
  reasons: string[];
}

export type QualityCriticLane = "combined" | "continuity" | "voice" | "causality" | "research";

export interface QualityPassPlan {
  tier: QualityTierId;
  scenePlan: boolean;
  candidateCount: number;
  criticLanes: QualityCriticLane[];
  revisionPasses: number;
  finalReviewer: boolean;
  claimAudit: boolean;
}

interface HistoricalConstraintRisk {
  id: string;
  risk: "low" | "medium" | "high";
  research_ids: string[];
}

interface HistoricalContextRiskInput {
  constraints?: HistoricalConstraintRisk[];
}

interface InventionRiskEntry {
  id: string;
  risk: "low" | "medium" | "high";
  affected_chapters: number[];
}

interface InventionLedgerRiskInput {
  entries?: InventionRiskEntry[];
}

export interface AssessChapterQualityRiskInput {
  packet: ChapterPacket;
  plot: PlotGridState;
  remarkability: RemarkabilityState;
  historicalContext?: HistoricalContextRiskInput;
  inventionLedger?: InventionLedgerRiskInput;
  approvedLearningGuardrail?: boolean;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function locationMatchesChapter(location: string | null, chapter: number): boolean {
  if (!location) return false;
  const match = location.toLocaleLowerCase("en-US").match(/(?:chapter|ch)?[-_\s]*0*(\d+)/);
  return Number(match?.[1]) === chapter;
}

function revealIds(value: unknown, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => revealIds(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([childKey, childValue]) => revealIds(childValue, childKey));
  }
  if (typeof value !== "string") return [];
  if (/reveal/i.test(key) || /\breveal[:_-]/i.test(value)) return [value];
  return [];
}

function structuralPosition(packet: ChapterPacket, plot: PlotGridState): boolean {
  const chapterNumbers = plot.chapters.map((entry) => entry.chapter);
  const maximum = chapterNumbers.length ? Math.max(...chapterNumbers) : packet.chapter;
  const midpoint = Math.ceil(maximum / 2);
  const actExit = plot.acts.some((act) => act.end_chapter === packet.chapter);
  const plotEntry = plot.chapters.find((entry) => entry.chapter === packet.chapter);
  const climax = [packet.purpose, packet.scene_engine, ...(plotEntry?.profile_obligations ?? [])]
    .some((value) => /\bclimax|final confrontation|finale\b/i.test(value));
  return packet.chapter === 1 || packet.chapter === midpoint || packet.chapter === maximum || actExit || climax;
}

function historicalRisk(input: AssessChapterQualityRiskInput): "low" | "medium" | "high" | null {
  const refs = new Set(input.packet.continuity_refs);
  const research = new Set(input.packet.required_research);
  const risks: Array<"low" | "medium" | "high"> = [];
  for (const constraint of input.historicalContext?.constraints ?? []) {
    const relevant = refs.has(constraint.id) || constraint.research_ids.some((id) => research.has(id));
    if (relevant) risks.push(constraint.risk);
  }
  for (const entry of input.inventionLedger?.entries ?? []) {
    if (entry.affected_chapters.includes(input.packet.chapter)) risks.push(entry.risk);
  }
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  return risks.includes("low") ? "low" : null;
}

export function assessChapterQualityRisk(input: AssessChapterQualityRiskInput): ChapterQualityRisk {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(`${reason}:+${points}`);
  };

  const structural = structuralPosition(input.packet, input.plot);
  if (structural) add(3, "opening-or-structural-position");

  const signature = input.remarkability.signature_moments.some((moment) =>
    moment.status !== "cut" && locationMatchesChapter(moment.planned_location, input.packet.chapter));
  if (signature) add(3, "signature-moment");

  if (unique(input.packet.required_research).length >= 3) add(2, "research-density");

  const historical = historicalRisk(input);
  if (historical === "high") add(4, "historical-high-risk");
  else if (historical === "medium") add(2, "historical-medium-risk");

  const plotEntry = input.plot.chapters.find((entry) => entry.chapter === input.packet.chapter);
  const setupPayoffReveal = unique([
    ...(plotEntry?.setup_ids ?? []),
    ...(plotEntry?.payoff_ids ?? []),
    ...revealIds(plotEntry?.profile_obligations ?? []),
    ...revealIds(input.packet.profile_fields),
  ]);
  if (setupPayoffReveal.length >= 3) add(2, "setup-payoff-reveal-density");

  const stateRefs = unique([
    ...input.packet.continuity_refs,
    ...input.packet.character_refs,
    ...input.packet.story_thread_refs,
  ]);
  if (stateRefs.length >= 5) add(2, "canon-relationship-thread-density");

  if (input.approvedLearningGuardrail) add(1, "approved-learning-guardrail");

  const level = score >= 8 ? "high" : score >= 4 ? "medium" : "low";
  return {
    score,
    level,
    keyScene: structural || signature || level === "high",
    reasons,
  };
}

function revisionCount(config: ResolvedQualityConfig, risk: ChapterQualityRisk): number {
  if (config.maximumRevisionPasses < 1) return 0;
  if (config.adaptive && risk.level === "low") return 0;
  return Math.min(1, config.maximumRevisionPasses);
}

function researchCriticNeeded(config: ResolvedQualityConfig, risk: ChapterQualityRisk): boolean {
  if (config.factChecking === "off") return false;
  if (!config.adaptive || config.factChecking === "always") return true;
  return risk.reasons.some((reason) => reason.startsWith("research-density") || reason.startsWith("historical-"));
}

export function buildQualityPassPlan(config: ResolvedQualityConfig, risk: ChapterQualityRisk): QualityPassPlan {
  if (config.tier === "economy") {
    return {
      tier: "economy",
      scenePlan: false,
      candidateCount: 1,
      criticLanes: [],
      revisionPasses: 0,
      finalReviewer: false,
      claimAudit: false,
    };
  }

  if (config.tier === "balanced") {
    return {
      tier: "balanced",
      scenePlan: true,
      candidateCount: 1,
      criticLanes: ["combined"],
      revisionPasses: revisionCount(config, risk),
      finalReviewer: false,
      claimAudit: false,
    };
  }

  const criticLanes: QualityCriticLane[] = ["continuity", "voice", "causality"];
  if (researchCriticNeeded(config, risk) || config.tier === "editorial") criticLanes.push("research");
  return {
    tier: config.tier,
    scenePlan: true,
    candidateCount: risk.keyScene ? Math.max(1, Math.min(2, config.keySceneCandidates)) : 1,
    criticLanes,
    revisionPasses: revisionCount(config, risk),
    finalReviewer: config.tier === "editorial",
    claimAudit: config.tier === "editorial",
  };
}
