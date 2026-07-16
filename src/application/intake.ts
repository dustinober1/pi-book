import type {
  AssumptionRecord,
  DecisionLedger,
  IntakeState,
  IntakeScope,
  WriterDecisionRecord,
} from "../domain/v1-4-schemas.js";
import { decisionLedgerFindings } from "../domain/v1-4-schemas.js";

export interface InferAssumptionInput {
  scope: IntakeScope;
  subject: string;
  value: string | number;
  source: AssumptionRecord["source"];
  confidence: AssumptionRecord["confidence"];
  affects: string[];
}

export interface DecideAssumptionInput {
  assumptionId: string;
  choice: string;
  decidedAt: string;
  evidenceRefs: string[];
}

export interface RecordWriterDecisionInput {
  scope: IntakeScope;
  subject: string;
  choice: string;
  decidedAt: string;
  evidenceRefs: string[];
  replaces?: string | null;
}

function nonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be nonblank.`);
  return normalized;
}

function assumptionValue(value: string | number, label: string): string | number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`${label} must be an integer when numeric.`);
    return value;
  }
  return nonBlank(value, label);
}

function uniqueStrings(values: string[], label: string, requireOne = false): string[] {
  const normalized = [...new Set(values.map((item) => item.trim()).filter(Boolean))];
  if (requireOne && !normalized.length) throw new Error(`${label} requires at least one evidence reference.`);
  return normalized;
}

function nextId(values: string[], prefix: "ASM" | "DEC"): string {
  const maximum = values.reduce((current, id) => {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(maximum + 1).padStart(3, "0")}`;
}

function cloneLedger(ledger: DecisionLedger): DecisionLedger {
  return structuredClone(ledger);
}

