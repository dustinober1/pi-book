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
  type ProjectState,
  type ReaderExperimentsState,
  type RemarkabilityState,
  type Stage,
  type StoryThreadsState,
} from "../domain/schemas.js";
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
import { normalizeEventRejection } from "./event-rejection.js";
import { readerExperimentFindings, remarkabilityFindings } from "./reader-impact.js";
import { readerFrictionFindings } from "./review-observations.js";
import { researchEvidenceFindings } from "./research-evidence.js";
import { compactPacketWindow, packetWindowDecision, packetWindowFindings } from "./packet-window.js";

export { projectStateHash } from "./project-hash.js";

export type NovelEventType = "voice-profile" | "series-plan" | "book-plan" | "chapter-queue" | "draft-chapter" | "review" | "reader-test" | "research-update" | "intake-update" | "premise-update" | "revise" | "canon-lock" | "package";
export interface NovelEventInput { eventType: NovelEventType; expectedStage: Stage; expectedProjectHash: string; files: FileChange[]; chapter?: number; scope?: string }
export interface NovelEventResult { changed: string[]; stage: Stage; projectHash: string; gitMessage: string }

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
  revise: ["revision"],
  "canon-lock": ["canon-lock"],
  package: ["packaging"],
};

function normalized(path: string): string { return path.replace(/\\/g, "/").replace(/^\.\//, ""); }

function allowedPath(event: NovelEventType, path: string, bookId: string, chapter?: number): boolean {
  const book = `books/${bookId}`;
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

function validateFiles(root: string, input: NovelEventInput, project: ProjectState, book: BookState): void {
  if (!eventStages[input.eventType].includes(project.current_stage)) throw new Error(`${input.eventType} is not allowed during ${project.current_stage}.`);
  if (input.expectedStage !== project.current_stage) throw new Error(`Stale event stage: expected ${input.expectedStage}, current ${project.current_stage}.`);
  if (input.expectedProjectHash !== projectStateHash(root)) throw new Error("Stale project hash; reload state before applying this event.");
  if (input.eventType === "research-update" && input.files.length === 0) throw new Error("research-update requires at least one evidence file.");
  if (input.eventType === "intake-update" && input.files.length === 0) throw new Error("intake-update requires at least one intake evidence file.");
  if (input.eventType === "premise-update" && input.files.length === 0) throw new Error("premise-update requires at least one premise evidence file.");
  const seen = new Set<string>();
  for (const file of input.files) {
    file.path = normalized(file.path);
    if (seen.has(file.path)) throw new Error(`Duplicate event path: ${file.path}`);
    seen.add(file.path);
    if (!allowedPath(input.eventType, file.path, book.book_id, input.chapter)) throw new Error(`${file.path} is not allowed for ${input.eventType}.`);
  }
  const required: Partial<Record<NovelEventType, RegExp>> = {
    "voice-profile": /series\/voice-profile\.md$/,
    "series-plan": /series\/(series-bible\.md|series-arc\.yaml)$/,
    "book-plan": /remarkability\.yaml$/,
    "chapter-queue": /chapter-queue\.yaml$/,
    "draft-chapter": /manuscript\/chapters\/.*\.md$/,
    review: /review-report\.md$|revision-tickets\.yaml$/,
    "reader-test": /reader-experiments\.yaml$/,
    "canon-lock": /series\/canon\.yaml$/,
    package: /package\.md$/,
  };
  const pattern = required[input.eventType];
  if (pattern && !input.files.some((file) => pattern.test(file.path))) throw new Error(`${input.eventType} event is missing its required output file.`);
  if (input.eventType === "voice-profile") {
    const missing = missingRequiredPaths(input.files, [
      "series/voice-profile.md",
      "series/taste-profile.yaml",
      "series/voice-guardrails.yaml",
      "series/voice-experiments/index.yaml",
    ]);
    if (missing.length) throw new Error(`voice-profile event is missing required output: ${missing.join(", ")}`);
  }
  if (input.eventType === "series-plan") {
    const missing = missingRequiredPaths(input.files, [
      "series/series-bible.md",
      "series/series-arc.yaml",
      "series/canon.yaml",
      "series/story-threads.yaml",
    ]);
    if (missing.length) throw new Error(`series-plan event is missing required output: ${missing.join(", ")}`);
  }
  if (input.eventType === "book-plan") {
    const requiredBookPlan = [
      `books/${book.book_id}/book-bible.md`,
      `books/${book.book_id}/plot-grid.yaml`,
      `books/${book.book_id}/remarkability.yaml`,
      `books/${book.book_id}/research-ledger.yaml`,
      `books/${book.book_id}/book-strategy.yaml`,
    ];
    const missing = missingRequiredPaths(input.files, requiredBookPlan);
    if (missing.length) throw new Error(`book-plan event is missing required output: ${missing.join(", ")}`);
    const remarkability = parseOverlay<RemarkabilityState>(root, input.files, `books/${book.book_id}/remarkability.yaml`, RemarkabilitySchema);
    const blockers = remarkabilityFindings(remarkability).filter((finding) => finding.severity === "blocker");
    if (blockers.length) throw new Error(`Remarkability validation blocked book-plan:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  if (input.eventType === "reader-test") {
    const experiments = parseOverlay<ReaderExperimentsState>(root, input.files, `books/${book.book_id}/reader-experiments.yaml`, ReaderExperimentsSchema);
    const blockers = readerExperimentFindings(experiments).filter((finding) => finding.severity === "blocker");
    if (blockers.length) throw new Error(`Reader-evidence validation blocked reader-test:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  if (input.eventType === "book-plan" || input.eventType === "research-update") {
    validateResearchAndFriction(root, input.files, book, input.eventType);
    validateRevisionLearning(root, input.files, book);
  }
  if (input.eventType === "premise-update" || (input.eventType === "book-plan" && overlay(root, input.files, `books/${book.book_id}/premise-lab.yaml`))) {
    const lab = parseOverlay<PremiseLab>(root, input.files, `books/${book.book_id}/premise-lab.yaml`, PremiseLabSchema);
    const ledger = parseOverlay<DecisionLedger>(root, input.files, "series/decision-ledger.yaml", DecisionLedgerSchema);
    const blockers = premiseLabFindings(lab, ledger).filter((finding) => finding.severity === "blocker");
    if (input.eventType === "book-plan" && lab.variants.length > 0 && (!lab.selected_variant_id || !lab.selection_decision_id)) {
      blockers.push({ severity: "blocker", code: "unselected-premise", message: "A rebuilt book plan requires an explicitly selected premise variant." });
    }
    if (blockers.length) throw new Error(`Premise validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  if (input.eventType === "intake-update") {
    const intake = parseOverlay<IntakeState>(root, input.files, "series/intake.yaml", IntakeSchema);
    const ledger = parseOverlay<DecisionLedger>(root, input.files, "series/decision-ledger.yaml", DecisionLedgerSchema);
    const blockers = intakeDecisionFindings(intake, ledger).filter((finding) => finding.severity === "blocker");
    if (blockers.length) throw new Error(`Intake and decision ledger validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
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

function validateArchitecture(root: string, files: FileChange[], book: BookState, event: NovelEventType, chapter?: number): { queue: ChapterQueueState; plot: PlotGridPhase4 } {
  const bookRoot = `books/${book.book_id}`;
  const profile = getProfile(book.profile);
  const genre = parseOverlay<GenreConfig>(root, files, `${bookRoot}/genre.yaml`, GenreConfigSchema);
  const plot = parseOverlay<PlotGridPhase4>(root, files, `${bookRoot}/plot-grid.yaml`, PlotGridPhase4Schema);
  const queue = parseOverlay<ChapterQueueState>(root, files, `${bookRoot}/chapter-queue.yaml`, ChapterQueueSchema);
  const findings = [...profile.validateGenreConfig(genre), ...(event === "book-plan" || event === "chapter-queue" ? profile.validatePlot(plot) : [])];
  const packets = chapter ? queue.packets.filter((packet) => packet.chapter === chapter) : event === "book-plan" || event === "chapter-queue" ? queue.packets.filter((packet) => packet.status === "ready") : [];
  for (const packet of packets) findings.push(...profile.validatePacket(packet));
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Profile validation blocked ${event}:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);

  if (packets.length) {
    const canon = parseOverlay<CanonState>(root, files, "series/canon.yaml", CanonSchema);
    const threads = parseOverlay<StoryThreadsState>(root, files, "series/story-threads.yaml", StoryThreadsSchema);
    const sources = parseOverlay<SourceRegisterV13>(root, files, "research/source-register.yaml", SourceRegisterV13Schema);
    const research = parseOverlay<ResearchLedger>(root, files, `${bookRoot}/research-ledger.yaml`, ResearchLedgerSchema);
    const referenceBlockers = packets.flatMap((packet) => packetReferenceFindings(packet, canon, threads, sources, plot, research)).filter((finding) => finding.severity === "blocker");
    if (referenceBlockers.length) throw new Error(`Reference validation blocked ${event}:\n${referenceBlockers.map((item) => `- ${item.message}`).join("\n")}`);
  }

  if (event === "book-plan" || event === "chapter-queue") {
    const drafted = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
    const windowBlockers = packetWindowFindings(queue, plot, drafted).filter((finding) => finding.severity === "blocker");
    if (windowBlockers.length) throw new Error(`Packet-window validation blocked ${event}:\n${windowBlockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  if (event === "book-plan") {
    const strategy = parseOverlay<BookStrategyPhase5>(root, files, `${bookRoot}/book-strategy.yaml`, BookStrategyPhase5Schema);
    const planBlockers = bookPlanFindings({ strategy, plot, queue }).filter((finding) => finding.severity === "blocker");
    if (planBlockers.length) throw new Error(`Book strategy validation blocked book-plan:\n${planBlockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  return { queue, plot };
}

function applyNovelEventInternal(root: string, input: NovelEventInput): NovelEventResult {
  const project = structuredClone(readProject(root));
  const book = structuredClone(readBook(root));
  validateFiles(root, input, project, book);
  const changes = input.files.map((file) => ({ path: normalized(file.path), content: file.content }));
  let queue: ChapterQueueState | null = null;
  let plot: PlotGridPhase4 | null = null;
  if (["book-plan", "chapter-queue", "draft-chapter"].includes(input.eventType)) ({ queue, plot } = validateArchitecture(root, changes, book, input.eventType, input.chapter));

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
      } else if (packet.milestone_gate) {
        if (!(packet.milestone_gate in project.gates)) throw new Error(`Unknown milestone gate: ${packet.milestone_gate}`);
        project.gates[packet.milestone_gate] = "pending";
        project.next_gate = packet.milestone_gate;
        project.current_stage = "act-review";
        book.act_checkpoint = packet.milestone_gate;
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

  if (input.eventType !== "research-update" && input.eventType !== "intake-update" && input.eventType !== "premise-update") {
    setChange(changes, "PROJECT.yaml", stringifyYaml(project));
    setChange(changes, `books/${book.book_id}/BOOK.yaml`, stringifyYaml(book));
  }
  const message = `Novel Forge: ${input.eventType}${input.chapter ? ` chapter-${input.chapter}` : ""}`;
  const applied = applyGuidedProjectEvent(root, changes, message, { lastAction: `${input.eventType}${input.chapter ? ` chapter ${input.chapter}` : ""}` });
  return { changed: applied.changed, stage: project.current_stage, projectHash: projectStateHash(root), gitMessage: applied.git.message };
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
