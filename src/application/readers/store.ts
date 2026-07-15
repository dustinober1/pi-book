import { createHash } from "node:crypto";
import { join } from "node:path";
import { ReaderExperimentFileSchema, ReaderExperimentIndexSchema, type ReaderExperimentFile, type ReaderExperimentIndex, type ReaderResponseV2 } from "../../domain/v1-2-schemas.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";

export const readerCsvHeaders = [
  "schema_version", "experiment_id", "questionnaire_version", "phase", "reader_id", "source", "segment", "recorded_at",
  "continued_reading", "would_buy", "confusions", "trust_breaks", "lines_that_worked", "remembered_hook", "remembered_moments",
  "friend_description", "disagreement_question", "lingering_question", "recommendation_target", "recommendation_reason", "told_someone",
] as const;

export function readerExperimentDirectory(bookId: string, id: string): string {
  if (!/^RE-\d{3}$/.test(id)) throw new Error(`Invalid reader experiment ID: ${id}`);
  return `books/${bookId}/reader-kits/${id}`;
}

export function readReaderIndex(root: string, bookId: string): ReaderExperimentIndex {
  const path = join(root, "books", bookId, "reader-kits", "index.yaml");
  const text = readText(path);
  return text ? parseYaml<ReaderExperimentIndex>(text, ReaderExperimentIndexSchema, "reader-kits/index.yaml") : { schema_version: "1.0.0", experiments: [] };
}

export function readReaderExperiment(root: string, bookId: string, experimentId: string): ReaderExperimentFile {
  const relative = `${readerExperimentDirectory(bookId, experimentId)}/experiment.yaml`;
  const text = readText(join(root, relative));
  if (!text) throw new Error(`Reader experiment does not exist: ${experimentId}`);
  return parseYaml<ReaderExperimentFile>(text, ReaderExperimentFileSchema, relative);
}

export function nextReaderExperimentId(index: ReaderExperimentIndex): string {
  const maximum = index.experiments.map((item) => Number.parseInt(item.id.slice(3), 10)).reduce((current, value) => Math.max(current, value), 0);
  if (maximum >= 999) throw new Error("A book supports at most 999 reader experiments.");
  return `RE-${String(maximum + 1).padStart(3, "0")}`;
}

export function readerResponseKey(response: Pick<ReaderResponseV2, "phase" | "reader_id">): string { return `${response.phase}:${response.reader_id}`; }
export function experimentYaml(experiment: ReaderExperimentFile): string { return stringifyYaml(experiment); }
export function indexYaml(index: ReaderExperimentIndex): string { return stringifyYaml(index); }
export function sourceHash(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function booleanCell(value: boolean | null): string { return value === null ? "" : value ? "true" : "false"; }
export function readerResponsesCsv(experiment: ReaderExperimentFile): string {
  const rows = [...experiment.immediate_responses, ...experiment.delayed_responses].map((response) => [
    "1.0.0", response.experiment_id, response.questionnaire_version, response.phase, response.reader_id, response.source, response.segment, response.recorded_at,
    booleanCell(response.continued_reading), booleanCell(response.would_buy), response.confusions.join(";"), response.trust_breaks.join(";"), response.lines_that_worked.join(";"), response.remembered_hook, response.remembered_moments.join(";"),
    response.friend_description, response.disagreement_question, response.lingering_question, response.recommendation_target, response.recommendation_reason, booleanCell(response.told_someone),
  ].map(csvCell).join(","));
  return `${readerCsvHeaders.join(",")}\n${rows.length ? `${rows.join("\n")}\n` : ""}`;
}
