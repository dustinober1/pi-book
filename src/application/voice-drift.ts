import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  VoiceAuditsPhase5Schema,
  type VoiceAuditMilestone,
  type VoiceAuditsPhase5,
  type VoiceMetricVector,
} from "../domain/v1-3-audit-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";

const FILTER_WORDS = new Set([
  "feel", "feels", "felt", "see", "sees", "saw", "hear", "hears", "heard",
  "notice", "notices", "noticed", "realize", "realizes", "realized", "think", "thinks", "thought",
  "wonder", "wonders", "wondered", "know", "knows", "knew", "seem", "seems", "seemed",
]);

const BODY_LANGUAGE_WORDS = new Set([
  "eye", "eyes", "gaze", "jaw", "breath", "shoulder", "shoulders", "hand", "hands",
  "heart", "stomach", "chest", "throat", "pulse", "smile", "frown", "nod", "nodded", "shrug", "shrugged",
]);

const INTERIORITY_WORDS = new Set([
  "think", "thinks", "thought", "wonder", "wonders", "wondered", "know", "knows", "knew",
  "fear", "fears", "feared", "want", "wants", "wanted", "remember", "remembers", "remembered",
  "realize", "realizes", "realized", "believe", "believes", "believed", "feel", "feels", "felt",
  "hope", "hopes", "hoped", "wish", "wishes", "wished", "imagine", "imagines", "imagined",
]);

