import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { ReaderResponseV2 } from "../../domain/v1-2-schemas.js";
import { readReaderExperiment, readerCsvHeaders, readerResponseKey, sourceHash } from "./store.js";
import type { ReaderCanonicalColumn, ReaderColumnMapping, ReaderImportPreview, ReaderImportPreviewRow } from "./types.js";

interface ParsedCsv { headers: string[]; rows: Array<{ rowNumber: number; values: string[] }> }

export function parseReaderCsv(text: string): ParsedCsv {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); if (row.some((value) => value.length)) rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); if (row.some((value) => value.length)) rows.push(row); }
  const headers = rows.shift();
  if (!headers) throw new Error("Reader response CSV is empty.");
  if (new Set(headers).size !== headers.length) throw new Error("Reader response CSV contains duplicate headers.");
  return { headers, rows: rows.map((values, index) => ({ rowNumber: index + 2, values })) };
}

const canonical = new Set<string>(readerCsvHeaders);
const aliases: Record<string, ReaderCanonicalColumn> = {
  experiment: "experiment_id", reader: "reader_id", readerid: "reader_id", target_segment: "segment", time: "recorded_at",
  continue: "continued_reading", purchase: "would_buy", confusion: "confusions", trust: "trust_breaks", lines: "lines_that_worked",
  hook: "remembered_hook", moments: "remembered_moments", description: "friend_description", disagreement: "disagreement_question",
  lingering: "lingering_question", recommend_to: "recommendation_target", recommend_why: "recommendation_reason", talkability: "told_someone",
};

export function defaultColumnMapping(headers: string[]): ReaderColumnMapping {
  const sourceToCanonical: Record<string, ReaderCanonicalColumn | null> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    sourceToCanonical[header] = canonical.has(normalized) ? normalized as ReaderCanonicalColumn : aliases[normalized] ?? null;
  }
  return { sourceToCanonical };
}

function bool(value: string, field: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error(`${field} must be true, false, yes, no, 1, 0, or blank.`);
}

function scrubPII(text: string): string {
  if (!text) return text;
  return text.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[REDACTED EMAIL]');
}

function list(value: string): string[] { return value.split(";").map((item) => item.trim()).filter(Boolean); }

function record(headers: string[], values: string[], mapping: ReaderColumnMapping): Record<string, string> {
  if (values.length !== headers.length) throw new Error(`Expected ${headers.length} columns but received ${values.length}.`);
  const output: Record<string, string> = {};
  for (let index = 0; index < headers.length; index += 1) {
    const target = mapping.sourceToCanonical[headers[index]!] ?? null;
    if (!target) continue;
    if (target in output) throw new Error(`Multiple source columns map to ${target}.`);
    output[target] = values[index] ?? "";
  }
  return output;
}

function responseFrom(values: Record<string, string>, experimentId: string, questionnaireVersion: string): ReaderResponseV2 {
  const phase = values.phase?.trim().toLowerCase();
  if (phase !== "immediate" && phase !== "delayed") throw new Error("phase must be immediate or delayed.");
  const readerId = values.reader_id?.trim() ?? "";
  if (!readerId) throw new Error("reader_id is required.");
  const source = values.source?.trim().toLowerCase() || "human";
  if (source !== "human") throw new Error(`source must be human; received ${source}.`);
  const rowExperiment = values.experiment_id?.trim() || experimentId;
  if (rowExperiment !== experimentId) throw new Error(`Row belongs to ${rowExperiment}, not ${experimentId}.`);
  const rowQuestionnaire = values.questionnaire_version?.trim() || questionnaireVersion;
  if (rowQuestionnaire !== questionnaireVersion) throw new Error(`Questionnaire ${rowQuestionnaire} does not match ${questionnaireVersion}.`);
  return {
    experiment_id: experimentId,
    questionnaire_version: questionnaireVersion,
    phase,
    reader_id: readerId,
    source: "human",
    segment: values.segment?.trim() ?? "",
    recorded_at: values.recorded_at?.trim() ?? "",
    accepted_at: "",
    continued_reading: bool(values.continued_reading ?? "", "continued_reading"),
    would_buy: bool(values.would_buy ?? "", "would_buy"),
    confusions: list(scrubPII(values.confusions ?? "")),
    trust_breaks: list(scrubPII(values.trust_breaks ?? "")),
    lines_that_worked: list(scrubPII(values.lines_that_worked ?? "")),
    remembered_hook: scrubPII(values.remembered_hook?.trim() ?? ""),
    remembered_moments: list(scrubPII(values.remembered_moments ?? "")),
    friend_description: scrubPII(values.friend_description?.trim() ?? ""),
    disagreement_question: scrubPII(values.disagreement_question?.trim() ?? ""),
    lingering_question: scrubPII(values.lingering_question?.trim() ?? ""),
    recommendation_target: scrubPII(values.recommendation_target?.trim() ?? ""),
    recommendation_reason: scrubPII(values.recommendation_reason?.trim() ?? ""),
    told_someone: bool(values.told_someone ?? "", "told_someone"),
  };
}

