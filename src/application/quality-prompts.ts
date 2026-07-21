import type { QualityCriticLane } from "./quality-risk.js";

export interface QualityPromptMetadata {
  output_type:
    | "scene-plan"
    | "draft-candidate"
    | "candidate-selection"
    | "lane-critique"
    | "event-output"
    | "verification"
    | "claim-extraction"
    | "claim-audit"
    | "claim-repair";
  run_id: string;
  chapter: number;
  source_hashes: string[];
  creation_order: number;
  candidate_id?: string;
  candidate_ids?: string[];
  lane?: QualityCriticLane;
  book_id?: string;
}

function header(metadata: QualityPromptMetadata): string {
  return [
    "NOVEL FORGE ISOLATED QUALITY PASS",
    JSON.stringify(metadata),
    "Return exactly one JSON object. Do not use Markdown fences, commentary, or prose outside the object.",
  ].join("\n");
}

export function scenePlanPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Create a scene-plan artifact with the exact Novel Forge scene-plan schema.",
    "Use only the supplied packet and evidence. Preserve all protected constraints and the chapter ending contract.",
  ].join("\n");
}

export function candidatePrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    `Create draft candidate ${metadata.candidate_id}.`,
    "Return the exact draft-candidate artifact schema: complete chapter text plus proposed canon, relationship, and thread deltas.",
    "Do not edit control files and do not claim that proposed deltas are canonical.",
  ].join("\n");
}

export function selectorPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Select one complete candidate. Do not splice candidates.",
    "Return the exact candidate-selection artifact schema with a selected candidate ID, rationale, and manuscript evidence.",
  ].join("\n");
}

export function criticPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    `Review only the ${metadata.lane} lane.`,
    "Return the exact lane-critique artifact schema. Cite concrete candidate evidence and specify only necessary changes.",
    "You are independent: do not infer, request, or discuss conclusions from other critic lanes.",
  ].join("\n");
}

export function eventOutputPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Produce the final guarded draft-chapter event payload.",
    "Schema: {schema_version:'1.0.0', chapter, files:[{path,content}], summary}.",
    `The manuscript path must be inside books/${metadata.book_id}/manuscript/chapters/ and begin with the requested chapter number.`,
    "Optional control files are limited to continuity-delta.yaml, revision-tickets.yaml, and series/story-threads.yaml.",
    "Apply the supplied critiques without changing the packet endpoint, reveal order, or protected facts.",
  ].join("\n");
}

export function verificationPrompt(metadata: QualityPromptMetadata, purpose: "final-review" | "claim-audit"): string {
  return [
    header(metadata),
    `Perform ${purpose}.`,
    "Return {schema_version:'1.0.0', chapter, verdict:'accept'|'reject', findings:[{evidence,required_change}] }.",
    "Reject only for concrete blockers. Do not rewrite the manuscript in this pass.",
  ].join("\n");
}

export function correctionPrompt(input: {
  metadata: QualityPromptMetadata;
  label: string;
  rejectedOutputHash: string;
  issues: readonly string[];
}): string {
  return [
    header(input.metadata),
    `Correct the rejected ${input.label}.`,
    `Rejected output hash: ${input.rejectedOutputHash}`,
    "Validation issues:",
    ...input.issues.map((issue) => `- ${issue}`),
    "Return a corrected object only. The rejected output text and prior workflow history are intentionally not repeated.",
  ].join("\n");
}
