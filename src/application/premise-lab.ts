import type { DecisionLedger, V14Finding } from "../domain/v1-4-schemas.js";
import type { PremiseLab, PremiseVariant } from "../domain/v1-4-premise-schemas.js";
import { decisionLedgerFindings } from "../domain/v1-4-schemas.js";

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function duplicate<T>(values: T[]): boolean {
  return new Set(values).size !== values.length;
}

function activeDecision(ledger: DecisionLedger, decisionId: string) {
  const replaced = new Set(ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  return ledger.decisions.find((item) => item.id === decisionId && !replaced.has(item.id));
}

export function premiseLabFindings(lab: PremiseLab, ledger?: DecisionLedger | null): V14Finding[] {
  const findings: V14Finding[] = [];
  if (lab.variants.length === 0) {
    if (lab.selected_variant_id !== null || lab.selection_decision_id !== null) findings.push({ severity: "blocker", code: "partial-premise-selection", message: "An empty premise lab cannot contain a selection." });
    return findings;
  }
  if (lab.variants.length < 3 || lab.variants.length > 5) findings.push({ severity: "blocker", code: "premise-variant-count", message: "A populated premise lab requires three to five variants." });
  if (!lab.raw_idea.trim()) findings.push({ severity: "blocker", code: "missing-raw-idea", message: "A populated premise lab requires the writer's raw idea." });
  if (!lab.seed_elements.length || lab.seed_elements.some((item) => !item.trim())) findings.push({ severity: "blocker", code: "missing-seed-elements", message: "A populated premise lab requires seed elements." });

  const ids = lab.variants.map((item) => item.id);
  if (duplicate(ids)) findings.push({ severity: "blocker", code: "duplicate-premise-id", message: "Premise variant IDs must be unique." });
  const orders = lab.variants.map((item) => item.order);
  if (duplicate(orders) || [...orders].sort((a, b) => a - b).some((value, index) => value !== index + 1)) findings.push({ severity: "blocker", code: "premise-order", message: "Premise variant order must be unique and contiguous from one." });
  const engines = lab.variants.map((item) => normalize(item.story_engine));
  if (engines.some((item) => !item) || duplicate(engines)) findings.push({ severity: "blocker", code: "duplicate-story-engine", message: "Each premise variant requires a unique normalized story engine." });
  const baselines = lab.variants.filter((item) => item.is_raw_idea_baseline);
  if (baselines.length !== 1 || baselines[0]?.order !== 1) findings.push({ severity: "blocker", code: "raw-idea-baseline", message: "Exactly one raw-idea baseline is required and it must be order one." });

  const requiredSeeds = lab.seed_elements.map(normalize);
  for (const variant of lab.variants) {
    const preserved = variant.preserved_seed_elements.map(normalize);
    if (requiredSeeds.some((seed) => !preserved.includes(seed))) findings.push({ severity: "blocker", code: "missing-seed-element", message: `${variant.id} does not preserve every declared seed element.` });
    const required: Array<keyof PremiseVariant> = ["title", "premise", "story_engine", "central_final_page_question", "immediate_gain", "deferred_cost", "irreversible_effect", "differentiation", "series_potential"];
    if (required.some((key) => typeof variant[key] !== "string" || !(variant[key] as string).trim())) findings.push({ severity: "blocker", code: "incomplete-premise-variant", message: `${variant.id} is missing required structural evidence.` });
  }

  const paired = (lab.selected_variant_id === null) === (lab.selection_decision_id === null);
  if (!paired) findings.push({ severity: "blocker", code: "partial-premise-selection", message: "Premise selection fields must both be null or both be set." });
  if (lab.selected_variant_id && !lab.variants.some((item) => item.id === lab.selected_variant_id)) findings.push({ severity: "blocker", code: "unknown-selected-premise", message: `Selected premise ${lab.selected_variant_id} does not exist.` });
  if (lab.selected_variant_id && lab.selection_decision_id) {
    if (!ledger) findings.push({ severity: "blocker", code: "unauthorized-premise-selection", message: "Premise selection requires a decision ledger." });
    else {
      findings.push(...decisionLedgerFindings(ledger));
      const decision = activeDecision(ledger, lab.selection_decision_id);
      if (!decision || decision.scope !== lab.book_id || decision.subject !== "premise-selection" || decision.choice !== lab.selected_variant_id || decision.choice === "rejected") {
        findings.push({ severity: "blocker", code: "unauthorized-premise-selection", message: "Premise selection must match one active writer decision for this book and variant." });
      }
    }
  }
  return findings;
}

export function selectPremise(lab: PremiseLab, ledger: DecisionLedger, variantId: string, decisionId: string): PremiseLab {
  const unselected = structuredClone(lab);
  unselected.selected_variant_id = null;
  unselected.selection_decision_id = null;
  const inputBlockers = premiseLabFindings(unselected).filter((item) => item.severity === "blocker");
  if (inputBlockers.length) throw new Error(inputBlockers.map((item) => item.message).join("\n"));
  const selected = structuredClone(lab);
  selected.selected_variant_id = variantId;
  selected.selection_decision_id = decisionId;
  const blockers = premiseLabFindings(selected, ledger).filter((item) => item.severity === "blocker");
  if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\n"));
  return selected;
}

export function selectedPremiseContext(lab: PremiseLab | null): string {
  if (!lab?.selected_variant_id) return "";
  const variant = lab.variants.find((item) => item.id === lab.selected_variant_id);
  if (!variant) return "";
  return [
    "## Selected premise",
    `- ID: ${variant.id}`,
    `- Title: ${variant.title}`,
    `- Premise: ${variant.premise}`,
    `- Story engine: ${variant.story_engine}`,
    `- Final-page question: ${variant.central_final_page_question}`,
    `- Immediate gain: ${variant.immediate_gain}`,
    `- Deferred cost: ${variant.deferred_cost}`,
    `- Irreversible effect: ${variant.irreversible_effect}`,
    `- Differentiation: ${variant.differentiation}`,
    `- Series potential: ${variant.series_potential}`,
    ...(variant.accepted_tradeoffs.length ? ["- Accepted tradeoffs:", ...variant.accepted_tradeoffs.map((item) => `  - ${item}`)] : []),
  ].join("\n");
}

export function premiseComparison(lab: PremiseLab): Array<{ id: string; engine: string; observations: string[] }> {
  return [...lab.variants].sort((a, b) => a.order - b.order).map((item) => ({ id: item.id, engine: item.story_engine, observations: [...item.diagnostics] }));
}
