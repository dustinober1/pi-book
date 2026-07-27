import { basename, join } from "node:path";
import {
  CanonSchema,
  ChapterQueueSchema,
  GenreConfigSchema,
  ReaderExperimentsSchema,
  RemarkabilitySchema,
  StoryThreadsSchema,
  type BookState,
  type CanonState,
  type ChapterQueueState,
  type GenreConfig,
  type ProfileId,
  type ProjectState,
  type ReaderExperimentsState,
  type RemarkabilityState,
  type Stage,
  type StoryThreadsState,
} from "../domain/schemas.js";
import type { WriterApprovalEvidence } from "../domain/plan-change-request.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  type BookStrategyPhase5,
  type RevisionTicketsPhase5,
} from "../domain/v1-3-audit-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, type ResearchLedger } from "../domain/v1-3-schemas.js";
import { DecisionLedgerSchema, IntakeSchema, PremiseLabSchema, intakeDecisionFindings, type DecisionLedger, type IntakeState, type PremiseLab } from "../domain/v1-4-schemas.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../domain/historical-fiction.js";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import type { FileChange } from "../infrastructure/transaction.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { openBlockingTickets } from "../review/review.js";
import {
  appendMilestoneVoiceAudit,
  appendSceneAuditTickets,
  validateRevisionLearning,
} from "./audit-events.js";
import { bookPlanFindings } from "./book-strategy.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { packetReferenceFindings } from "./integrity.js";
import { projectStateHash } from "./project-hash.js";
import { premiseLabFindings } from "./premise-lab.js";
import { normalizeEventRejection, type EventRejectionDetail } from "./event-rejection.js";
import { ValidationAggregator } from "./validation-aggregate.js";
import { draftLengthFinding } from "./draft-length.js";
import { outOfBandWriteFindings } from "./working-tree-guard.js";
import { readerExperimentFindings, remarkabilityFindings } from "./reader-impact.js";
import { readerFrictionFindings } from "./review-observations.js";
import { researchEvidenceFindings } from "./research-evidence.js";
import { compactPacketWindow, packetWindowDecision, packetWindowFindings } from "./packet-window.js";
import { historicalIntegrityFindings } from "./historical-integrity.js";
import { actBoundaryFindings, requiredMilestoneGate } from "./act-boundaries.js";
import { buildActiveBookManuscript } from "./package.js";
import { isPlanChangeControlPathAllowed, validatePlanChangeEvent } from "./plan-change-policy.js";
import { isStoryControlPathAllowed } from "./story-control-paths.js";

export { projectStateHash } from "./project-hash.js";

export type NovelEventType = "voice-profile" | "series-plan" | "book-plan" | "chapter-queue" | "draft-chapter" | "review" | "reader-test" | "research-update" | "intake-update" | "premise-update" | "plan-change" | "revise" | "canon-lock" | "package";
export interface NovelEventInput {
  eventType: NovelEventType;
  expectedStage: Stage;
  expectedProjectHash: string;
  files: FileChange[];
  chapter?: number;
  scope?: string;
  planChangeApproval?: WriterApprovalEvidence;
}
export interface NovelEventResult { changed: string[]; stage: Stage; projectHash: string; gitMessage: string; advisories: string[] }

const eventStages: Record<NovelEventType, Stage[]> = {
  "voice-profile": ["voice-intake"],
  "series-plan": ["series-planning"],
  "book-plan": ["book-planning"],
  "chapter-queue": ["chapter-queue"],
  "draft-chapter": ["drafting"],
  review: ["drafting", "act-review", "revision", "manuscript-review"],
  "reader-test": ["drafting", "act-review", "revision", "manuscript-review", "packaging"],
  "research-update": ["voice-intake", "series-planning", "book-planning", "drafting", "act-review", "revision", "manuscript-review", "packaging"],
  "intake-update": ["voice-intake", "series-planning", "book-planning"],
  "premise-update": ["book-planning"],
  "plan-change": ["chapter-queue", "drafting", "act-review", "revision", "manuscript-review"],
  revise: ["revision"],
  "canon-lock": ["canon-lock"],
  package: ["packaging"],
};