const RATE_KEYS = [
  "dialogue_ratio",
  "fragment_ratio",
  "rhetorical_question_rate",
  "filter_word_rate",
  "body_language_repetition_rate",
  "interiority_density",
] as const;

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function words(text: string): string[] {
  return text.normalize("NFKC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function proseParagraphs(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.split("\n").filter((line) => !/^\s*#{1,6}\s/.test(line)).join(" ").trim())
    .filter(Boolean);
}

function sentenceTexts(paragraphs: readonly string[]): string[] {
  return paragraphs.flatMap((paragraph) => paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((item) => item.trim()).filter(Boolean);
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function percentile(values: readonly number[], proportion: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(proportion * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round(Math.max(0, Math.min(1, numerator / denominator))) : 0;
}

export function extractVoiceMetrics(text: string): VoiceMetricVector {
  const paragraphs = proseParagraphs(text);
  const sentences = sentenceTexts(paragraphs);
  const allWords = words(paragraphs.join(" "));
  const sentenceLengths = sentences.map((sentence) => words(sentence).length).filter((count) => count > 0);
  const paragraphLengths = paragraphs.map((paragraph) => words(paragraph).length).filter((count) => count > 0);
  const dialogueText = [...text.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1] ?? "").join(" ");
  const dialogueWords = words(dialogueText).length;
  const filterCount = allWords.filter((word) => FILTER_WORDS.has(word)).length;
  const interiorityCount = allWords.filter((word) => INTERIORITY_WORDS.has(word)).length;
  const bodyCounts = new Map<string, number>();
  for (const word of allWords) if (BODY_LANGUAGE_WORDS.has(word)) bodyCounts.set(word, (bodyCounts.get(word) ?? 0) + 1);
  const repeatedBodyWords = [...bodyCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const fragmentCount = sentenceLengths.filter((count) => count <= 4).length;
  const questionCount = sentences.filter((sentence) => sentence.trim().endsWith("?")).length;
  const sentenceTotal = sentenceLengths.reduce((sum, count) => sum + count, 0);
  const paragraphTotal = paragraphLengths.reduce((sum, count) => sum + count, 0);

  return {
    sample_words: allWords.length,
    sentence_count: sentenceLengths.length,
    paragraph_count: paragraphLengths.length,
    sentence_mean: round(sentenceLengths.length ? sentenceTotal / sentenceLengths.length : 0),
    sentence_median: round(median(sentenceLengths)),
    sentence_p90: round(percentile(sentenceLengths, 0.9)),
    paragraph_mean: round(paragraphLengths.length ? paragraphTotal / paragraphLengths.length : 0),
    paragraph_median: round(median(paragraphLengths)),
    dialogue_ratio: ratio(dialogueWords, allWords.length),
    fragment_ratio: ratio(fragmentCount, sentenceLengths.length),
    rhetorical_question_rate: ratio(questionCount, sentenceLengths.length),
    filter_word_rate: ratio(filterCount, allWords.length),
    body_language_repetition_rate: ratio(repeatedBodyWords, allWords.length),
    interiority_density: ratio(interiorityCount, allWords.length),
  };
}

export interface VoiceMetricComparison {
  deltas: Record<string, number>;
  protected_signals: string[];
  interpretation: "evidence-only";
}

export function compareVoiceMetrics(input: {
  baseline: VoiceMetricVector;
  observed: VoiceMetricVector;
  protectedSignals?: string[];
}): VoiceMetricComparison {
  const deltas: Record<string, number> = {};
  for (const key of Object.keys(input.baseline) as Array<keyof VoiceMetricVector>) {
    deltas[key] = round(Number(input.observed[key]) - Number(input.baseline[key]));
  }
  return {
    deltas,
    protected_signals: [...new Set(input.protectedSignals ?? [])].sort(),
    interpretation: "evidence-only",
  };
}

export interface VoiceDriftEvidence extends VoiceMetricComparison {
  baseline_scope: "project" | "pov";
  pov: string | null;
  baseline: VoiceMetricVector;
  observed: VoiceMetricVector;
}

export function buildVoiceDriftEvidence(input: {
  baselineText: string;
  observedText: string;
  pov?: string | null;
  povBaselineText?: string;
  protectedSignals?: string[];
}): VoiceDriftEvidence {
  const usePov = Boolean(input.pov && input.povBaselineText?.trim());
  const baseline = extractVoiceMetrics(usePov ? input.povBaselineText ?? "" : input.baselineText);
  const observed = extractVoiceMetrics(input.observedText);
  const comparison = input.protectedSignals
    ? compareVoiceMetrics({ baseline, observed, protectedSignals: input.protectedSignals })
    : compareVoiceMetrics({ baseline, observed });
  return {
    baseline_scope: usePov ? "pov" : "project",
    pov: input.pov ?? null,
    baseline,
    observed,
    ...comparison,
  };
}

export interface VoiceAuditRequirement {
  milestone: VoiceAuditMilestone;
  milestone_ref: string;
  chapter_refs: number[];
  scope: string;
}

function auditPath(root: string): string {
  return join(root, "books", readBook(root).book_id, "voice-audits.yaml");
}

function readAudits(root: string): VoiceAuditsPhase5 | null {
  const path = auditPath(root);
  if (!existsSync(path)) return null;
  const text = readText(path);
  return text ? parseYaml<VoiceAuditsPhase5>(text, VoiceAuditsPhase5Schema, "voice-audits.yaml") : null;
}

function approvedMilestoneRefs(audits: VoiceAuditsPhase5): Set<string> {
  return new Set(audits.audits.filter((audit) => audit.status === "approved" && audit.milestone_ref).map((audit) => audit.milestone_ref as string));
}

function requirement(milestone: VoiceAuditMilestone, milestoneRef: string, chapters: number[], scope: string = milestone): VoiceAuditRequirement {
  return { milestone, milestone_ref: milestoneRef, chapter_refs: [...new Set(chapters)].sort((a, b) => a - b), scope };
}

function gateRequirement(root: string, gate: string): VoiceAuditRequirement | null {
  const book = readBook(root);
  if (gate === "first-chapter-approval") return requirement("chapter-1", "chapter-1", [1], "chapter");
  if (["act-1-review", "midpoint-review", "pre-final-act-review"].includes(gate)) {
    return requirement("act-boundary", gate, book.current_chapter ? [book.current_chapter] : [], "act");
  }
  if (gate === "manuscript-approval") return requirement("manuscript-review", "manuscript-review", [], "manuscript");
  return null;
}

function prerequisiteRequirements(root: string, gate?: string): VoiceAuditRequirement[] {
  const book = readBook(root);
  const required: VoiceAuditRequirement[] = [];
  if (book.current_chapter >= 1) required.push(requirement("chapter-1", "chapter-1", [1], "chapter"));
  if (book.current_chapter >= 3) required.push(requirement("chapter-3", "chapter-3", [3], "chapter"));
  if (gate) {
    const gateAudit = gateRequirement(root, gate);
    if (gateAudit && !required.some((item) => item.milestone_ref === gateAudit.milestone_ref)) required.push(gateAudit);
  }
  return required;
}

export function nextVoiceAuditRequirement(root: string): VoiceAuditRequirement | null {
  const audits = readAudits(root);
  if (!audits) return null;
  const approved = approvedMilestoneRefs(audits);
  const project = readProject(root);
  const book = readBook(root);

  for (const due of prerequisiteRequirements(root)) if (!approved.has(due.milestone_ref)) return due;

  if (project.next_gate && ["pending", "rejected"].includes(project.gates[project.next_gate] ?? "")) {
    const due = gateRequirement(root, project.next_gate);
    if (due && !approved.has(due.milestone_ref)) return due;
  }
  if (project.current_stage === "act-review") {
    const ref = project.next_gate ?? book.act_checkpoint ?? `act-boundary-${book.current_chapter}`;
    if (!approved.has(ref)) return requirement("act-boundary", ref, book.current_chapter ? [book.current_chapter] : [], "act");
  }
  if (project.current_stage === "manuscript-review" && !approved.has("manuscript-review")) {
    return requirement("manuscript-review", "manuscript-review", [], "manuscript");
  }
  return null;
}

export function voiceAuditRequirementForScope(root: string, scope: string): VoiceAuditRequirement | null {
  if (scope !== "recalibration") return nextVoiceAuditRequirement(root);
  const audits = readAudits(root);
  if (!audits) return null;
  const count = audits.audits.filter((audit) => audit.milestone === "recalibration").length + 1;
  const book = readBook(root);
  return requirement("recalibration", `recalibration-${String(count).padStart(3, "0")}`, book.current_chapter ? [book.current_chapter] : [], "recalibration");
}

export function assertVoiceAuditCompleteForGate(root: string, gate: string): void {
  const audits = readAudits(root);
  if (!audits) return;
  const approved = approvedMilestoneRefs(audits);
  const missing = prerequisiteRequirements(root, gate).find((due) => !approved.has(due.milestone_ref));
  if (missing) {
    throw new Error(`Required voice audit is incomplete for ${gate}: ${missing.milestone_ref}. Run the guided voice audit before approval.`);
  }
}

export function voiceMetricRateKeys(): readonly string[] {
  return RATE_KEYS;
}