function assertValidLedger(ledger: DecisionLedger): void {
  const blockers = decisionLedgerFindings(ledger).filter((item) => item.severity === "blocker");
  if (blockers.length) throw new Error(`Decision ledger validation blocked the operation:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
}

function activeAssumption(ledger: DecisionLedger, scope: string, subject: string): AssumptionRecord | undefined {
  return ledger.assumptions.find((item) => item.scope === scope && item.subject === subject && item.status === "inferred");
}

export function inferAssumption(ledger: DecisionLedger, input: InferAssumptionInput): DecisionLedger {
  assertValidLedger(ledger);
  const scope = nonBlank(input.scope, "Assumption scope") as IntakeScope;
  const subject = nonBlank(input.subject, "Assumption subject");
  if (activeAssumption(ledger, scope, subject)) throw new Error(`An active assumption already exists for ${scope}/${subject}.`);
  const result = cloneLedger(ledger);
  result.assumptions.push({
    id: nextId(result.assumptions.map((item) => item.id), "ASM"),
    scope,
    subject,
    value: assumptionValue(input.value, "Assumption value"),
    status: "inferred",
    source: {
      type: input.source.type,
      path: nonBlank(input.source.path, "Assumption source path"),
    },
    confidence: input.confidence,
    affects: uniqueStrings(input.affects, "Assumption affects"),
    supersedes: null,
  });
  assertValidLedger(result);
  return result;
}

export function supersedeAssumption(
  ledger: DecisionLedger,
  assumptionId: string,
  input: InferAssumptionInput,
): DecisionLedger {
  assertValidLedger(ledger);
  const result = cloneLedger(ledger);
  const previous = result.assumptions.find((item) => item.id === assumptionId);
  if (!previous) throw new Error(`Unknown assumption ${assumptionId}.`);
  if (previous.status !== "inferred") throw new Error(`Assumption ${assumptionId} is terminal and cannot be superseded.`);
  const scope = nonBlank(input.scope, "Assumption scope") as IntakeScope;
  const subject = nonBlank(input.subject, "Assumption subject");
  if (scope !== previous.scope || subject !== previous.subject) throw new Error(`A superseding assumption must preserve scope and subject from ${assumptionId}.`);
  previous.status = "superseded";
  result.assumptions.push({
    id: nextId(result.assumptions.map((item) => item.id), "ASM"),
    scope,
    subject,
    value: assumptionValue(input.value, "Assumption value"),
    status: "inferred",
    source: { type: input.source.type, path: nonBlank(input.source.path, "Assumption source path") },
    confidence: input.confidence,
    affects: uniqueStrings(input.affects, "Assumption affects"),
    supersedes: assumptionId,
  });
  assertValidLedger(result);
  return result;
}

export function decideAssumption(ledger: DecisionLedger, input: DecideAssumptionInput): DecisionLedger {
  assertValidLedger(ledger);
  const result = cloneLedger(ledger);
  const assumption = result.assumptions.find((item) => item.id === input.assumptionId);
  if (!assumption) throw new Error(`Unknown assumption ${input.assumptionId}.`);
  if (assumption.status !== "inferred") throw new Error(`Assumption ${input.assumptionId} is terminal and cannot be decided again.`);
  const choice = nonBlank(input.choice, "Writer decision choice");
  const evidenceRefs = uniqueStrings(input.evidenceRefs, "Writer decision", true);
  assumption.status = choice === "rejected" ? "rejected" : choice === String(assumption.value) ? "confirmed" : "corrected";
  result.decisions.push({
    id: nextId(result.decisions.map((item) => item.id), "DEC"),
    scope: assumption.scope,
    subject: assumption.subject,
    choice,
    decidedAt: nonBlank(input.decidedAt, "Writer decision time"),
    evidenceRefs,
    replaces: null,
  });
  assertValidLedger(result);
  return result;
}

export function recordWriterDecision(ledger: DecisionLedger, input: RecordWriterDecisionInput): DecisionLedger {
  assertValidLedger(ledger);
  const result = cloneLedger(ledger);
  const scope = nonBlank(input.scope, "Writer decision scope") as IntakeScope;
  const subject = nonBlank(input.subject, "Writer decision subject");
  const replaced = new Set(result.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  const active = result.decisions.find((item) => item.scope === scope && item.subject === subject && !replaced.has(item.id));
  const replacement = input.replaces ?? null;
  if (active && replacement !== active.id) throw new Error(`An active writer decision already exists for ${scope}/${subject}; replace ${active.id} explicitly.`);
  if (!active && replacement) throw new Error(`Cannot replace inactive or unknown writer decision ${replacement}.`);
  result.decisions.push({
    id: nextId(result.decisions.map((item) => item.id), "DEC"),
    scope,
    subject,
    choice: nonBlank(input.choice, "Writer decision choice"),
    decidedAt: nonBlank(input.decidedAt, "Writer decision time"),
    evidenceRefs: uniqueStrings(input.evidenceRefs, "Writer decision", true),
    replaces: replacement,
  });
  assertValidLedger(result);
  return result;
}

export function replaceWriterDecision(
  ledger: DecisionLedger,
  decisionId: string,
  choice: string,
  decidedAt: string,
  evidenceRefs: string[],
): DecisionLedger {
  assertValidLedger(ledger);
  const result = cloneLedger(ledger);
  const previous = result.decisions.find((item) => item.id === decisionId);
  if (!previous) throw new Error(`Unknown writer decision ${decisionId}.`);
  if (result.decisions.some((item) => item.replaces === decisionId)) throw new Error(`Writer decision ${decisionId} has already been replaced.`);
  result.decisions.push({
    id: nextId(result.decisions.map((item) => item.id), "DEC"),
    scope: previous.scope,
    subject: previous.subject,
    choice: nonBlank(choice, "Replacement writer decision choice"),
    decidedAt: nonBlank(decidedAt, "Replacement writer decision time"),
    evidenceRefs: uniqueStrings(evidenceRefs, "Replacement writer decision", true),
    replaces: decisionId,
  });
  assertValidLedger(result);
  return result;
}

export function resolvedDecision(ledger: DecisionLedger, scope: string, subject: string): WriterDecisionRecord | null {
  const replaced = new Set(ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  const candidates = ledger.decisions.filter((item) => item.scope === scope && item.subject === subject && !replaced.has(item.id));
  const resolved = candidates.at(-1) ?? null;
  return resolved?.choice === "rejected" ? null : resolved;
}

export function intakePromptContext(intake: IntakeState | null, ledger: DecisionLedger | null): string {
  if (!intake && !ledger) return "";
  const decisions = ledger
    ? ledger.decisions.filter((item) => !ledger.decisions.some((candidate) => candidate.replaces === item.id) && item.choice !== "rejected")
    : [];
  const assumptions = ledger?.assumptions.filter((item) => item.status === "inferred") ?? [];
  const originalIdea = intake?.original_idea.trim() ?? "";
  if (!originalIdea && !decisions.length && !assumptions.length) return "";
  const sections: string[] = ["# Intake and decision provenance"];
  if (originalIdea) sections.push("", "Original author idea:", originalIdea);
  if (decisions.length) {
    sections.push("", "Confirmed writer decisions:");
    for (const decision of decisions) sections.push(`- ${decision.scope}/${decision.subject}: ${decision.choice} (${decision.id})`);
  }
  if (assumptions.length) {
    sections.push("", "Unresolved inferred assumptions — these are not confirmed facts and must not be promoted without a writer decision:");
    for (const assumption of assumptions) sections.push(`- ${assumption.scope}/${assumption.subject}: ${assumption.value} (${assumption.id}, ${assumption.confidence})`);
  }
  return sections.join("\n");
}
