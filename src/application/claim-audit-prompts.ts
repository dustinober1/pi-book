import type { QualityPromptMetadata } from "./quality-prompts.js";

function header(metadata: QualityPromptMetadata): string {
  return [
    "NOVEL FORGE GROUNDED CLAIM PASS",
    JSON.stringify(metadata),
    "Return exactly one JSON object. Do not use Markdown fences or commentary.",
  ].join("\n");
}

export function claimExtractionPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Extract factual, procedural, chronological, material, and biographical claims from the supplied proposed chapter.",
    "Return the exact claim-extraction artifact schema with artifact_type:'claim-extraction'.",
    "Use one-based inclusive line ranges and SHA-256 hashes of exactly those normalized chapter lines.",
    "Reference only research and invention IDs supplied in the audit context. Do not invent evidence IDs.",
    "Risk describes the harm of leaving a materially false or unsupported statement uncorrected.",
  ].join("\n");
}

export function claimAuditPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Audit every proposed claim against only the supplied grounded research anchors and declared historical inventions.",
    "Return the exact claim-audit artifact schema with artifact_type:'claim-audit' and one finding per claim.",
    "Supported findings must cite anchor refs as RES-NNN#N. Historical inventions use status:'invention' and action:'accept-invention'.",
    "Unsupported high-risk claims use action:'block'. Unsupported medium or low claims use 'qualify' or 'generalize'.",
    "Do not treat model confidence, general knowledge, or contextual plausibility as evidence.",
  ].join("\n");
}

export function claimRepairPrompt(metadata: QualityPromptMetadata): string {
  return [
    header(metadata),
    "Repair only the supplied unsupported medium/low claim findings in the proposed draft event.",
    "Return the exact guarded draft-chapter event-output schema, not a claim artifact.",
    "Qualify or generalize only the cited lines. Preserve all supported facts, scene structure, endpoint, voice, reveal order, and control files.",
    "Do not add new factual claims to compensate for removed specificity.",
  ].join("\n");
}
