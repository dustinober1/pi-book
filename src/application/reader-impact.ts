import type { ReaderExperimentsState, RemarkabilityState } from "../domain/schemas.js";

export interface ReaderImpactFinding { severity: "blocker" | "warning"; message: string }

function blank(value: string): boolean { return !value.trim(); }
function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const value of values) { if (seen.has(value)) duplicates.add(value); else seen.add(value); }
  return [...duplicates];
}

export function remarkabilityFindings(state: RemarkabilityState): ReaderImpactFinding[] {
  const findings: ReaderImpactFinding[] = [];
  const required: Array<[string, string]> = [
    ["safe obvious version", state.safe_obvious_version],
    ["author-only advantage", state.author_only_advantage],
    ["productive discomfort", state.productive_discomfort],
    ["retellable hook", state.retellable_hook],
    ["lingering question", state.lingering_question],
    ["hand-sell reason", state.hand_sell_reason],
  ];
  for (const [label, value] of required) if (blank(value)) findings.push({ severity: "blocker", message: `Remarkability contract is missing its ${label}.` });
  if (state.signature_moments.length < 2) findings.push({ severity: "blocker", message: "Remarkability contract needs at least two specific signature moments." });
  if (state.signature_moments.length > 5) findings.push({ severity: "warning", message: "More than five signature moments risks turning memorability into a checklist." });
  for (const moment of state.signature_moments) {
    if (blank(moment.description) || blank(moment.intended_reader_memory)) findings.push({ severity: "blocker", message: `Signature moment ${moment.id} needs both a concrete description and intended reader memory.` });
  }
  for (const id of duplicateValues(state.signature_moments.map((item) => item.id))) findings.push({ severity: "blocker", message: `Duplicate signature-moment id: ${id}.` });
  if (!state.productive_disagreements.length) findings.push({ severity: "blocker", message: "Remarkability contract needs at least one productive target-reader disagreement." });
  for (const disagreement of state.productive_disagreements) {
    if (blank(disagreement.question) || disagreement.competing_readings.filter((item) => !blank(item)).length < 2) findings.push({ severity: "blocker", message: "Each productive disagreement needs a live question and at least two defensible readings." });
  }
  for (const id of duplicateValues(state.recurring_motifs.map((item) => item.id))) findings.push({ severity: "blocker", message: `Duplicate recurring-motif id: ${id}.` });
  if (!state.accepted_reader_costs.length) findings.push({ severity: "warning", message: "No accepted reader cost is recorded; confirm the book is not being optimized toward frictionless consensus." });
  return findings;
}

export function readerExperimentFindings(state: ReaderExperimentsState): ReaderImpactFinding[] {
  const findings: ReaderImpactFinding[] = [];
  for (const id of duplicateValues(state.experiments.map((item) => item.id))) findings.push({ severity: "blocker", message: `Duplicate reader-experiment id: ${id}.` });
  for (const experiment of state.experiments) {
    if (blank(experiment.target_reader)) findings.push({ severity: "blocker", message: `${experiment.id} is missing a target-reader segment.` });
    if (blank(experiment.sample_path)) findings.push({ severity: "blocker", message: `${experiment.id} is missing the exact sample path.` });
    const immediateIds = experiment.immediate_responses.map((item) => item.reader_id);
    const delayedIds = experiment.delayed_responses.map((item) => item.reader_id);
    for (const id of duplicateValues(immediateIds)) findings.push({ severity: "blocker", message: `${experiment.id} has duplicate immediate response reader id ${id}.` });
    for (const id of duplicateValues(delayedIds)) findings.push({ severity: "blocker", message: `${experiment.id} has duplicate delayed response reader id ${id}.` });
    if (["complete"].includes(experiment.status) && !experiment.delayed_responses.length) findings.push({ severity: "blocker", message: `${experiment.id} is complete but has no delayed responses.` });
    if (experiment.verdict === "validated") {
      if (!experiment.delayed_responses.length) findings.push({ severity: "blocker", message: `${experiment.id} uses a validated verdict without delayed responses.` });
      if (!experiment.immediate_responses.length) findings.push({ severity: "blocker", message: `${experiment.id} uses a validated verdict without immediate responses.` });
      const metrics = experiment.metrics;
      if ([metrics.delayed_hook_recall_rate, metrics.signature_moment_recall_rate, metrics.specific_recommendation_rate].some((value) => value === null)) findings.push({ severity: "blocker", message: `${experiment.id} uses a validated verdict without complete delayed recall and recommendation metrics.` });
    }
    if (experiment.status === "delayed-pending" && !experiment.immediate_responses.length) findings.push({ severity: "warning", message: `${experiment.id} is delayed-pending without an immediate response baseline.` });
    if (!experiment.blind && experiment.variant.trim()) findings.push({ severity: "warning", message: `${experiment.id} names a variant but is not blind; comparison bias should be disclosed.` });
  }
  return findings;
}
