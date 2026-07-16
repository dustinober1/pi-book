import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ContinuityDeltaSchema, GenreConfigSchema, PlotGridSchema, ReaderExperimentsSchema, RemarkabilitySchema, type ContinuityDeltaState, type GenreConfig, type PlotGridState, type ReaderExperimentsState, type RemarkabilityState } from "../domain/schemas.js";
import { newestFiles, readText } from "../infrastructure/files.js";
import { gitState } from "../infrastructure/git.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { manuscriptWordCount } from "../context/context-builder.js";
import { openBlockingTickets } from "../review/review.js";
import { readBook, readProject, readTickets } from "../project/store.js";
import { collectProjectIntegrityFindings } from "./integrity.js";
import { readerExperimentFindings, remarkabilityFindings } from "./reader-impact.js";
import { getProfile } from "../profiles/index.js";
import { gateDetail } from "./gate-metadata.js";
import { versionFindings } from "./version-core.js";

export interface ProjectStatus {
  blockers: string[];
  warnings: string[];
  nextAction: string;
  headline: string;
  reason: string;
  recommendedCommand: string;
  primaryBlocker: string | null;
  markdown: string;
}

export interface ProjectStatusOptions {
  gitDirtyOverride?: number;
}

function nextActionForStage(stage: string): string {
  const actions: Record<string, string> = {
    "voice-intake": "Build the voice profile from the writer's evidence.",
    "series-planning": "Define the series promise, escalation, cast pressure, and carry rules.",
    "book-planning": "Build the active book plan and remarkability contract.",
    "chapter-queue": "Prepare the next bounded window of chapter packets.",
    drafting: "Draft the next ready chapter packet.",
    "act-review": "Run the required act-level review.",
    revision: "Resolve the highest-priority open revision tickets.",
    "manuscript-review": "Run manuscript review and gather any required reader evidence.",
    "canon-lock": "Lock only manuscript-evidenced facts into series canon.",
    packaging: "Compile the manuscript and complete the editorial package checklist.",
    complete: "Add the next book when the series is ready to continue.",
  };
  return actions[stage] ?? "Inspect PROJECT.yaml for an unsupported stage.";
}

function decisionText(project: ReturnType<typeof readProject>, blockers: string[]): { headline: string; reason: string; nextAction: string; command: string } {
  const activeGate = project.next_gate;
  const gateState = activeGate ? project.gates[activeGate] : undefined;
  if (activeGate && gateState === "pending") {
    const title = gateDetail(activeGate).title;
    return {
      headline: `${title} is ready for your decision.`,
      reason: `Novel Forge stopped because ${title.toLowerCase()} requires an explicit writer approval before creative work can continue.`,
      nextAction: `Review the ${title.toLowerCase()} evidence and approve it or request changes.`,
      command: "/novel",
    };
  }
  if (activeGate && gateState === "rejected") {
    const detail = gateDetail(activeGate);
    return {
      headline: `${detail.title} needs repair.`,
      reason: `The active writer decision rejected the current ${detail.title.toLowerCase()} evidence.`,
      nextAction: detail.repairLabel,
      command: "/novel",
    };
  }
  if (blockers.length) {
    return {
      headline: "Novel Forge needs one issue resolved before it can continue.",
      reason: blockers[0] ?? "A blocking integrity issue exists.",
      nextAction: "Open the guided workflow for an explanation and exact recovery action.",
      command: "/novel",
    };
  }
  return {
    headline: `Novel Forge is ready to continue ${project.current_stage.replace(/-/g, " ")}.`,
    reason: "No human gate or integrity blocker is stopping the recommended next step.",
    nextAction: nextActionForStage(project.current_stage),
    command: "/novel",
  };
}

function optionalV13ArtifactPaths(bookId: string): string[] {
  return [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    `books/${bookId}/research-ledger.yaml`,
    `books/${bookId}/book-strategy.yaml`,
    `books/${bookId}/voice-audits.yaml`,
  ];
}

