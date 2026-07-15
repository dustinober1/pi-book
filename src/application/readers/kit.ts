import { basename, join, relative, resolve } from "node:path";
import { PlotGridSchema, type PlotGridState } from "../../domain/schemas.js";
import type { ReaderExperimentFile } from "../../domain/v1-2-schemas.js";
import { listChapterFiles, readText } from "../../infrastructure/files.js";
import { parseYaml } from "../../infrastructure/yaml.js";
import { readBook } from "../../project/store.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import { experimentYaml, indexYaml, nextReaderExperimentId, readReaderIndex, readerCsvHeaders, readerExperimentDirectory, sourceHash } from "./store.js";
import type { ReaderKitPreview, ReaderKitProposal } from "./types.js";

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function words(text: string): string[] { return text.trim().split(/\s+/).filter(Boolean); }
function firstPage(text: string): string { const list = words(text); return list.length <= 900 ? text.trim() : list.slice(0, 900).join(" "); }

function selectedChapterPaths(root: string, bookId: string, proposal: ReaderKitProposal): string[] {
  const files = listChapterFiles(join(root, "books", bookId));
  if (!files.length) throw new Error("A manuscript chapter is required before preparing a reader kit.");
  if (proposal.scope === "first-page" || proposal.scope === "first-chapter") return [files[0]!];
  if (proposal.scope === "manuscript") return files;
  if (proposal.scope === "selected-chapters") {
    const requested = new Set(proposal.chapterNumbers ?? []);
    if (!requested.size) throw new Error("Selected-chapters reader kits require chapter numbers.");
    const paths = files.filter((path) => { const number = chapterNumber(path); return number !== null && requested.has(number); });
    if (paths.length !== requested.size) throw new Error("One or more selected chapter numbers do not exist.");
    return paths;
  }
  if (proposal.scope === "act") {
    if (!proposal.actId) throw new Error("Act reader kits require an act ID.");
    const plotPath = join(root, "books", bookId, "plot-grid.yaml");
    const text = readText(plotPath);
    if (!text) throw new Error("plot-grid.yaml is required for an act reader kit.");
    const plot = parseYaml<PlotGridState>(text, PlotGridSchema, "plot-grid.yaml");
    const act = plot.acts.find((item) => item.id === proposal.actId);
    if (!act) throw new Error(`Unknown act ID: ${proposal.actId}`);
    return files.filter((path) => { const number = chapterNumber(path); return number !== null && number >= act.start_chapter && number <= act.end_chapter; });
  }
  return [];
}

export function previewReaderKit(root: string, proposal: ReaderKitProposal): ReaderKitPreview {
  if (!proposal.targetReader.trim()) throw new Error("A specific target-reader segment is required.");
  if (!Number.isInteger(proposal.minimumImmediateCount) || proposal.minimumImmediateCount < 1 || proposal.minimumImmediateCount > 1000) throw new Error("minimumImmediateCount must be from 1 to 1000.");
  if (!Number.isInteger(proposal.minimumDelayedCount) || proposal.minimumDelayedCount < 1 || proposal.minimumDelayedCount > 1000) throw new Error("minimumDelayedCount must be from 1 to 1000.");
  if (!Number.isInteger(proposal.delayedAfterHours) || proposal.delayedAfterHours < 24 || proposal.delayedAfterHours > 168) throw new Error("delayedAfterHours must be from 24 to 168.");
  const book = readBook(root);
  let sourcePaths: string[];
  let sample: string;
  if (proposal.scope === "excerpt") {
    if (!proposal.excerptPath) throw new Error("Excerpt reader kits require an authorized excerpt path.");
    const absolute = resolve(root, proposal.excerptPath);
    const rel = relative(root, absolute);
    if (rel.startsWith("..") || rel === "") throw new Error("Excerpt path must be an existing file inside the project.");
    const text = readText(absolute);
    if (text === null) throw new Error(`Excerpt does not exist: ${proposal.excerptPath}`);
    sourcePaths = [rel.replace(/\\/g, "/")];
    sample = text.trim();
  } else {
    const paths = selectedChapterPaths(root, book.book_id, proposal);
    sourcePaths = paths.map((path) => relative(root, path).replace(/\\/g, "/"));
    const texts = paths.map((path) => readText(path) ?? "");
    sample = proposal.scope === "first-page" ? firstPage(texts[0] ?? "") : texts.map((text, index) => `# Reader Sample ${index + 1}\n\n${text.trim()}`).join("\n\n---\n\n");
  }
  return { proposal, sourcePaths, sample, wordCount: words(sample).length, sampleHash: sourceHash(sample), warnings: [] };
}