function normalized(path: string): string { return path.replace(/\\/g, "/").replace(/^\.\//, ""); }

function allowedPath(event: NovelEventType, path: string, bookId: string, profile: ProfileId, chapter?: number): boolean {
  const book = `books/${bookId}`;
  if (event === "plan-change") return isPlanChangeControlPathAllowed(path, bookId);
  if (profile === "historical-fiction" && ["book-plan", "research-update"].includes(event)
    && [`${book}/historical-context.yaml`, `${book}/invention-ledger.yaml`].includes(path)) return true;
  if (profile === "historical-fiction" && event === "research-update" && path === "series/decision-ledger.yaml") return true;
  if (isStoryControlPathAllowed(event, path, bookId)) return true;
  const exact: Record<NovelEventType, string[]> = {
    "voice-profile": ["series/voice-profile.md", "series/taste-profile.yaml", "series/voice-guardrails.yaml", "series/voice-experiments/index.yaml"],
    "series-plan": ["series/series-bible.md", "series/series-arc.yaml", "series/canon.yaml", "series/story-threads.yaml"],
    "book-plan": [`${book}/book-bible.md`, `${book}/genre.yaml`, `${book}/plot-grid.yaml`, `${book}/chapter-queue.yaml`, `${book}/continuity-delta.yaml`, `${book}/remarkability.yaml`, `${book}/research-ledger.yaml`, `${book}/book-strategy.yaml`, "research/source-register.yaml", "series/story-threads.yaml"],
    "chapter-queue": [`${book}/chapter-queue.yaml`, `${book}/plot-grid.yaml`],
    "draft-chapter": [`${book}/continuity-delta.yaml`, "series/story-threads.yaml", `${book}/revision-tickets.yaml`],
    review: [`${book}/review-report.md`, `${book}/revision-tickets.yaml`, `${book}/voice-audits.yaml`],
    "reader-test": [`${book}/reader-experiments.yaml`, `${book}/revision-tickets.yaml`],
    "intake-update": ["series/intake.yaml", "series/decision-ledger.yaml"],
    "premise-update": [`${book}/premise-lab.yaml`, "series/decision-ledger.yaml"],
    "plan-change": [],
    "research-update": [
      "series/taste-profile.yaml",
      "series/voice-guardrails.yaml",
      "series/voice-experiments/index.yaml",
      `${book}/research-ledger.yaml`,
      `${book}/book-strategy.yaml`,
      `${book}/voice-audits.yaml`,
      "research/source-register.yaml",
    ],
    revise: [`${book}/continuity-delta.yaml`, "series/story-threads.yaml", `${book}/revision-tickets.yaml`],
    "canon-lock": ["series/canon.yaml", "series/story-threads.yaml", "series/series-arc.yaml"],
    package: [`${book}/package.md`],
  };
  if (exact[event].includes(path)) return true;
  if (event === "research-update" && /^series\/voice-experiments\/VE-[0-9]{3}\/experiment\.yaml$/.test(path)) return true;
  if (event === "research-update" && /^series\/voice-experiments\/VE-[0-9]{3}\/[^/]+\.md$/i.test(path)) return true;
  if (event === "reader-test" && path.startsWith(`${book}/reader-kit/`) && /\.(md|csv)$/i.test(path)) return true;
  if (["draft-chapter", "revise"].includes(event) && path.startsWith(`${book}/manuscript/chapters/`) && /\.md$/i.test(path)) {
    if (event === "revise" || chapter === undefined) return true;
    const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
    return Boolean(match && Number.parseInt(match[1] ?? "", 10) === chapter);
  }
  return false;
}

/**
 * A manuscript chapter file is matched by a leading chapter number in its
 * basename, not by the word "chapter", so the natural-looking
 * `chapter-001.md` is rejected. Saying only "is not allowed" leaves an author
 * agent guessing at a naming rule it cannot see, so name the rule here.
 */
function disallowedPathHint(event: NovelEventType, path: string, bookId: string, chapter?: number): string {
  if (!["draft-chapter", "revise"].includes(event)) return "";
  const chapterRoot = `books/${bookId}/manuscript/chapters/`;
  const candidate = normalized(path);
  // Only a submission that was plausibly meant to be manuscript prose gets the
  // naming rule; an unrelated control path would just be misdirected by it.
  if (!candidate.startsWith(`books/${bookId}/manuscript/`) && !candidate.toLowerCase().endsWith(".md")) return "";
  const number = chapter ?? chapterNumber(path);
  const example = number === null || number === undefined ? "001" : String(number).padStart(3, "0");
  if (!candidate.startsWith(chapterRoot)) {
    return ` A ${event} manuscript file must live in ${chapterRoot} and its file name must begin with the chapter number, for example ${chapterRoot}${example}-a-short-slug.md.`;
  }
  return ` A manuscript chapter file name must begin with the chapter number followed by a separator, for example ${example}-a-short-slug.md. The word "chapter" in the name is not a substitute: chapter-${example}.md does not match${chapter === undefined ? "" : `, and the leading number must equal the submitted chapter ${chapter}`}.`;
}

function overlay(root: string, files: FileChange[], path: string): string | null {
  return files.find((file) => normalized(file.path) === path)?.content ?? readText(join(root, path));
}

function setChange(changes: FileChange[], path: string, content: string): void {
  const existing = changes.find((item) => normalized(item.path) === path);
  if (existing) existing.content = content;
  else changes.push({ path, content });
}

function parseOverlay<T>(root: string, files: FileChange[], path: string, schema: object, label = path): T {
  const content = overlay(root, files, path);
  if (!content) throw new Error(`Missing required event state: ${path}`);
  return parseYaml<T>(content, schema as never, label);
}

function missingRequiredPaths(files: FileChange[], requiredPaths: string[]): string[] {
  const submitted = new Set(files.map((file) => file.path));
  return requiredPaths.filter((path) => !submitted.has(path));
}

/**
 * A book-plan event replaces the whole plan, so every file below must be present
 * on every submission — including a corrected retry that fixes only one of them.
 */
export function requiredBookPlanPaths(book: Pick<BookState, "book_id" | "profile">): string[] {
  const paths = [
    `books/${book.book_id}/book-bible.md`,
    `books/${book.book_id}/plot-grid.yaml`,
    `books/${book.book_id}/remarkability.yaml`,
    `books/${book.book_id}/research-ledger.yaml`,
    `books/${book.book_id}/book-strategy.yaml`,
  ];
  if (book.profile === "historical-fiction") {
    paths.push(
      `books/${book.book_id}/historical-context.yaml`,
      `books/${book.book_id}/invention-ledger.yaml`,
    );
  }
  return paths;
}

function validateResearchAndFriction(root: string, files: FileChange[], book: BookState, eventType: NovelEventType): void {
  const base = `books/${book.book_id}`;
  const paths = new Set(files.map((file) => normalized(file.path)));
  const validateResearch = eventType === "book-plan" || paths.has(`${base}/research-ledger.yaml`) || paths.has("research/source-register.yaml");
  const validateFriction = eventType === "book-plan" || paths.has(`${base}/book-strategy.yaml`);
  const findings = [];
  if (validateResearch) {
    const ledger = parseOverlay<ResearchLedger>(root, files, `${base}/research-ledger.yaml`, ResearchLedgerSchema);
    const sources = parseOverlay<SourceRegisterV13>(root, files, "research/source-register.yaml", SourceRegisterV13Schema);
    findings.push(...researchEvidenceFindings(ledger, sources));
  }
  if (validateFriction) {
    const strategy = parseOverlay<BookStrategyPhase5>(root, files, `${base}/book-strategy.yaml`, BookStrategyPhase5Schema);
    findings.push(...readerFrictionFindings(strategy));
  }
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Research and reader-friction validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
}

function validateFiles(root: string, input: NovelEventInput, project: ProjectState, book: BookState, findings: ValidationAggregator): void {
  if (!eventStages[input.eventType].includes(project.current_stage)) throw new Error(`${input.eventType} is not allowed during ${project.current_stage}.`);
  if (input.expectedStage !== project.current_stage) throw new Error(`Stale event stage: expected ${input.expectedStage}, current ${project.current_stage}.`);
  if (input.expectedProjectHash !== projectStateHash(root)) throw new Error("Stale project hash; reload state before applying this event.");
  if (input.eventType === "research-update" && input.files.length === 0) throw new Error("research-update requires at least one evidence file.");
  if (input.eventType === "intake-update" && input.files.length === 0) throw new Error("intake-update requires at least one intake evidence file.");
  if (input.eventType === "premise-update" && input.files.length === 0) throw new Error("premise-update requires at least one premise evidence file.");
  if (input.eventType === "plan-change" && input.files.length < 2) throw new Error("plan-change requires one approval record and at least one future control file.");
  const seen = new Set<string>();
  for (const file of input.files) {
    file.path = normalized(file.path);
    if (seen.has(file.path)) throw new Error(`Duplicate event path: ${file.path}`);
    seen.add(file.path);
    if (!allowedPath(input.eventType, file.path, book.book_id, book.profile, input.chapter)) {
      throw new Error(`${file.path} is not allowed for ${input.eventType}.${disallowedPathHint(input.eventType, file.path, book.book_id, input.chapter)}`);
    }
  }
  const required: Partial<Record<NovelEventType, RegExp>> = {
    "voice-profile": /series\/voice-profile\.md$/,
    "series-plan": /series\/(series-bible\.md|series-arc\.yaml)$/,
    "book-plan": /remarkability\.yaml$/,
    "chapter-queue": /chapter-queue\.yaml$/,
    "draft-chapter": /manuscript\/chapters\/.*\.md$/,
    review: /review-report\.md$|revision-tickets\.yaml$/,
    "reader-test": /reader-experiments\.yaml$/,
    "plan-change": /plan-changes\/PC-[0-9]{3}\.yaml$/,
    "canon-lock": /series\/canon\.yaml$/,
    package: /package\.md$/,
  };
  const pattern = required[input.eventType];
  if (pattern && !input.files.some((file) => pattern.test(file.path))) {
    findings.add(`${input.eventType} event is missing its required output file.`);
  }
  if (input.eventType === "plan-change") {
    findings.run(() => validatePlanChangeEvent({
      root,
      files: input.files,
      book,
      expectedProjectHash: input.expectedProjectHash,
      ...(input.planChangeApproval ? { approval: input.planChangeApproval } : {}),
    }));
  }
  if (input.eventType === "voice-profile") {
    const missing = missingRequiredPaths(input.files, [
      "series/voice-profile.md",
      "series/taste-profile.yaml",
      "series/voice-guardrails.yaml",
      "series/voice-experiments/index.yaml",
    ]);
    if (missing.length) findings.add(`voice-profile event is missing required output: ${missing.join(", ")}`);
  }
  if (input.eventType === "series-plan") {
    const missing = missingRequiredPaths(input.files, [
      "series/series-bible.md",
      "series/series-arc.yaml",
      "series/canon.yaml",
      "series/story-threads.yaml",
    ]);
    if (missing.length) findings.add(`series-plan event is missing required output: ${missing.join(", ")}`);
  }
  if (input.eventType === "book-plan") {
    const missing = missingRequiredPaths(input.files, requiredBookPlanPaths(book));
    if (missing.length) findings.add(`book-plan event is missing required output: ${missing.join(", ")}`);
    findings.run(() => {
      const remarkability = parseOverlay<RemarkabilityState>(root, input.files, `books/${book.book_id}/remarkability.yaml`, RemarkabilitySchema);
      const blockers = remarkabilityFindings(remarkability).filter((finding) => finding.severity === "blocker");
      if (blockers.length) throw new Error(`Remarkability validation blocked book-plan:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
  if (input.eventType === "reader-test") {
    findings.run(() => {
      const experiments = parseOverlay<ReaderExperimentsState>(root, input.files, `books/${book.book_id}/reader-experiments.yaml`, ReaderExperimentsSchema);
      const blockers = readerExperimentFindings(experiments).filter((finding) => finding.severity === "blocker");
      if (blockers.length) throw new Error(`Reader-evidence validation blocked reader-test:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
  if (input.eventType === "book-plan" || input.eventType === "research-update") {
    findings.run(() => validateResearchAndFriction(root, input.files, book, input.eventType));
    findings.run(() => validateRevisionLearning(root, input.files, book));
  }
  if (input.eventType === "research-update" && book.profile === "historical-fiction") {
    findings.run(() => validateHistoricalIntegrity(root, input.files, book));
  }
  if (input.eventType === "premise-update" || (input.eventType === "book-plan" && overlay(root, input.files, `books/${book.book_id}/premise-lab.yaml`))) {
    findings.run(() => {
      const lab = parseOverlay<PremiseLab>(root, input.files, `books/${book.book_id}/premise-lab.yaml`, PremiseLabSchema);
      const ledger = parseOverlay<DecisionLedger>(root, input.files, "series/decision-ledger.yaml", DecisionLedgerSchema);
      const blockers = premiseLabFindings(lab, ledger).filter((finding) => finding.severity === "blocker");
      if (input.eventType === "book-plan" && lab.variants.length > 0 && (!lab.selected_variant_id || !lab.selection_decision_id)) {
        blockers.push({ severity: "blocker", code: "unselected-premise", message: "A rebuilt book plan requires an explicitly selected premise variant." });
      }
      if (blockers.length) throw new Error(`Premise validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
  if (input.eventType === "intake-update") {
    findings.run(() => {
      const intake = parseOverlay<IntakeState>(root, input.files, "series/intake.yaml", IntakeSchema);
      const ledger = parseOverlay<DecisionLedger>(root, input.files, "series/decision-ledger.yaml", DecisionLedgerSchema);
      const blockers = intakeDecisionFindings(intake, ledger).filter((finding) => finding.severity === "blocker");
      if (blockers.length) throw new Error(`Intake and decision ledger validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
}

function validateHistoricalIntegrity(root: string, files: FileChange[], book: BookState): void {
  const bookRoot = `books/${book.book_id}`;
  const blockers = historicalIntegrityFindings({
    genre: parseOverlay<GenreConfig>(root, files, `${bookRoot}/genre.yaml`, GenreConfigSchema),
    context: parseOverlay<HistoricalContext>(root, files, `${bookRoot}/historical-context.yaml`, HistoricalContextSchema),
    inventions: parseOverlay<InventionLedger>(root, files, `${bookRoot}/invention-ledger.yaml`, InventionLedgerSchema),
    research: parseOverlay<ResearchLedger>(root, files, `${bookRoot}/research-ledger.yaml`, ResearchLedgerSchema),
    sources: parseOverlay<SourceRegisterV13>(root, files, "research/source-register.yaml", SourceRegisterV13Schema),
    queue: parseOverlay<ChapterQueueState>(root, files, `${bookRoot}/chapter-queue.yaml`, ChapterQueueSchema),
    plot: parseOverlay<PlotGridPhase4>(root, files, `${bookRoot}/plot-grid.yaml`, PlotGridPhase4Schema),
    decisions: parseOverlay<DecisionLedger>(root, files, "series/decision-ledger.yaml", DecisionLedgerSchema),
  }).filter((finding) => finding.severity === "blocker");
  if (blockers.length) {
    throw new Error(`Historical integrity validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

/**
 * Reports why a chapter was hand-drafted instead of executed through the
 * guarded scene path, or null when no such report is owed. `draft-chapter` is a
 * legitimate route, but it runs no scene critics, no targeted repair, and no
 * ordered acceptance, and the writer has no other way to learn that.
 */
function guardedExecutionSkipReason(root: string, bookId: string, chapter: number): string | null {
  const path = chapterContractPath(bookId, chapter);
  const text = readText(join(root, path));
  const preamble = `Chapter ${chapter} was drafted without guarded scene execution: no scene critics, no targeted repair, and no ordered acceptance ran.`;
  if (text === null) return `${preamble} No executable chapter contract exists at ${path}. Say so plainly in your summary to the writer.`;
  let contract: ChapterContract;
  try { contract = parseYaml<ChapterContract>(text, ChapterContractSchema, path); }
  catch { return `${preamble} The chapter contract at ${path} could not be read. Say so plainly in your summary to the writer.`; }
  if (contract.small_model_ready) {
    return `${preamble} An executable contract exists at ${path}, so novel_advance_chapter_step was available and was not used. Say so plainly in your summary to the writer.`;
  }
  return `${preamble} The contract at ${path} is not small-model ready (${contract.missing_small_model_fields.join(", ") || "missing executable fields"}). Say so plainly in your summary to the writer.`;
}

function projectedWordCount(root: string, bookId: string, changes: FileChange[]): number {
  const rootPath = join(root, "books", bookId);
  const content = new Map<number, string>();
  for (const path of listChapterFiles(rootPath)) {
    const number = chapterNumber(path);
    if (number !== null) content.set(number, readText(path) ?? "");
  }
  for (const change of changes) if (change.path.startsWith(`books/${bookId}/manuscript/chapters/`)) {
    const number = chapterNumber(change.path);
    if (number !== null) content.set(number, change.content);
  }
  return [...content.values()].reduce((sum, text) => sum + countWords(text), 0);
}

function validateArchitecture(root: string, files: FileChange[], book: BookState, event: NovelEventType, collector: ValidationAggregator, chapter?: number): { queue: ChapterQueueState; plot: PlotGridPhase4 } | undefined {
  const bookRoot = `books/${book.book_id}`;
  const profile = getProfile(book.profile);
  const parsed = collector.run(() => ({
    genre: parseOverlay<GenreConfig>(root, files, `${bookRoot}/genre.yaml`, GenreConfigSchema),
    plot: parseOverlay<PlotGridPhase4>(root, files, `${bookRoot}/plot-grid.yaml`, PlotGridPhase4Schema),
    queue: parseOverlay<ChapterQueueState>(root, files, `${bookRoot}/chapter-queue.yaml`, ChapterQueueSchema),
  }));
  // Every later architecture check reads these three files; without them there is
  // nothing further to report beyond the parse failure already collected.
  if (!parsed) return undefined;
  const { genre, plot, queue } = parsed;
  const findings = [
    ...profile.validateGenreConfig(genre),
    ...actBoundaryFindings(plot).map((finding) => ({ severity: finding.severity, category: "act-boundary", message: finding.message } as const)),
    ...(event === "book-plan" || event === "chapter-queue" ? profile.validatePlot(plot) : []),
  ];
  const packets = chapter ? queue.packets.filter((packet) => packet.chapter === chapter) : event === "book-plan" || event === "chapter-queue" ? queue.packets.filter((packet) => packet.status === "ready") : [];
  for (const packet of packets) {
    // Profile validators see one packet at a time and cannot name the chapter,
    // so an author agent reading a multi-packet rejection cannot tell which
    // chapters are broken. Attribute each finding here instead.
    findings.push(...profile.validatePacket(packet).map((finding) => (
      finding.message.includes(`Chapter ${packet.chapter}`)
        ? finding
        : { ...finding, message: `Chapter ${packet.chapter}: ${finding.message}` }
    )));
    const expectedGate = requiredMilestoneGate(plot, packet.chapter);
    if (packet.milestone_gate && packet.milestone_gate !== expectedGate) {
      findings.push({ severity: "blocker", category: "act-boundary", message: `Chapter ${packet.chapter} packet gate ${packet.milestone_gate} disagrees with plot-derived gate ${expectedGate ?? "none"}.` });
    } else if (event !== "draft-chapter" && expectedGate && packet.milestone_gate !== expectedGate) {
      findings.push({ severity: "blocker", category: "act-boundary", message: `Chapter ${packet.chapter} must carry plot-derived milestone gate ${expectedGate}.` });
    }
  }
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  if (blockers.length) collector.add(`Profile validation blocked ${event}:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);

  if (packets.length) {
    collector.run(() => {
      const canon = parseOverlay<CanonState>(root, files, "series/canon.yaml", CanonSchema);
      const threads = parseOverlay<StoryThreadsState>(root, files, "series/story-threads.yaml", StoryThreadsSchema);
      const sources = parseOverlay<SourceRegisterV13>(root, files, "research/source-register.yaml", SourceRegisterV13Schema);
      const research = parseOverlay<ResearchLedger>(root, files, `${bookRoot}/research-ledger.yaml`, ResearchLedgerSchema);
      const referenceBlockers = packets.flatMap((packet) => packetReferenceFindings(packet, canon, threads, sources, plot, research)).filter((finding) => finding.severity === "blocker");
      if (referenceBlockers.length) throw new Error(`Reference validation blocked ${event}:\n${referenceBlockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }

  if (book.profile === "historical-fiction") collector.run(() => validateHistoricalIntegrity(root, files, book));

  if (event === "book-plan" || event === "chapter-queue") {
    collector.run(() => {
      const drafted = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
      const windowBlockers = packetWindowFindings(queue, plot, drafted).filter((finding) => finding.severity === "blocker");
      if (windowBlockers.length) throw new Error(`Packet-window validation blocked ${event}:\n${windowBlockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
  if (event === "book-plan") {
    collector.run(() => {
      const strategy = parseOverlay<BookStrategyPhase5>(root, files, `${bookRoot}/book-strategy.yaml`, BookStrategyPhase5Schema);
      const planBlockers = bookPlanFindings({ strategy, plot, queue }).filter((finding) => finding.severity === "blocker");
      if (planBlockers.length) throw new Error(`Book strategy validation blocked book-plan:\n${planBlockers.map((item) => `- ${item.message}`).join("\n")}`);
    });
  }
  return { queue, plot };
}

interface ValidatedEvent {
  project: ProjectState;
  book: BookState;
  changes: FileChange[];
  queue: ChapterQueueState | null;
  plot: PlotGridPhase4 | null;
  advisories: string[];
}

/**
 * Runs the complete validation pass without writing anything, so the same
 * contract can back both a real apply and a dry run.
 */
function runEventValidation(root: string, input: NovelEventInput): ValidatedEvent {
  const project = structuredClone(readProject(root));
  const book = structuredClone(readBook(root));
  const findings = new ValidationAggregator();
  validateFiles(root, input, project, book, findings);
  const changes = input.files.map((file) => ({ path: normalized(file.path), content: file.content }));
  let queue: ChapterQueueState | null = null;
  let plot: PlotGridPhase4 | null = null;
  if (["book-plan", "chapter-queue", "draft-chapter"].includes(input.eventType)) {
    const architecture = validateArchitecture(root, changes, book, input.eventType, findings, input.chapter);
    if (architecture) ({ queue, plot } = architecture);
  }

  const advisories: string[] = [];
  for (const finding of outOfBandWriteFindings(root, changes)) {
    if (finding.severity === "blocker") findings.add(`Working-tree validation blocked ${input.eventType}:\n- ${finding.message}`);
    else advisories.push(finding.message);
  }
  if (input.eventType === "draft-chapter" && input.chapter) {
    const packet = queue?.packets.find((item) => item.chapter === input.chapter);
    const draft = changes.find((change) => change.path.startsWith(`books/${book.book_id}/manuscript/chapters/`));
    const finding = packet && draft ? draftLengthFinding(packet.chapter, packet.target_words, draft.content) : null;
    if (finding?.severity === "blocker") findings.add(`Draft-length validation blocked draft-chapter:\n- ${finding.message}`);
    else if (finding) advisories.push(finding.message);
    // SKILL.md requires the agent to disclose that critics and repair did not
    // run, but the v1.9.1 remedy text only fired from novel_advance_chapter_step
    // — which an agent skips entirely once it sees an empty contracts directory.
    // The disclosure has to come from the path the agent cannot avoid.
    const skipped = guardedExecutionSkipReason(root, book.book_id, input.chapter);
    if (skipped) advisories.push(skipped);
  }

  findings.throwIfAny();
  return { project, book, changes, queue, plot, advisories };
}

export interface NovelEventValidation {
  valid: boolean;
  eventType: NovelEventType;
  submittedPaths: string[];
  missingRequiredPaths: string[];
  rejection: EventRejectionDetail | null;
  advisories: string[];
}

/**
 * Validates a proposed event and reports the result instead of applying it.
 * A dry run writes nothing, creates no Git checkpoint, and never advances a
 * stage or gate, so an author agent can converge on a valid payload without
 * spending its bounded retry on the real transaction.
 */
export function validateNovelEvent(root: string, input: NovelEventInput): NovelEventValidation {
  const submittedPaths = input.files.map((file) => normalized(file.path));
  let missing: string[] = [];
  try {
    const book = readBook(root);
    if (input.eventType === "book-plan") missing = missingRequiredPaths(input.files.map((file) => ({ ...file, path: normalized(file.path) })), requiredBookPlanPaths(book));
  } catch {
    // A project that cannot be read is reported through the rejection below.
  }
  try {
    const { advisories } = runEventValidation(root, input);
    return { valid: true, eventType: input.eventType, submittedPaths, missingRequiredPaths: missing, rejection: null, advisories };
  } catch (error) {
    let currentStage = String(input.expectedStage || "unknown");
    let currentProjectHash = String(input.expectedProjectHash || "unknown");
    try {
      currentStage = readProject(root).current_stage;
      currentProjectHash = projectStateHash(root);
    } catch {
      // The normalizer classifies project-read failures without exposing paths.
    }
    const rejection = normalizeEventRejection(error, { root, currentStage, currentProjectHash });
    return { valid: false, eventType: input.eventType, submittedPaths, missingRequiredPaths: missing, rejection: rejection.detail, advisories: [] };
  }
}

function applyNovelEventInternal(root: string, input: NovelEventInput): NovelEventResult {
  const { project, book, changes, queue: validatedQueue, plot, advisories } = runEventValidation(root, input);
  let queue = validatedQueue;

  switch (input.eventType) {
    case "voice-profile":
      project.gates["voice-approval"] = "pending";
      project.next_gate = "voice-approval";
      break;
    case "series-plan":
      project.current_stage = "book-planning";
      project.next_gate = null;
      break;
    case "book-plan":
      project.gates["book-plan-approval"] = "pending";
      project.next_gate = "book-plan-approval";
      break;
    case "chapter-queue":
      project.current_stage = "drafting";
      project.next_gate = null;
      book.status = "drafting";
      break;
    case "draft-chapter": {
      if (!input.chapter || !queue || !plot) throw new Error("draft-chapter requires a chapter number and valid queue.");
      const packet = queue.packets.find((item) => item.chapter === input.chapter);
      if (!packet) throw new Error(`Chapter ${input.chapter} packet not found.`);
      packet.status = "drafted";
      queue = compactPacketWindow(queue);
      setChange(changes, `books/${book.book_id}/chapter-queue.yaml`, stringifyYaml(queue));
      appendMilestoneVoiceAudit(root, changes, book, { eventType: "draft-chapter", chapter: input.chapter, scope: input.scope });
      book.current_chapter = Math.max(book.current_chapter, input.chapter);
      book.actual_words = projectedWordCount(root, book.book_id, changes);
      book.status = "drafting";
      if (input.chapter === 1 && project.automation.require_first_chapter_approval && project.gates["first-chapter-approval"] !== "approved") {
        project.gates["first-chapter-approval"] = "pending";
        project.next_gate = "first-chapter-approval";
        project.current_stage = "drafting";
      } else if (requiredMilestoneGate(plot, input.chapter)) {
        const milestoneGate = requiredMilestoneGate(plot, input.chapter)!;
        if (!(milestoneGate in project.gates)) throw new Error(`Unknown milestone gate: ${milestoneGate}`);
        project.gates[milestoneGate] = "pending";
        project.next_gate = milestoneGate;
        project.current_stage = "act-review";
        book.act_checkpoint = milestoneGate;
      } else {
        const manuscriptNumbers = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
        manuscriptNumbers.add(input.chapter);
        const window = packetWindowDecision(queue, plot, manuscriptNumbers);
        project.current_stage = window.allPlannedComplete ? "manuscript-review" : window.needsRefill ? "chapter-queue" : "drafting";
        project.next_gate = null;
      }
      break;
    }
    case "review": {
      appendSceneAuditTickets(root, changes, book, { eventType: "review", scope: input.scope });
      appendMilestoneVoiceAudit(root, changes, book, { eventType: "review", scope: input.scope });
      const tickets = parseOverlay<RevisionTicketsPhase5>(root, changes, `books/${book.book_id}/revision-tickets.yaml`, RevisionTicketsPhase5Schema);
      book.status = "review";
      if (openBlockingTickets(tickets).length) project.current_stage = "revision";
      else if (input.scope === "manuscript" || project.current_stage === "manuscript-review") {
        const manuscript = buildActiveBookManuscript(root);
        setChange(changes, "delivery/manuscript.md", manuscript.content);
        project.current_stage = "manuscript-review";
        project.gates["manuscript-approval"] = "pending";
        project.next_gate = "manuscript-approval";
      } else if (input.scope === "chapter") {
        project.current_stage = "drafting";
        if (project.gates["first-chapter-approval"] !== "approved") {
          project.gates["first-chapter-approval"] = "pending";
          project.next_gate = "first-chapter-approval";
        }
      } else {
        project.current_stage = "act-review";
        if (!project.next_gate) {
          project.next_gate = "act-1-review";
          project.gates["act-1-review"] = "pending";
        }
      }
      break;
    }
    case "reader-test":
      break;
    case "research-update":
      appendMilestoneVoiceAudit(root, changes, book, { eventType: "research-update", scope: input.scope });
      break;
    case "intake-update":
      break;
    case "premise-update":
      break;
    case "plan-change":
      break;
    case "revise": {
      const tickets = parseOverlay<RevisionTicketsPhase5>(root, changes, `books/${book.book_id}/revision-tickets.yaml`, RevisionTicketsPhase5Schema);
      book.status = "revision";
      if (openBlockingTickets(tickets).length) project.current_stage = "revision";
      else if (project.next_gate === "manuscript-approval") project.current_stage = "manuscript-review";
      else if (project.next_gate) project.current_stage = "act-review";
      else project.current_stage = "drafting";
      break;
    }
    case "canon-lock":
      book.canon_locked = true;
      book.status = "locked";
      project.current_stage = "packaging";
      project.next_gate = null;
      break;
    case "package":
      book.status = "packaged";
      project.gates["package-approval"] = "pending";
      project.next_gate = "package-approval";
      project.current_stage = "packaging";
      break;
  }

  if (!["research-update", "intake-update", "premise-update", "plan-change"].includes(input.eventType)) {
    setChange(changes, "PROJECT.yaml", stringifyYaml(project));
    setChange(changes, `books/${book.book_id}/BOOK.yaml`, stringifyYaml(book));
  }
  const message = `Novel Forge: ${input.eventType}${input.chapter ? ` chapter-${input.chapter}` : ""}`;
  const applied = applyGuidedProjectEvent(root, changes, message, { lastAction: `${input.eventType}${input.chapter ? ` chapter ${input.chapter}` : ""}` });
  return { changed: applied.changed, stage: project.current_stage, projectHash: projectStateHash(root), gitMessage: applied.git.message, advisories };
}

export function applyNovelEvent(root: string, input: NovelEventInput): NovelEventResult {
  let currentStage = String(input.expectedStage || "unknown");
  let currentProjectHash = String(input.expectedProjectHash || "unknown");
  try {
    const current = readProject(root);
    currentStage = current.current_stage;
    currentProjectHash = projectStateHash(root);
  } catch {
    // The normalizer will classify project-read failures without exposing paths.
  }
  try {
    return applyNovelEventInternal(root, input);
  } catch (error) {
    throw normalizeEventRejection(error, { root, currentStage, currentProjectHash });
  }
}