export function getProjectStatus(root: string, options: ProjectStatusOptions = {}): ProjectStatus {
  const project = readProject(root);
  const book = readBook(root);
  const tickets = readTickets(root);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const gate = project.next_gate ? project.gates[project.next_gate] : undefined;

  if (project.next_gate && gate === "pending") blockers.push(`Human approval required: ${gateDetail(project.next_gate).title}`);
  if (project.next_gate && gate === "rejected") blockers.push(`Writer-requested repair required: ${gateDetail(project.next_gate).title}`);
  for (const ticket of openBlockingTickets(tickets)) blockers.push(`${ticket.id}: ${ticket.problem}`);

  const bookRoot = join(root, "books", book.book_id);
  const deltaText = readText(join(bookRoot, "continuity-delta.yaml"));
  if (deltaText) {
    const delta = parseYaml<ContinuityDeltaState>(deltaText, ContinuityDeltaSchema, "continuity-delta.yaml");
    for (const conflict of delta.conflicts.filter((item) => item.status === "open")) blockers.push(`Continuity conflict ${conflict.id}: ${conflict.description}`);
  }

  const required = [
    "series/series-bible.md",
    "series/voice-profile.md",
    "series/series-arc.yaml",
    "series/canon.yaml",
    "series/story-threads.yaml",
    `books/${book.book_id}/book-bible.md`,
    `books/${book.book_id}/genre.yaml`,
    `books/${book.book_id}/plot-grid.yaml`,
    `books/${book.book_id}/chapter-queue.yaml`,
    `books/${book.book_id}/remarkability.yaml`,
    `books/${book.book_id}/reader-experiments.yaml`,
    `books/${book.book_id}/revision-tickets.yaml`,
  ];
  for (const path of required) if (!existsSync(join(root, path))) blockers.push(`Missing required control file: ${path}`);

  const missingOptionalV13 = optionalV13ArtifactPaths(book.book_id).filter((path) => !existsSync(join(root, path)));
  if (missingOptionalV13.length) {
    warnings.push(`Optional Novel Forge 1.3 research setup is incomplete: ${missingOptionalV13.join(", ")}. Existing approvals and manuscript prose remain valid; backfill these files through the guided research workflow when available.`);
  }

  const missingOptionalV14 = ["series/intake.yaml", "series/decision-ledger.yaml"].filter((path) => !existsSync(join(root, path)));
  if (missingOptionalV14.length) {
    warnings.push(`Optional Novel Forge 1.4 intake setup is incomplete: ${missingOptionalV14.join(", ")}. Existing approvals and manuscript prose remain valid; backfill these files only through the explicit intake workflow.`);
  }

  const genrePath = join(bookRoot, "genre.yaml");
  if (existsSync(genrePath)) {
    const genre = parseYaml<GenreConfig>(readText(genrePath) ?? "", GenreConfigSchema, "genre.yaml");
    for (const finding of getProfile(book.profile).validateGenreConfig(genre)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);
  }

  const plotPath = join(bookRoot, "plot-grid.yaml");
  if (existsSync(plotPath) && !["voice-intake", "series-planning", "book-planning"].includes(project.current_stage)) {
    const plot = parseYaml<PlotGridState>(readText(plotPath) ?? "", PlotGridSchema, "plot-grid.yaml");
    for (const finding of getProfile(book.profile).validatePlot(plot)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);
  }

  const remarkabilityPath = join(bookRoot, "remarkability.yaml");
  if (existsSync(remarkabilityPath) && !["voice-intake", "series-planning", "book-planning"].includes(project.current_stage)) {
    const remarkability = parseYaml<RemarkabilityState>(readText(remarkabilityPath) ?? "", RemarkabilitySchema, "remarkability.yaml");
    for (const finding of remarkabilityFindings(remarkability)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);
  }

  const readerExperimentsPath = join(bookRoot, "reader-experiments.yaml");
  if (existsSync(readerExperimentsPath)) {
    const experiments = parseYaml<ReaderExperimentsState>(readText(readerExperimentsPath) ?? "", ReaderExperimentsSchema, "reader-experiments.yaml");
    for (const finding of readerExperimentFindings(experiments)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);
  }

  for (const finding of versionFindings(project)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);
  for (const finding of collectProjectIntegrityFindings(root)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);

  const git = gitState(root);
  const dirty = options.gitDirtyOverride ?? git.dirty;
  if (!git.initialized) warnings.push("Git is not initialized; workflow checkpoints are unavailable.");
  else if (dirty) warnings.push(`${dirty} uncommitted file(s) exist.`);

  const words = manuscriptWordCount(root, book.book_id);
  const decision = decisionText(project, blockers);
  const recent = newestFiles(root, 6);
  const markdown = [
    "# Novel Forge",
    "",
    "## What needs you",
    "",
    decision.headline,
    "",
    "## Recommended action",
    "",
    `${decision.nextAction}`,
    "",
    `Run: \`${decision.command}\``,
    "",
    "## Why this stopped",
    "",
    decision.reason,
    "",
    "## Project snapshot",
    "",
    `- Project: ${project.project_name}`,
    `- Type: ${project.project_type}`,
    `- Profile: ${book.profile}`,
    `- Active book: ${book.book_id}`,
    `- Stage: ${project.current_stage}`,
    `- Next gate: ${project.next_gate ?? "none"}${project.next_gate ? ` (${project.gates[project.next_gate] ?? "unknown"})` : ""}`,
    `- Manuscript words: ${words}`,
    `- Blocking tickets/conflicts: ${blockers.length}`,
    `- Warnings: ${warnings.length}`,
    "",
    "## Blockers",
    "",
    ...(blockers.length ? blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Recent files",
    "",
    ...(recent.length ? recent.map((item) => `- ${item.path}`) : ["- none"]),
    "",
  ].join("\n");
  return {
    blockers,
    warnings,
    nextAction: decision.nextAction,
    headline: decision.headline,
    reason: decision.reason,
    recommendedCommand: decision.command,
    primaryBlocker: blockers[0] ?? null,
    markdown,
  };
}

export function refreshStatus(root: string): ProjectStatus {
  const status = getProjectStatus(root);
  writeFileSync(join(root, "STATUS.md"), status.markdown, "utf8");
  return status;
}
