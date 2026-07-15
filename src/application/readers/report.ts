import ExcelJS from "exceljs";
import type { ReaderExperimentFile, ReaderResponseV2 } from "../../domain/v1-2-schemas.js";

function percent(value: number | null): string { return value === null ? "n/a" : `${Math.round(value * 100)}%`; }
function frequency(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export function readerSummaryMarkdown(experiment: ReaderExperimentFile): string {
  const confusions = frequency(experiment.immediate_responses.flatMap((response) => response.confusions));
  const trust = frequency(experiment.immediate_responses.flatMap((response) => response.trust_breaks));
  return [
    `# Reader Experiment ${experiment.id}`,
    "",
    `- Status: ${experiment.status}`,
    `- Verdict: ${experiment.verdict}`,
    `- Target segment: ${experiment.target_reader}`,
    `- Immediate responses: ${experiment.immediate_responses.length}/${experiment.minimum_immediate_count}`,
    `- Delayed responses: ${experiment.delayed_responses.length}/${experiment.minimum_delayed_count}`,
    `- Continuation: ${percent(experiment.metrics.continuation_rate)}`,
    `- Purchase intent: ${percent(experiment.metrics.purchase_intent_rate)}`,
    `- Hook recall: ${percent(experiment.metrics.delayed_hook_recall_rate)}`,
    `- Signature-moment recall: ${percent(experiment.metrics.signature_moment_recall_rate)}`,
    `- Specific recommendation: ${percent(experiment.metrics.specific_recommendation_rate)}`,
    `- Talkability: ${percent(experiment.metrics.talkability_rate)}`,
    "",
    "## Repeated confusions",
    "",
    ...(confusions.length ? confusions.map(([value, count]) => `- ${count}× ${value}`) : ["- None recorded."]),
    "",
    "## Repeated trust breaks",
    "",
    ...(trust.length ? trust.map(([value, count]) => `- ${count}× ${value}`) : ["- None recorded."]),
    "",
    "## Limitations",
    "",
    ...(experiment.limitations.length ? experiment.limitations.map((value) => `- ${value}`) : ["- None recorded."]),
    "",
    "## Supported claims",
    "",
    ...(experiment.supported_claims.length ? experiment.supported_claims.map((value) => `- ${value}`) : ["- No outside-reader validation claim is currently supported."]),
    "",
    "## Prohibited claims",
    "",
    ...experiment.prohibited_claims.map((value) => `- ${value}`),
    "",
  ].join("\n");
}

function responseRow(response: ReaderResponseV2): Array<string | boolean | null> {
  return [response.phase, response.reader_id, response.segment, response.recorded_at, response.continued_reading, response.would_buy, response.confusions.join("; "), response.trust_breaks.join("; "), response.lines_that_worked.join("; "), response.remembered_hook, response.remembered_moments.join("; "), response.friend_description, response.disagreement_question, response.lingering_question, response.recommendation_target, response.recommendation_reason, response.told_someone];
}

export function readerAggregateCsv(experiment: ReaderExperimentFile): string {
  const rows = [
    ["metric", "value"],
    ["experiment_id", experiment.id],
    ["target_reader", experiment.target_reader],
    ["immediate_count", String(experiment.immediate_responses.length)],
    ["delayed_count", String(experiment.delayed_responses.length)],
    ...Object.entries(experiment.metrics).map(([key, value]) => [key, value === null ? "" : String(value)]),
    ["verdict", experiment.verdict],
  ];
  return `${rows.map((row) => row.map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n")}\n`;
}

export async function readerWorkbookBytes(experiment: ReaderExperimentFile): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Novel Forge";
  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["Experiment", experiment.id], ["Status", experiment.status], ["Verdict", experiment.verdict], ["Target reader", experiment.target_reader],
    ["Immediate responses", experiment.immediate_responses.length], ["Delayed responses", experiment.delayed_responses.length],
    ...Object.entries(experiment.metrics).map(([key, value]) => [key, value]),
  ]);
  summary.columns = [{ width: 34 }, { width: 52 }];
  const responses = workbook.addWorksheet("Responses");
  responses.addRow(["phase", "reader_id", "segment", "recorded_at", "continued_reading", "would_buy", "confusions", "trust_breaks", "lines_that_worked", "remembered_hook", "remembered_moments", "friend_description", "disagreement_question", "lingering_question", "recommendation_target", "recommendation_reason", "told_someone"]);
  for (const response of [...experiment.immediate_responses, ...experiment.delayed_responses]) responses.addRow(responseRow(response));
  responses.getRow(1).font = { bold: true };
  responses.views = [{ state: "frozen", ySplit: 1 }];
  responses.columns.forEach((column) => { column.width = 22; });
  const issues = workbook.addWorksheet("Repeated issues");
  issues.addRow(["type", "text", "count"]);
  for (const [value, count] of frequency(experiment.immediate_responses.flatMap((response) => response.confusions))) issues.addRow(["confusion", value, count]);
  for (const [value, count] of frequency(experiment.immediate_responses.flatMap((response) => response.trust_breaks))) issues.addRow(["trust break", value, count]);
  issues.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
