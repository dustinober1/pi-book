import { readBook } from "../../project/store.js";
import type { ReaderExperimentFile, ReaderResponseV2 } from "../../domain/v1-2-schemas.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import { experimentYaml, indexYaml, readReaderExperiment, readReaderIndex, readerExperimentDirectory, readerResponseKey, readerResponsesCsv, sourceHash } from "./store.js";
import { readerAggregateCsv, readerSummaryMarkdown, readerWorkbookBytes } from "./report.js";
import type { ReaderImportPreview, ReaderMergeProposal } from "./types.js";

function rate(values: boolean[]): number | null { return values.length ? values.filter(Boolean).length / values.length : null; }
function nonblank(value: string): boolean { return Boolean(value.trim()); }

function recompute(experiment: ReaderExperimentFile): void {
  const immediate = experiment.immediate_responses;
  const delayed = experiment.delayed_responses;
  experiment.metrics = {
    continuation_rate: rate(immediate.filter((item) => item.continued_reading !== null).map((item) => item.continued_reading === true)),
    purchase_intent_rate: rate(immediate.filter((item) => item.would_buy !== null).map((item) => item.would_buy === true)),
    delayed_hook_recall_rate: rate(delayed.map((item) => nonblank(item.remembered_hook))),
    signature_moment_recall_rate: rate(delayed.map((item) => item.remembered_moments.some(nonblank))),
    specific_recommendation_rate: rate(delayed.map((item) => nonblank(item.recommendation_target) && nonblank(item.recommendation_reason))),
    talkability_rate: rate(delayed.map((item) => item.told_someone === true)),
  };
  const enoughImmediate = immediate.length >= experiment.minimum_immediate_count;
  const enoughDelayed = delayed.length >= experiment.minimum_delayed_count;
  experiment.status = immediate.length === 0 ? "recruiting" : delayed.length === 0 ? "delayed-pending" : "complete";
  experiment.verdict = experiment.status !== "complete" ? "blocked" : enoughImmediate && enoughDelayed ? "promising" : "insufficient-signal";
  experiment.limitations = [];
  if (!enoughImmediate) experiment.limitations.push(`Only ${immediate.length} immediate responses are accepted; ${experiment.minimum_immediate_count} were declared.`);
  if (!enoughDelayed) experiment.limitations.push(`Only ${delayed.length} delayed responses are accepted; ${experiment.minimum_delayed_count} were declared.`);
  experiment.supported_claims = enoughImmediate && enoughDelayed
    ? [`The declared ${experiment.target_reader} sample produced ${immediate.length} immediate and ${delayed.length} delayed accepted human responses.`]
    : [];
  experiment.prohibited_claims = ["Do not generalize beyond the declared target-reader segment.", "Do not describe promising or insufficient evidence as market validation."];
  experiment.next_action = experiment.status === "complete"
    ? enoughImmediate && enoughDelayed ? "Review repeated concrete failures and create revision tickets only when the evidence is specific and repeated." : `Collect at least ${experiment.minimum_immediate_count} immediate and ${experiment.minimum_delayed_count} delayed matching human responses.`
    : "Collect the delayed session without reopening the sample.";
  experiment.updated_at = new Date().toISOString();
}

function accepted(response: ReaderResponseV2, acceptedAt: string): ReaderResponseV2 { return { ...response, accepted_at: acceptedAt }; }

export async function mergeReaderImport(root: string, bookId: string, preview: ReaderImportPreview, proposal: ReaderMergeProposal) {
  const experiment = structuredClone(readReaderExperiment(root, bookId, preview.experimentId));
  const acceptedAt = new Date().toISOString();
  const responses = new Map([...experiment.immediate_responses, ...experiment.delayed_responses].map((response) => [readerResponseKey(response), response]));
  const excluded = new Set(experiment.excluded_response_keys);
  const decisions: string[] = [];
  for (const row of preview.rows) {
    if (!row.response) continue;
    if (row.status === "new") {
      responses.set(row.key, accepted(row.response, acceptedAt));
      decisions.push(`${row.key}: accepted new row ${row.rowNumber}`);
    } else if (row.status === "duplicate") {
      decisions.push(`${row.key}: duplicate retained existing evidence`);
    } else if (row.status === "conflict") {
      const decision = proposal.decisions[row.key];
      if (!decision) throw new Error(`Conflict decision is required for ${row.key}.`);
      if (decision === "use-imported") responses.set(row.key, accepted(row.response, acceptedAt));
      else if (decision === "exclude") { responses.delete(row.key); excluded.add(row.key); }
      decisions.push(`${row.key}: ${decision}`);
    }
  }
  experiment.immediate_responses = [...responses.values()].filter((response) => response.phase === "immediate").sort((left, right) => left.reader_id.localeCompare(right.reader_id));
  experiment.delayed_responses = [...responses.values()].filter((response) => response.phase === "delayed").sort((left, right) => left.reader_id.localeCompare(right.reader_id));
  const immediateIds = new Set(experiment.immediate_responses.map((response) => response.reader_id));
  for (const response of experiment.delayed_responses) if (!immediateIds.has(response.reader_id)) throw new Error(`Accepted delayed response ${response.reader_id} has no matching immediate response.`);
  experiment.excluded_response_keys = [...excluded].sort();
  recompute(experiment);

  const index = readReaderIndex(root, bookId);
  const yaml = experimentYaml(experiment);
  const entry = index.experiments.find((item) => item.id === experiment.id);
  if (!entry) throw new Error(`Reader index is missing ${experiment.id}.`);
  entry.status = experiment.status;
  entry.source_hash = sourceHash(yaml);
  const base = readerExperimentDirectory(bookId, experiment.id);
  const workbook = await readerWorkbookBytes(experiment);
  const importReport = [
    `# Reader Import Report — ${experiment.id}`,
    "",
    `- Source hash: ${preview.sourceHash}`,
    `- Imported at: ${acceptedAt}`,
    `- New rows: ${preview.counts.new}`,
    `- Duplicate rows: ${preview.counts.duplicate}`,
    `- Conflict rows: ${preview.counts.conflict}`,
    `- Invalid rows: ${preview.counts.invalid}`,
    `- Non-evidence rows: ${preview.counts["non-evidence"]}`,
    `- Unmatched delayed rows: ${preview.counts["unmatched-delayed"]}`,
    "",
    "## Decisions",
    "",
    ...(decisions.length ? decisions.map((decision) => `- ${decision}`) : ["- No accepted evidence changes."]),
    "",
  ].join("\n");
  const event = applyGuidedProjectEvent(root, [
    { path: `${base}/experiment.yaml`, content: yaml },
    { path: `${base}/responses.csv`, content: readerResponsesCsv(experiment) },
    { path: `${base}/import-report.md`, content: importReport },
    { path: `${base}/summary.md`, content: readerSummaryMarkdown(experiment) },
    { path: `${base}/reader-summary.csv`, content: readerAggregateCsv(experiment) },
    { path: `${base}/reader-summary.xlsx`, content: workbook, encoding: "binary" },
    { path: `books/${bookId}/reader-kits/index.yaml`, content: indexYaml(index) },
  ], `Novel Forge: import reader responses for ${experiment.id}`, { lastAction: `Imported reader responses for ${experiment.id}` });
  return { experiment, changed: event.changed };
}

export function mergeReaderImportForActiveBook(root: string, preview: ReaderImportPreview, proposal: ReaderMergeProposal) {
  return mergeReaderImport(root, readBook(root).book_id, preview, proposal);
}