function evidenceComparable(response: ReaderResponseV2): unknown {
  const { accepted_at: _acceptedAt, ...value } = response;
  return value;
}

export function previewReaderImport(root: string, bookId: string, experimentId: string, csvSource: string, mapping?: ReaderColumnMapping): ReaderImportPreview {
  const text = csvSource.includes("\n") ? csvSource : readFileSync(isAbsolute(csvSource) ? csvSource : resolve(root, csvSource), "utf8");
  const parsed = parseReaderCsv(text);
  const selectedMapping = mapping ?? defaultColumnMapping(parsed.headers);
  const experiment = readReaderExperiment(root, bookId, experimentId);
  const existing = new Map([...experiment.immediate_responses, ...experiment.delayed_responses].map((response) => [readerResponseKey(response), response]));
  const importedKeys = new Set<string>();
  const importedImmediate = new Set<string>();
  const rows: ReaderImportPreviewRow[] = [];
  for (const row of parsed.rows) {
    const original = Object.fromEntries(parsed.headers.map((header, index) => [header, row.values[index] ?? ""]));
    try {
      const values = record(parsed.headers, row.values, selectedMapping);
      const rawSource = values.source?.trim().toLowerCase() || "human";
      if (rawSource !== "human") {
        rows.push({ rowNumber: row.rowNumber, status: "non-evidence", key: `${values.phase ?? "unknown"}:${values.reader_id ?? "unknown"}`, response: null, errors: [`source ${rawSource} is not human evidence.`], original });
        continue;
      }
      const response = responseFrom(values, experimentId, experiment.questionnaire_version);
      const key = readerResponseKey(response);
      if (importedKeys.has(key)) { rows.push({ rowNumber: row.rowNumber, status: "invalid", key, response, errors: ["Duplicate reader-phase pair within imported CSV."], original }); continue; }
      importedKeys.add(key);
      if (response.phase === "immediate") importedImmediate.add(response.reader_id);
      const prior = existing.get(key);
      const status = !prior ? "new" : JSON.stringify(evidenceComparable(prior)) === JSON.stringify(evidenceComparable(response)) ? "duplicate" : "conflict";
      rows.push({ rowNumber: row.rowNumber, status, key, response, errors: [], original });
    } catch (error) {
      rows.push({ rowNumber: row.rowNumber, status: "invalid", key: `row-${row.rowNumber}`, response: null, errors: [error instanceof Error ? error.message : "Invalid reader row."], original });
    }
  }
  const acceptedImmediate = new Set(experiment.immediate_responses.map((response) => response.reader_id));
  for (const row of rows) if (row.response?.phase === "delayed" && !acceptedImmediate.has(row.response.reader_id) && !importedImmediate.has(row.response.reader_id) && row.status !== "invalid") {
    row.status = "unmatched-delayed";
    row.errors.push("Delayed response has no matching immediate response.");
  }
  const statuses = ["new", "duplicate", "conflict", "invalid", "non-evidence", "unmatched-delayed"] as const;
  const counts = Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.status === status).length])) as Record<(typeof statuses)[number], number>;
  return { experimentId, sourceHash: sourceHash(text), headers: parsed.headers, mapping: selectedMapping, rows, counts };
}
