import { join } from "node:path";
import { ReaderExperimentsSchema, type ReaderExperimentsState } from "../domain/schemas.js";
import { DecisionLedgerSchema, type DecisionLedger, type WriterDecisionRecord } from "../domain/v1-4-schemas.js";
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

/**
 * The subject of the writer decision that permits packaging without reader
 * evidence. It is a recorded decision in `series/decision-ledger.yaml`, not a
 * command-line flag, for the same reason historical inventions require one: a
 * choice this consequential should leave a durable, attributable record rather
 * than living in one invocation's argv. The decision does not make the book
 * reader-validated — it records that the writer chose to publish without asking
 * a reader, and the absence is stamped into the package manifest.
 */
export const PACKAGE_WITHOUT_READERS_SUBJECT = "package-without-reader-evidence";

const OVERRIDE_REMEDY = `If you intend to package without reader evidence, record an explicit writer decision with subject ${PACKAGE_WITHOUT_READERS_SUBJECT} and choice accept:no-reader-evidence in series/decision-ledger.yaml through an intake-update event. The absence is then stamped into the package manifest rather than hidden.`;

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

function loadDecisionLedger(root: string): DecisionLedger | null {
  const path = "series/decision-ledger.yaml";
  const text = readText(join(root, path));
  if (text === null) return null;
  try {
    return parseYaml<DecisionLedger>(text, DecisionLedgerSchema, path);
  } catch {
    return null;
  }
}

/**
 * The active (unreplaced) writer decision permitting packaging without reader
 * evidence, or null. Superseded decisions do not count, exactly as they do not
 * for historical inventions.
 */
export function packageWithoutReadersDecision(root: string, bookId: string): WriterDecisionRecord | null {
  const ledger = loadDecisionLedger(root);
  if (!ledger) return null;
  const replaced = new Set(ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  return ledger.decisions.find((item) => !replaced.has(item.id)
    && item.subject === PACKAGE_WITHOUT_READERS_SUBJECT
    && item.choice.startsWith("accept:")
    && (item.scope === "project" || item.scope === bookId)) ?? null;
}

export function readerCheckpointFindings(
  state: ReaderExperimentsState | null,
  override: WriterDecisionRecord | null = null,
): ReaderCheckpointFinding[] {
  const experiments = state?.experiments.filter((experiment) => experiment.status !== "cancelled") ?? [];
  const withResponses = experiments.filter((experiment) => experiment.immediate_responses.length > 0);

  if (withResponses.length === 0) {
    const detail = experiments.length === 0
      ? "This book has no reader experiments."
      : `This book has ${experiments.length} reader ${experiments.length === 1 ? "experiment" : "experiments"} but not one recorded human response.`;
    if (override) {
      // The writer answered the question by choosing not to ask it. That is
      // their call, and it is now on the record — but it never becomes reader
      // evidence, so the finding downgrades to a warning that packaging must
      // carry rather than disappearing.
      return [{
        severity: "warning",
        code: "reader-evidence-waived",
        message: `Packaging without reader evidence under writer decision ${override.id} (${override.choice}, recorded ${override.decidedAt}). ${detail} Nothing about this book has been validated by a reader; the package manifest records the absence. Do not describe it as reader-tested.`,
      }];
    }
    return [{
      severity: "blocker",
      code: "no-human-reader-evidence",
      message: `A package event requires evidence that a human has read this book. ${detail} Deterministic lint, critics and audits describe the manuscript; they are not readers and cannot tell you whether the book works. ${REMEDY} ${OVERRIDE_REMEDY}`,
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

/** Convenience wrapper that reads the active book's experiments and any waiver from disk. */
export function packageReaderCheckpointFindings(root: string, bookId: string): ReaderCheckpointFinding[] {
  return readerCheckpointFindings(loadExperiments(root, bookId), packageWithoutReadersDecision(root, bookId));
}

export interface ReaderCheckpointProgress {
  satisfied: boolean;
  waived: boolean;
  experiments: number;
  experimentsWithResponses: number;
  /** One line naming the remaining distance, for status and the checklist. */
  summary: string;
}

/**
 * The reader checkpoint blocks packaging, which is the last gate in the book —
 * so a writer could reach it having done everything else right and discover a
 * requirement they had no reason to know about. This makes the distance visible
 * from drafting onward, where there is still time to arrange readers.
 */
export function readerCheckpointProgress(root: string, bookId: string): ReaderCheckpointProgress {
  const state = loadExperiments(root, bookId);
  const override = packageWithoutReadersDecision(root, bookId);
  const experiments = state?.experiments.filter((experiment) => experiment.status !== "cancelled") ?? [];
  const withResponses = experiments.filter((experiment) => experiment.immediate_responses.length > 0);
  if (withResponses.length > 0) {
    return {
      satisfied: true,
      waived: false,
      experiments: experiments.length,
      experimentsWithResponses: withResponses.length,
      summary: `Reader checkpoint satisfied: ${withResponses.length} of ${experiments.length} reader experiment(s) carry a recorded human response.`,
    };
  }
  if (override) {
    return {
      satisfied: true,
      waived: true,
      experiments: experiments.length,
      experimentsWithResponses: 0,
      summary: `Reader checkpoint waived by writer decision ${override.id}. Packaging is permitted and the manifest will record that no reader has read this book.`,
    };
  }
  const detail = experiments.length === 0
    ? "no reader experiment exists yet"
    : `${experiments.length} reader experiment(s) exist but none has a recorded human response`;
  return {
    satisfied: false,
    waived: false,
    experiments: experiments.length,
    experimentsWithResponses: 0,
    summary: `Packaging will require at least one recorded human reader response, and ${detail}. Prepare a reader kit now — this is the one quality question no automated check here can answer.`,
  };
}
