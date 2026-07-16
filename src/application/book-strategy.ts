import type { ChapterQueueState } from "../domain/schemas.js";
import {
  PLAN_STRESS_CHECK_IDS,
  type PlotGridPhase4,
} from "../domain/v1-3-architecture-schemas.js";
import type { BookStrategyPhase5 } from "../domain/v1-3-audit-schemas.js";
import { renderApprovedLearningGuardrails } from "./revision-learning.js";
import { readerFrictionFindings } from "./review-observations.js";

export interface BookPlanFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

function blank(value: string): boolean {
  return !value.trim();
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    else seen.add(value);
  }
  return [...repeated].sort();
}

function consequenceFindings(plot: PlotGridPhase4): BookPlanFinding[] {
  const findings: BookPlanFinding[] = [];
  const decisions = plot.decisions ?? [];
  const plannedChapters = new Set(plot.chapters.map((item) => item.chapter));
  if (!decisions.length) findings.push({ severity: "blocker", code: "missing-decision-ledger", message: "Plot grid requires at least one decision-and-consequence entry." });
  for (const id of duplicates(decisions.map((item) => item.id))) findings.push({ severity: "blocker", code: "duplicate-decision-id", message: `Duplicate decision id: ${id}.` });
  for (const decision of decisions) {
    if (!plannedChapters.has(decision.chapter)) findings.push({ severity: "blocker", code: "invalid-decision-chapter", message: `${decision.id} references unplanned Chapter ${decision.chapter}.` });
    if ([decision.choice, decision.immediate_gain, decision.deferred_cost, decision.irreversible_effect].some(blank)) findings.push({ severity: "blocker", code: "incomplete-decision-consequence", message: `${decision.id} requires choice, immediate gain, deferred cost, and irreversible effect.` });
    const window = decision.payoff_window;
    if (window.start_chapter <= decision.chapter || window.end_chapter < window.start_chapter || !plannedChapters.has(window.start_chapter) || !plannedChapters.has(window.end_chapter)) {
      findings.push({ severity: "blocker", code: "invalid-payoff-window", message: `${decision.id} requires a forward payoff window inside planned chapters.` });
    }
  }
  const earliestSetup = new Map<string, number>();
  for (const chapter of [...plot.chapters].sort((a, b) => a.chapter - b.chapter)) {
    for (const id of chapter.setup_ids) {
      const current = earliestSetup.get(id);
      if (current === undefined || chapter.chapter < current) earliestSetup.set(id, chapter.chapter);
    }
    for (const id of chapter.payoff_ids) {
      const setupChapter = earliestSetup.get(id);
      if (setupChapter === undefined || setupChapter >= chapter.chapter) findings.push({ severity: "blocker", code: "payoff-before-setup", message: `Chapter ${chapter.chapter} pays off ${id} without an earlier setup.` });
    }
  }
  return findings;
}

function sceneRepetitionFindings(queue: ChapterQueueState): BookPlanFinding[] {
  const packets = [...queue.packets].sort((a, b) => a.chapter - b.chapter);
  for (let index = 0; index <= packets.length - 3; index += 1) {
    const window = packets.slice(index, index + 3);
    const engines = window.map((item) => item.scene_engine.trim().toLocaleLowerCase("en-US"));
    if (engines[0] && engines.every((item) => item === engines[0])) return [{ severity: "blocker", code: "middle-scene-repetition", message: `Chapters ${window.map((item) => item.chapter).join(", ")} repeat the same scene engine: ${window[0]!.scene_engine}.` }];
  }
  return [];
}

export function bookPlanFindings(input: { strategy: BookStrategyPhase5; plot: PlotGridPhase4; queue: ChapterQueueState }): BookPlanFinding[] {
  const { strategy, plot, queue } = input;
  const findings: BookPlanFinding[] = [];
  if (blank(strategy.reader_promise.statement) || strategy.reader_promise.required_experiences.every(blank)) findings.push({ severity: "blocker", code: "missing-reader-promise", message: "Book strategy requires a specific reader promise and at least one required experience." });
  if (!strategy.expectation_map.length) findings.push({ severity: "blocker", code: "missing-expectation-map", message: "Book strategy requires at least one expectation decision." });
  for (const expectation of strategy.expectation_map) if (expectation.status !== "approved") findings.push({ severity: "blocker", code: "unapproved-expectation", message: `${expectation.id} must be approved before book-plan approval.` });
  for (const cluster of strategy.reader_friction.clusters) if ((cluster.confidence === "moderate" || cluster.confidence === "strong") && cluster.decision === null) findings.push({ severity: "blocker", code: "missing-friction-decision", message: `${cluster.id} requires an explicit writer decision.` });

  const stress = strategy.plan_stress_test ?? [];
  for (const id of duplicates(stress.map((item) => item.id))) findings.push({ severity: "blocker", code: "duplicate-stress-check", message: `Duplicate plan stress check: ${id}.` });
  const stressById = new Map(stress.map((item) => [item.id, item]));
  const tradeoffIds = new Set(strategy.reader_friction.accepted_tradeoffs.map((item) => item.id));
  for (const id of PLAN_STRESS_CHECK_IDS) {
    const check = stressById.get(id);
    if (!check) { findings.push({ severity: "blocker", code: "missing-stress-check", message: `Plan stress test is missing ${id}.` }); continue; }
    if (check.status === "pending" || check.status === "blocked") findings.push({ severity: "blocker", code: "unresolved-stress-check", message: `${id} remains ${check.status}.` });
    if ((check.status === "pass" || check.status === "accepted-tradeoff") && (blank(check.rationale) || !check.evidence_refs.length)) findings.push({ severity: "blocker", code: "stress-check-missing-evidence", message: `${id} requires rationale and evidence references.` });
    if (check.status === "accepted-tradeoff" && (!check.tradeoff_id || !tradeoffIds.has(check.tradeoff_id))) findings.push({ severity: "blocker", code: "missing-stress-tradeoff", message: `${id} accepts a tradeoff without a matching accepted-tradeoff record.` });
    if (check.status !== "accepted-tradeoff" && check.tradeoff_id !== null) findings.push({ severity: "warning", code: "unused-stress-tradeoff", message: `${id} records tradeoff ${check.tradeoff_id} without accepted-tradeoff status.` });
  }
  findings.push(...consequenceFindings(plot), ...sceneRepetitionFindings(queue), ...readerFrictionFindings(strategy));
  return findings;
}

export function renderApprovedBookGuardrails(strategy: BookStrategyPhase5): string {
  const rules = [
    ...strategy.review_derived_guardrails.filter((item) => item.status === "approved" && !blank(item.rule)).map((item) => item.rule.trim()),
    ...renderApprovedLearningGuardrails(strategy).split("\n").map((line) => line.replace(/^\-\s*/, "").trim()).filter(Boolean),
  ];
  return [...new Set(rules)].map((rule) => `BOOK GUARDRAIL: ${rule}`).join("\n");
}
