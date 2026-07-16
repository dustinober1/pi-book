import { basename, join } from "node:path";
import type { BookState, ChapterQueueState } from "../domain/schemas.js";
import { ChapterQueueSchema } from "../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  VoiceAuditsPhase5Schema,
  type BookStrategyPhase5,
  type RevisionTicketsPhase5,
  type VoiceAuditsPhase5,
} from "../domain/v1-3-audit-schemas.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { synthesizeTickets, type ReviewFinding } from "../review/review.js";
import { revisionLearningFindings } from "./revision-learning.js";
import { sceneAuditFindings } from "./scene-audit.js";
import { buildVoiceAuditRecord, isVoiceAuditMilestone } from "./voice-audit.js";

export interface AuditEventInput {
  eventType: "draft-chapter" | "review" | "research-update";
  chapter?: number | undefined;
  scope?: string | undefined;
}

function normalized(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function overlay(root: string, files: FileChange[], path: string): string | null {
  return files.find((file) => normalized(file.path) === path)?.content ?? readText(join(root, path));
}

function setChange(changes: FileChange[], path: string, content: string): void {
  const existing = changes.find((item) => normalized(item.path) === path);
  if (existing) existing.content = content;
  else changes.push({ path, content });
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function manuscriptSnapshot(root: string, bookId: string, changes: FileChange[]): { text: string; chapters: number[] } {
  const bookRoot = join(root, "books", bookId);
  const content = new Map<number, string>();
  for (const path of listChapterFiles(bookRoot)) {
    const number = chapterNumber(path);
    if (number !== null) content.set(number, readText(path) ?? "");
  }
  for (const change of changes) {
    if (!normalized(change.path).startsWith(`books/${bookId}/manuscript/chapters/`)) continue;
    const number = chapterNumber(change.path);
    if (number !== null) content.set(number, change.content);
  }
  const chapters = [...content.keys()].sort((a, b) => a - b);
  return { chapters, text: chapters.map((chapter) => content.get(chapter) ?? "").join("\n\n") };
}

function nextAuditId(audits: VoiceAuditsPhase5): string {
  const next = Math.max(0, ...audits.audits.map((audit) => {
    const match = audit.id.match(/^VA-(\d+)$/);
    return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
  })) + 1;
  return `VA-${String(next).padStart(3, "0")}`;
}

export function appendMilestoneVoiceAudit(
  root: string,
  changes: FileChange[],
  book: BookState,
  input: AuditEventInput,
): void {
  const milestone = input.eventType === "draft-chapter"
    ? isVoiceAuditMilestone({ chapter: input.chapter })
    : input.eventType === "review"
      ? isVoiceAuditMilestone({ scope: input.scope })
      : isVoiceAuditMilestone({ scope: input.scope, explicit: input.scope === "recalibration" });
  if (!milestone) return;

  const guardrailText = overlay(root, changes, "series/voice-guardrails.yaml");
  if (!guardrailText) return;
  const guardrails = parseYaml<VoiceGuardrails>(guardrailText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml");
  if (!guardrails.baseline.content_hash || !Object.keys(guardrails.baseline.metrics).length) return;

  const snapshot = manuscriptSnapshot(root, book.book_id, changes);
  if (!snapshot.text.trim()) return;
  const auditPath = `books/${book.book_id}/voice-audits.yaml`;
  const existingText = overlay(root, changes, auditPath);
  const audits = existingText
    ? parseYaml<VoiceAuditsPhase5>(existingText, VoiceAuditsPhase5Schema, auditPath)
    : { schema_version: "1.0.0" as const, audits: [] };
  const queueText = overlay(root, changes, `books/${book.book_id}/chapter-queue.yaml`);
  const queue = queueText ? parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml") : null;
  const pov = input.chapter ? queue?.packets.find((packet) => packet.chapter === input.chapter)?.pov : undefined;
  const scope = input.eventType === "draft-chapter" ? `chapter-${input.chapter}` : input.scope ?? "review";
  audits.audits.push(buildVoiceAuditRecord({
    id: nextAuditId(audits),
    currentText: snapshot.text,
    baselineMetrics: guardrails.baseline.metrics,
    baselineHash: guardrails.baseline.content_hash,
    scope,
    ...(pov ? { pov } : {}),
    chapters: input.eventType === "draft-chapter" && input.chapter ? [input.chapter] : snapshot.chapters,
    protectedExceptions: [],
  }));
  setChange(changes, auditPath, stringifyYaml(audits));
}

export function appendSceneAuditTickets(
  root: string,
  changes: FileChange[],
  book: BookState,
  input: AuditEventInput,
): void {
  if (input.eventType !== "review") return;
  const queuePath = `books/${book.book_id}/chapter-queue.yaml`;
  const plotPath = `books/${book.book_id}/plot-grid.yaml`;
  const ticketPath = `books/${book.book_id}/revision-tickets.yaml`;
  const queue = parseYaml<ChapterQueueState>(overlay(root, changes, queuePath) ?? "", ChapterQueueSchema, queuePath);
  const plot = parseYaml<PlotGridPhase4>(overlay(root, changes, plotPath) ?? "", PlotGridPhase4Schema, plotPath);
  const tickets = parseYaml<RevisionTicketsPhase5>(overlay(root, changes, ticketPath) ?? "", RevisionTicketsPhase5Schema, ticketPath);
  const milestone = input.scope ?? "review";
  const reviewFindings: ReviewFinding[] = sceneAuditFindings(queue, plot).map((finding) => ({
    severity: "medium",
    category: "scene-diversity",
    chapter: finding.chapters.length === 1 ? finding.chapters[0] ?? null : null,
    evidence: finding.evidence,
    problem: finding.problem,
    requiredChange: "Change the scene engine or ensure the scene creates a specific case, relationship, power, or knowledge-state movement.",
    protectedConstraints: ["Preserve approved plot causality, reveal order, and any intentional exception recorded by the writer."],
    acceptanceTests: ["The affected chapter or sequence no longer triggers the same deterministic scene-audit finding."],
    recurrenceKey: finding.recurrenceKey,
    milestoneReview: milestone,
  }));
  setChange(changes, ticketPath, stringifyYaml(synthesizeTickets(tickets, reviewFindings)));
}

export function validateRevisionLearning(
  root: string,
  changes: FileChange[],
  book: BookState,
): void {
  const strategyPath = `books/${book.book_id}/book-strategy.yaml`;
  if (!changes.some((change) => normalized(change.path) === strategyPath)) return;
  const ticketPath = `books/${book.book_id}/revision-tickets.yaml`;
  const strategy = parseYaml<BookStrategyPhase5>(overlay(root, changes, strategyPath) ?? "", BookStrategyPhase5Schema, strategyPath);
  const tickets = parseYaml<RevisionTicketsPhase5>(overlay(root, changes, ticketPath) ?? "", RevisionTicketsPhase5Schema, ticketPath);
  const blockers = revisionLearningFindings(strategy, tickets).filter((finding) => finding.severity === "blocker");
  if (blockers.length) {
    throw new Error(`Revision-learning validation blocked the event:\n${blockers.map((finding) => `- ${finding.message}`).join("\n")}`);
  }
}
