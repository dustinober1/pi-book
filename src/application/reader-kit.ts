import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { ReaderExperimentsState } from "../domain/schemas.js";
import { ReaderExperimentsSchema } from "../domain/schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { applyNovelEvent, type NovelEventResult } from "./events.js";
import { projectStateHash } from "./project-hash.js";

export type ReaderKitScope = "first-page" | "first-chapter" | "sample" | "act" | "manuscript";

export interface ReaderKitInput {
  scope: ReaderKitScope;
  targetReader: string;
  minimumReaderCount: number;
  delayedAfterHours: number;
  variant?: string;
  samplePath?: string;
}

export interface ReaderKitResult {
  experimentId: string;
  event: NovelEventResult;
}

interface CsvRecord { [key: string]: string }

const csvHeaders = [
  "phase", "reader_id", "source", "segment", "recorded_at", "continued_reading", "would_buy",
  "confusions", "trust_breaks", "lines_that_worked", "remembered_hook", "remembered_moments",
  "friend_description", "disagreement_question", "lingering_question", "recommendation_target",
  "recommendation_reason", "told_someone",
];

function loadExperiments(root: string, bookId: string): ReaderExperimentsState {
  const path = join(root, "books", bookId, "reader-experiments.yaml");
  const text = readText(path) ?? 'schema_version: "1.0.0"\nexperiments: []\n';
  return parseYaml<ReaderExperimentsState>(text, ReaderExperimentsSchema, "reader-experiments.yaml");
}

function nextExperimentId(state: ReaderExperimentsState): string {
  const maximum = state.experiments
    .map((experiment) => experiment.id.match(/^RE-(\d+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .reduce((current, value) => Math.max(current, value), 0);
  return `RE-${String(maximum + 1).padStart(3, "0")}`;
}

function firstChapter(root: string, bookId: string): { path: string; text: string } {
  const chapters = listChapterFiles(join(root, "books", bookId));
  const path = chapters[0];
  if (!path) throw new Error("A manuscript chapter is required before preparing this reader kit.");
  return { path, text: readText(path) ?? "" };
}

function capWords(text: string, maximum: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maximum ? text.trim() : `${words.slice(0, maximum).join(" ")}\n`;
}

function sampleFor(root: string, bookId: string, input: ReaderKitInput): { sourcePath: string; content: string } {
  if (input.scope === "first-page" || input.scope === "first-chapter") {
    const chapter = firstChapter(root, bookId);
    return { sourcePath: chapter.path.slice(root.length + 1).replace(/\\/g, "/"), content: input.scope === "first-page" ? capWords(chapter.text, 900) : chapter.text.trim() };
  }
  if (!input.samplePath) throw new Error(`${input.scope} reader kits require an explicit existing sample path.`);
  const absolute = isAbsolute(input.samplePath) ? input.samplePath : resolve(root, input.samplePath);
  if (!existsSync(absolute)) throw new Error(`Reader sample does not exist: ${input.samplePath}`);
  return { sourcePath: absolute.startsWith(root) ? absolute.slice(root.length + 1).replace(/\\/g, "/") : absolute, content: readFileSync(absolute, "utf8").trim() };
}

function immediateQuestions(): string {
  return `# Immediate Reader Questions

Use this immediately after reading. Do not coach the reader toward the premise.

1. Did you want to continue reading? Why or why not?
2. Would you buy or request the rest of this book?
3. Where were you confused?
4. Where did trust in the story break?
5. Which lines, details, or choices worked especially well?
6. How would you identify your usual reading segment?
`;
}

function delayedQuestions(hours: number): string {
  return `# Delayed Reader Questions

Ask these ${hours} hours later without reopening the sample.

1. What hook or central problem do you remember without prompting?
2. Which scenes, images, arguments, or choices remain?
3. How would you describe the book to a friend?
4. What might thoughtful readers disagree about?
5. What question remains alive?
6. Who would you recommend it to, and for what specific reason?
7. Did you independently tell anyone about it?
`;
}

function responsesCsv(): string { return `${csvHeaders.join(",")}\n`; }

export function prepareReaderKit(root: string, input: ReaderKitInput): ReaderKitResult {
  if (!input.targetReader.trim()) throw new Error("A specific target-reader segment is required.");
  if (!Number.isInteger(input.minimumReaderCount) || input.minimumReaderCount < 1 || input.minimumReaderCount > 1000) throw new Error("minimumReaderCount must be an integer from 1 to 1000.");
  if (!Number.isInteger(input.delayedAfterHours) || input.delayedAfterHours < 24 || input.delayedAfterHours > 168) throw new Error("delayedAfterHours must be an integer from 24 to 168.");
  const project = readProject(root);
  const book = readBook(root);
  const state = loadExperiments(root, book.book_id);
  const experimentId = nextExperimentId(state);
  const sample = sampleFor(root, book.book_id, input);
  const base = `books/${book.book_id}/reader-kit`;
  const samplePath = `${base}/sample.md`;
  state.experiments.push({
    id: experimentId,
    status: "planned",
    scope: input.scope,
    variant: input.variant ?? "",
    blind: Boolean((input.variant ?? "").trim()),
    target_reader: input.targetReader.trim(),
    sample_path: samplePath,
    minimum_reader_count: input.minimumReaderCount,
    immediate_responses: [],
    delayed_after_hours: input.delayedAfterHours,
    delayed_responses: [],
    metrics: {
      continuation_rate: null,
      purchase_intent_rate: null,
      delayed_hook_recall_rate: null,
      signature_moment_recall_rate: null,
      specific_recommendation_rate: null,
      talkability_rate: null,
    },
    verdict: "blocked",
    next_action: `Recruit at least ${input.minimumReaderCount} ${input.targetReader.trim()} readers and record immediate responses. Source sample: ${sample.sourcePath}`,
  });
  const event = applyNovelEvent(root, {
    eventType: "reader-test",
    expectedStage: project.current_stage,
    expectedProjectHash: projectStateHash(root),
    scope: input.scope,
    files: [
      { path: samplePath, content: `${sample.content.trim()}\n` },
      { path: `${base}/immediate-questions.md`, content: immediateQuestions() },
      { path: `${base}/delayed-questions.md`, content: delayedQuestions(input.delayedAfterHours) },
      { path: `${base}/responses.csv`, content: responsesCsv() },
      { path: `books/${book.book_id}/reader-experiments.yaml`, content: stringifyYaml(state) },
    ],
  });
  return { experimentId, event };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); if (row.some((value) => value.length)) rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); if (row.some((value) => value.length)) rows.push(row); }
  return rows;
}

function csvRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  const header = rows.shift();
  if (!header) throw new Error("Reader response CSV is empty.");
  if (header.length !== csvHeaders.length) throw new Error(`Reader response CSV header expected ${csvHeaders.length} columns but received ${header.length}.`);
  for (const required of csvHeaders) if (!header.includes(required)) throw new Error(`Reader response CSV is missing column ${required}.`);
  return rows.map((row, index) => {
    if (row.length !== header.length) throw new Error(`Reader response CSV row ${index + 2} expected ${header.length} columns but received ${row.length}.`);
    return Object.fromEntries(header.map((name, column) => [name, row[column] ?? ""]));
  });
}

function nullableBoolean(value: string, label: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${label} must be a boolean true, false, or blank.`);
}

function list(value: string): string[] { return value.split(";").map((item) => item.trim()).filter(Boolean); }
function nonblank(value: string): boolean { return Boolean(value.trim()); }
function booleanRate(values: boolean[]): number | null { return values.length ? values.filter(Boolean).length / values.length : null; }

function responseFrom(record: CsvRecord) {
  if ((record.source ?? "").trim().toLowerCase() !== "human") throw new Error(`Reader response source must be human; received ${record.source || "blank"}.`);
  const readerId = (record.reader_id ?? "").trim();
  if (!readerId) throw new Error("Every reader response requires reader_id.");
  return {
    reader_id: readerId,
    source: "human" as const,
    segment: (record.segment ?? "").trim(),
    recorded_at: (record.recorded_at ?? "").trim(),
    continued_reading: nullableBoolean(record.continued_reading ?? "", "continued_reading"),
    would_buy: nullableBoolean(record.would_buy ?? "", "would_buy"),
    confusions: list(record.confusions ?? ""),
    trust_breaks: list(record.trust_breaks ?? ""),
    lines_that_worked: list(record.lines_that_worked ?? ""),
    remembered_hook: (record.remembered_hook ?? "").trim(),
    remembered_moments: list(record.remembered_moments ?? ""),
    friend_description: (record.friend_description ?? "").trim(),
    disagreement_question: (record.disagreement_question ?? "").trim(),
    lingering_question: (record.lingering_question ?? "").trim(),
    recommendation_target: (record.recommendation_target ?? "").trim(),
    recommendation_reason: (record.recommendation_reason ?? "").trim(),
    told_someone: nullableBoolean(record.told_someone ?? "", "told_someone"),
  };
}

export function importReaderResponses(root: string, experimentId: string, csvPath?: string): NovelEventResult {
  const project = readProject(root);
  const book = readBook(root);
  const state = loadExperiments(root, book.book_id);
  const experiment = state.experiments.find((item) => item.id === experimentId);
  if (!experiment) throw new Error(`Unknown experiment ${experimentId}.`);
  const path = csvPath ? (isAbsolute(csvPath) ? csvPath : resolve(root, csvPath)) : join(root, "books", book.book_id, "reader-kit", "responses.csv");
  if (!existsSync(path)) throw new Error(`Reader response CSV does not exist: ${path}`);
  const records = csvRecords(readFileSync(path, "utf8"));
  const seen = new Set<string>();
  const immediate: ReturnType<typeof responseFrom>[] = [];
  const delayed: ReturnType<typeof responseFrom>[] = [];
  for (const record of records) {
    const phase = (record.phase ?? "").trim().toLowerCase();
    if (phase !== "immediate" && phase !== "delayed") throw new Error(`Reader response phase must be immediate or delayed; received ${record.phase || "blank"}.`);
    const response = responseFrom(record);
    const key = `${phase}:${response.reader_id}`;
    if (seen.has(key)) throw new Error(`Duplicate ${phase} response for reader ${response.reader_id}.`);
    seen.add(key);
    (phase === "immediate" ? immediate : delayed).push(response);
  }
  const immediateIds = new Set(immediate.map((response) => response.reader_id));
  for (const response of delayed) if (!immediateIds.has(response.reader_id)) throw new Error(`Delayed response ${response.reader_id} has no matching immediate response.`);

  experiment.immediate_responses = immediate;
  experiment.delayed_responses = delayed;
  experiment.status = delayed.length ? "complete" : immediate.length ? "delayed-pending" : "recruiting";
  experiment.metrics = {
    continuation_rate: booleanRate(immediate.filter((item) => item.continued_reading !== null).map((item) => item.continued_reading === true)),
    purchase_intent_rate: booleanRate(immediate.filter((item) => item.would_buy !== null).map((item) => item.would_buy === true)),
    delayed_hook_recall_rate: booleanRate(delayed.map((item) => nonblank(item.remembered_hook))),
    signature_moment_recall_rate: booleanRate(delayed.map((item) => item.remembered_moments.some(nonblank))),
    specific_recommendation_rate: booleanRate(delayed.map((item) => nonblank(item.recommendation_target) && nonblank(item.recommendation_reason))),
    talkability_rate: booleanRate(delayed.map((item) => item.told_someone === true)),
  };
  const enough = immediate.length >= experiment.minimum_reader_count && delayed.length >= experiment.minimum_reader_count;
  experiment.verdict = experiment.status === "complete" ? (enough ? "promising" : "insufficient-signal") : "blocked";
  experiment.next_action = experiment.status === "complete"
    ? enough ? "Review segmented evidence and create tickets only for repeated concrete failures." : `Collect at least ${experiment.minimum_reader_count} matching immediate and delayed human responses.`
    : "Collect the delayed session without reopening the sample.";

  return applyNovelEvent(root, {
    eventType: "reader-test",
    expectedStage: project.current_stage,
    expectedProjectHash: projectStateHash(root),
    scope: "record",
    files: [{ path: `books/${book.book_id}/reader-experiments.yaml`, content: stringifyYaml(state) }],
  });
}