function immediateQuestions(id: string, version: string, proposal: ReaderKitProposal): string {
  return `# Immediate Reader Questions\n\nExperiment: ${id}\nQuestionnaire: ${version}\nTarget segment: ${proposal.targetReader}\n\nUse immediately after reading. Do not coach the reader.\n\n1. Did you want to continue reading? Why or why not?\n2. Would you buy or request the rest of the book?\n3. Where were you confused?\n4. Where did trust break?\n5. Which lines or choices worked especially well?\n`;
}
function delayedQuestions(id: string, version: string, proposal: ReaderKitProposal): string {
  return `# Delayed Reader Questions\n\nExperiment: ${id}\nQuestionnaire: ${version}\nAsk after ${proposal.delayedAfterHours} hours without reopening the sample.\n\n1. What hook or central problem do you remember?\n2. Which scenes or choices remain?\n3. How would you describe the book to a friend?\n4. What might thoughtful readers disagree about?\n5. What question remains alive?\n6. Who would you recommend it to, and why?\n7. Did you independently tell anyone about it?\n`;
}

export function createReaderKit(root: string, proposal: ReaderKitProposal) {
  const preview = previewReaderKit(root, proposal);
  const book = readBook(root);
  const index = readReaderIndex(root, book.book_id);
  const id = nextReaderExperimentId(index);
  const base = readerExperimentDirectory(book.book_id, id);
  const now = new Date().toISOString();
  const version = proposal.questionnaireVersion?.trim() || "1.0.0";
  const experiment: ReaderExperimentFile = {
    schema_version: "1.0.0", id, status: "planned", scope: proposal.scope, variant: proposal.variant?.trim() ?? "", blind: proposal.blind ?? Boolean(proposal.variant?.trim()), target_reader: proposal.targetReader.trim(),
    sample_path: `${base}/sample.md`, sample_hash: preview.sampleHash, questionnaire_version: version,
    minimum_immediate_count: proposal.minimumImmediateCount, minimum_delayed_count: proposal.minimumDelayedCount, delayed_after_hours: proposal.delayedAfterHours,
    immediate_responses: [], delayed_responses: [], excluded_response_keys: [],
    metrics: { continuation_rate: null, purchase_intent_rate: null, delayed_hook_recall_rate: null, signature_moment_recall_rate: null, specific_recommendation_rate: null, talkability_rate: null },
    verdict: "blocked", limitations: [], supported_claims: [], prohibited_claims: ["Do not claim validation before matching human immediate and delayed responses meet the declared minimums."],
    next_action: `Recruit at least ${proposal.minimumImmediateCount} ${proposal.targetReader.trim()} readers and record immediate responses.`, created_at: now, updated_at: now,
  };
  const yaml = experimentYaml(experiment);
  index.experiments.push({ id, path: `${base}/experiment.yaml`, status: experiment.status, source_hash: sourceHash(yaml) });
  const event = applyGuidedProjectEvent(root, [
    { path: `${base}/experiment.yaml`, content: yaml },
    { path: `${base}/sample.md`, content: `${preview.sample.trim()}\n` },
    { path: `${base}/immediate-questions.md`, content: immediateQuestions(id, version, proposal) },
    { path: `${base}/delayed-questions.md`, content: delayedQuestions(id, version, proposal) },
    { path: `${base}/responses.csv`, content: `${readerCsvHeaders.join(",")}\n` },
    { path: `${base}/summary.md`, content: `# Reader Experiment ${id}\n\nStatus: planned\n\nSource sample hash: ${preview.sampleHash}\n` },
    { path: `books/${book.book_id}/reader-kits/index.yaml`, content: indexYaml(index) },
  ], `Novel Forge: create reader experiment ${id}`, { lastAction: `Created reader experiment ${id}` });
  return { experimentId: id, preview, changed: event.changed };
}
