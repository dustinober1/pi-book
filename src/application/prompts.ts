import { basename, join } from "node:path";
import type { ChapterContext } from "../context/context-builder.js";
import { RUNTIME_PROFILES, type RuntimeProfile, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { ChapterQueueSchema, type ChapterQueueState, type RevisionTicket } from "../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { DecisionLedgerSchema, IntakeSchema, PremiseLabSchema, type DecisionLedger, type IntakeState, type PremiseLab } from "../domain/v1-4-schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { regressionChecklist } from "../review/review.js";
import { packetWindowDecision } from "./packet-window.js";
import { selectedPremiseContext } from "./premise-lab.js";
import { intakePromptContext } from "./intake.js";
import { projectStateHash } from "./events.js";
import { compilePrompt } from "./prompt-compiler.js";
import { preparePrompt } from "./prepared-prompt.js";
import { loadProseLintInput, renderReviewLintEvidence, runProseLint } from "./prose-lint/index.js";
import { resolveRuntimeProfile } from "./runtime-profile-resolver.js";
import { sceneExecutionDraftStageSpec } from "./stage-specs/draft-execution.js";
import {
  automationDraftStageSpec,
  bookPlanStageSpec,
  canonLockStageSpec,
  packageStageSpec,
  premisePlanStageSpec,
  queueStageSpec,
  readerTestStageSpec,
  reviewStageSpec,
  revisionStageSpec,
  seriesPlanStageSpec,
  voicePlanStageSpec,
} from "./stage-specs/index.js";
import type { StageSpec } from "./stage-specs/types.js";

function planningIntakeContext(root: string): string {
  const intakeText = readText(join(root, "series", "intake.yaml"));
  const ledgerText = readText(join(root, "series", "decision-ledger.yaml"));
  const intake = intakeText ? parseYaml<IntakeState>(intakeText, IntakeSchema, "intake.yaml") : null;
  const ledger = ledgerText ? parseYaml<DecisionLedger>(ledgerText, DecisionLedgerSchema, "decision-ledger.yaml") : null;
  return intakePromptContext(intake, ledger);
}

function activePremiseLab(root: string): PremiseLab | null {
  const book = readBook(root);
  const text = readText(join(root, "books", book.book_id, "premise-lab.yaml"));
  return text ? parseYaml<PremiseLab>(text, PremiseLabSchema, `books/${book.book_id}/premise-lab.yaml`) : null;
}

function runtimeForPrompt(root: string, explicit?: RuntimeProfile): RuntimeProfile {
  if (explicit) return explicit;
  const project = readProject(root) as { runtime?: { profile?: RuntimeProfileId } };
  return resolveRuntimeProfile({ project: project.runtime?.profile });
}

function renderPrompt(root: string, spec: StageSpec, explicit?: RuntimeProfile): string {
  return compilePrompt(spec, runtimeForPrompt(root, explicit)).text;
}

function reviewLintEvidence(root: string, scope: string, maxCharacters: number): string {
  const normalizedScope = scope.trim().toLocaleLowerCase("en-US");
  if (normalizedScope !== "act" && !normalizedScope.startsWith("act-") && normalizedScope !== "manuscript") return "";
  try {
    const result = runProseLint(loadProseLintInput(root, { scope }));
    return renderReviewLintEvidence(result, { maxCharacters });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.replace(/\s+/g, " ").trim().replace(/[.]+$/u, "").slice(0, 240) || "unknown error";
    return `Deterministic prose lint unavailable: ${message}. Continue normal manuscript and structured-integrity review; do not imply that the lint passed.`;
  }
}

export function premisePlanPrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const lab = activePremiseLab(root);
  const rawIdea = lab?.raw_idea.trim() || planningIntakeContext(root).match(/Original author idea:\n([^\n]+)/)?.[1] || "";
  const seedElements = lab?.seed_elements ?? [];
  return renderPrompt(root, premisePlanStageSpec({
    root,
    bookId: book.book_id,
    rawIdea,
    seedElements,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function voicePlanPrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  return renderPrompt(root, voicePlanStageSpec({
    root,
    intakeContext: planningIntakeContext(root),
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function seriesPlanPrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const project = readProject(root);
  const profile = getProfile(project.default_profile);
  return renderPrompt(root, seriesPlanStageSpec({
    root,
    planningQuestions: profile.planningQuestions,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function bookPlanPrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return renderPrompt(root, bookPlanStageSpec({
    root,
    bookId: book.book_id,
    intakeContext: planningIntakeContext(root),
    premiseContext: selectedPremiseContext(activePremiseLab(root)),
    planningQuestions: profile.planningQuestions,
    profileRules: profile.bookPlanRules,
    profileOutputs: profile.bookPlanOutputs,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function queuePrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  const bookRoot = join(root, "books", book.book_id);
  const queue = parseYaml<ChapterQueueState>(readText(join(bookRoot, "chapter-queue.yaml")) ?? "", ChapterQueueSchema, "chapter-queue.yaml");
  const plot = parseYaml<PlotGridPhase4>(readText(join(bookRoot, "plot-grid.yaml")) ?? "", PlotGridPhase4Schema, "plot-grid.yaml");
  const drafted = new Set(listChapterFiles(bookRoot).map((path) => Number.parseInt(basename(path).match(/^0*(\d+)/)?.[1] ?? "", 10)).filter(Number.isInteger));
  const window = packetWindowDecision(queue, plot, drafted);
  const preserve = window.queue.packets.map((packet) => packet.chapter).sort((left, right) => left - right);
  const refillInstruction = window.needsRefill
    ? `Create packets only for chapters ${window.candidateChapters.join(", ")}. Preserve the existing active packet${preserve.length === 1 ? "" : "s"} for chapter${preserve.length === 1 ? "" : "s"} ${preserve.join(", ")}. Return one complete replacement chapter-queue.yaml containing the preserved active packets plus the new packets.`
    : `No refill is required because ${window.readyCount} ready packets remain. Preserve the active window and do not regenerate packets.`;
  return renderPrompt(root, queueStageSpec({
    root,
    bookId: book.book_id,
    refillInstruction,
    profileLabel: profile.label,
    packetRequirements: profile.chapterPacketRequirements,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function draftPrompt(context: ChapterContext, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(context.root);
  const runtime = runtimeForPrompt(context.root, runtimeProfile);
  const spec = sceneExecutionDraftStageSpec({
    root: context.root,
    bookId: book.book_id,
    chapter: context.packet.chapter,
    estimatedTokens: context.report.estimatedTokens,
    excluded: context.report.excluded,
    projectHash: projectStateHash(context.root),
  });
  return preparePrompt(spec, context.text, runtime).text;
}

export function automationDraftPrompt(root: string, maxChapters: number, until?: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return renderPrompt(root, automationDraftStageSpec({
    root,
    bookId: book.book_id,
    maxChapters: Math.max(1, Math.min(maxChapters, 10)),
    until: until ?? "the next milestone gate",
    draftingRules: profile.draftingRules,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function reviewPrompt(root: string, scope: string, runtimeProfile?: RuntimeProfile): string {
  const runtime = runtimeForPrompt(root, runtimeProfile);
  const book = readBook(root);
  const profile = getProfile(book.profile);
  const stage = readProject(root).current_stage;
  const lintCap = runtime.id === "full" ? 5_000 : runtime.id === "local" ? 1_400 : 700;
  return compilePrompt(reviewStageSpec({
    root,
    bookId: book.book_id,
    scope,
    expectedStage: stage,
    lintEvidence: reviewLintEvidence(root, scope, Math.min(lintCap, runtime.maxPromptChars)),
    reviewLanes: profile.milestoneReviewLanes,
    projectHash: projectStateHash(root),
  }), runtime).text;
}

export function readerTestPrompt(root: string, scope: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const project = readProject(root);
  const path = join(root, "books", book.book_id, "reader-experiments.yaml");
  const existingArtifact = readText(path) ?? 'schema_version: "1.0.0"\nexperiments: []\n';
  return renderPrompt(root, readerTestStageSpec({
    root,
    bookId: book.book_id,
    scope,
    expectedStage: project.current_stage,
    existingArtifact,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function revisionPrompt(root: string, tickets: RevisionTicket[], runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const ticketDetails = tickets.map((ticket) => [
    `${ticket.id}: ${ticket.problem}`,
    `Required change: ${ticket.required_change}`,
    `Protected: ${ticket.protected_constraints.join("; ") || "none"}`,
    `Acceptance and regression: ${regressionChecklist(ticket).join(" | ")}`,
  ].join("\n"));
  return renderPrompt(root, revisionStageSpec({
    root,
    bookId: book.book_id,
    ticketDetails,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function canonLockPrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  return renderPrompt(root, canonLockStageSpec({
    root,
    bookId: book.book_id,
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}

export function packagePrompt(root: string, runtimeProfile?: RuntimeProfile): string {
  const book = readBook(root);
  const path = join(root, "books", book.book_id, "package.md");
  return renderPrompt(root, packageStageSpec({
    root,
    bookId: book.book_id,
    existingPackage: readText(path) ?? "",
    projectHash: projectStateHash(root),
  }), runtimeProfile);
}
