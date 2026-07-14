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

export interface ProjectStatus { blockers: string[]; warnings: string[]; nextAction: string; markdown: string }

function nextActionForStage(stage: string): string {
  const actions: Record<string, string> = {
    "voice-intake": "Run /novel-plan voice, then approve voice-approval.",
    "series-planning": "Run /novel-plan series.",
    "book-planning": "Run /novel-plan book, then approve book-plan-approval.",
    "chapter-queue": "Run /novel-run to build the next chapter window.",
    drafting: "Run /novel-draft or /novel-run. Use /novel-readers when an opening or sample is ready for evidence.",
    "act-review": "Run /novel-review act or /novel-readers act.",
    revision: "Run /novel-revise.",
    "manuscript-review": "Run /novel-review manuscript and /novel-readers manuscript.",
    "canon-lock": "Run /novel-run to lock accepted book facts into series canon.",
    packaging: "Run /novel-package.",
    complete: "Project is complete; add another book through /novel-plan --add-book when needed.",
  };
  return actions[stage] ?? "Inspect PROJECT.yaml for an unsupported stage.";
}

export function getProjectStatus(root: string): ProjectStatus {
  const project = readProject(root);
  const book = readBook(root);
  const tickets = readTickets(root);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const gate = project.next_gate ? project.gates[project.next_gate] : undefined;

  if (project.next_gate && gate === "pending") blockers.push(`Human approval required: ${project.next_gate}`);
  if (project.next_gate && gate === "rejected") blockers.push(`Gate rejected and requires repair: ${project.next_gate}`);
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

  for (const finding of collectProjectIntegrityFindings(root)) (finding.severity === "blocker" ? blockers : warnings).push(finding.message);

  const git = gitState(root);
  if (!git.initialized) warnings.push("Git is not initialized; workflow checkpoints are unavailable.");
  else if (git.dirty) warnings.push(`${git.dirty} uncommitted file(s) exist.`);

  const words = manuscriptWordCount(root, book.book_id);
  const nextAction = blockers.length ? "Resolve the first blocker before automation continues." : nextActionForStage(project.current_stage);
  const recent = newestFiles(root, 6);
  const markdown = [
    "# Novel Forge Status",
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
    `- Next action: ${nextAction}`,
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
  return { blockers, warnings, nextAction, markdown };
}

export function refreshStatus(root: string): ProjectStatus {
  const status = getProjectStatus(root);
  writeFileSync(join(root, "STATUS.md"), status.markdown, "utf8");
  return status;
}
