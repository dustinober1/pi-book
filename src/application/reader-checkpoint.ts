import { join } from "node:path";
import { ReaderExperimentsSchema, type ReaderExperimentsState } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";

/**
 * A structural human reader checkpoint before packaging.
 *
 * RELEASE.md has always stated that automated diagnostics are not human reader
 * evidence, and the reader-kit subsystem exists to collect the real thing — but
 * using it was entirely optional. A book could be planned, drafted, reviewed and
 * packaged for publication without one person ever reading a page of it, and
 * nothing in the workflow would say so.
 *
 * For a release whose subject is whether the finished book reads as written
 * rather than generated, that is the one question no deterministic check can
 * answer. So the `package` event now requires that at least one human has
 * responded to a reader experiment.
 *
 * The bar is deliberately evidence-exists, not evidence-is-good: a "rejected"
 * verdict is still a real reader response, and whether to publish anyway is the
 * writer's decision, not the tool's.
 */

export interface ReaderCheckpointFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

const REMEDY = "Collect real reader responses through the reader-kit workflow and record them with a reader-test event. If you are deliberately packaging without reader evidence, say so explicitly to the writer first — this is the one quality question no automated check in this project can answer.";

function loadExperiments(root: string, bookId: string): ReaderExperimentsState | null {
  const path = `books/${bookId}/reader-experiments.yaml`;
  const text = readText(join(root, path));
  if (text === null) return null;
  try {
    return parseYaml<ReaderExperimentsState>(text, ReaderExperimentsSchema, path);
  } catch {
    return null;
  }
}

export function readerCheckpointFindings(state: ReaderExperimentsState | null): ReaderCheckpointFinding[] {
  const experiments = state?.experiments.filter((experiment) => experiment.status !== "cancelled") ?? [];
  const withResponses = experiments.filter((experiment) => experiment.immediate_responses.length > 0);

  if (withResponses.length === 0) {
    const detail = experiments.length === 0
      ? "This book has no reader experiments."
      : `This book has ${experiments.length} reader ${experiments.length === 1 ? "experiment" : "experiments"} but not one recorded human response.`;
    return [{
      severity: "blocker",
      code: "no-human-reader-evidence",
      message: `A package event requires evidence that a human has read this book. ${detail} Deterministic lint, critics and audits describe the manuscript; they are not readers and cannot tell you whether the book works. ${REMEDY}`,
    }];
  }

  const findings: ReaderCheckpointFinding[] = [];
  const belowTarget = withResponses.filter((experiment) => experiment.immediate_responses.length < experiment.minimum_reader_count);
  if (belowTarget.length === withResponses.length) {
    findings.push({
      severity: "warning",
      code: "thin-reader-evidence",
      message: `Every reader experiment has fewer responses than its own minimum_reader_count (${withResponses.map((item) => `${item.id}: ${item.immediate_responses.length}/${item.minimum_reader_count}`).join(", ")}). The evidence exists but is thinner than the plan called for; report that limitation rather than describing the book as reader-validated.`,
    });
  }

  if (withResponses.every((experiment) => experiment.delayed_responses.length === 0)) {
    findings.push({
      severity: "warning",
      code: "no-delayed-reader-evidence",
      message: "No reader experiment has delayed responses, so nothing measures what readers still remembered days later. Immediate reaction and durable impression are different signals; only the first has been collected.",
    });
  }

  return findings;
}

/** Convenience wrapper that reads the active book's experiments from disk. */
export function packageReaderCheckpointFindings(root: string, bookId: string): ReaderCheckpointFinding[] {
  return readerCheckpointFindings(loadExperiments(root, bookId));
}
