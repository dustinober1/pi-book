import { Type, type Static } from "@sinclair/typebox";

export const AssumptionStatusSchema = Type.Union([
  Type.Literal("inferred"),
  Type.Literal("confirmed"),
  Type.Literal("corrected"),
  Type.Literal("rejected"),
  Type.Literal("superseded"),
]);
export type AssumptionStatus = Static<typeof AssumptionStatusSchema>;

export const IntakeScopeSchema = Type.String({ pattern: "^(?:project|book-[0-9]{2})$" });
export type IntakeScope = Static<typeof IntakeScopeSchema>;

export const AssumptionSourceSchema = Type.Object({
  type: Type.Union([Type.Literal("author-input"), Type.Literal("authorized-file"), Type.Literal("inference")]),
  path: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export const AssumptionRecordSchema = Type.Object({
  id: Type.String({ pattern: "^ASM-[0-9]{3}$" }),
  scope: IntakeScopeSchema,
  subject: Type.String({ minLength: 1 }),
  value: Type.Union([Type.String({ minLength: 1 }), Type.Integer()]),
  status: AssumptionStatusSchema,
  source: AssumptionSourceSchema,
  confidence: Type.Union([Type.Literal("low"), Type.Literal("moderate"), Type.Literal("high")]),
  affects: Type.Array(Type.String({ minLength: 1 })),
  supersedes: Type.Union([Type.String({ pattern: "^ASM-[0-9]{3}$" }), Type.Null()]),
}, { additionalProperties: false });
export type AssumptionRecord = Static<typeof AssumptionRecordSchema>;

export const WriterDecisionRecordSchema = Type.Object({
  id: Type.String({ pattern: "^DEC-[0-9]{3}$" }),
  scope: IntakeScopeSchema,
  subject: Type.String({ minLength: 1 }),
  choice: Type.String({ minLength: 1 }),
  decidedAt: Type.String({ minLength: 1 }),
  evidenceRefs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  replaces: Type.Union([Type.String({ pattern: "^DEC-[0-9]{3}$" }), Type.Null()]),
}, { additionalProperties: false });
export type WriterDecisionRecord = Static<typeof WriterDecisionRecordSchema>;

export const DecisionLedgerSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  assumptions: Type.Array(AssumptionRecordSchema),
  decisions: Type.Array(WriterDecisionRecordSchema),
}, { additionalProperties: false });
export type DecisionLedger = Static<typeof DecisionLedgerSchema>;

export const AuthorizedIntakeReferenceSchema = Type.Object({
  id: Type.String({ pattern: "^(?:BRIEF|SAMPLE)-[0-9]{3}$" }),
  path: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type AuthorizedIntakeReference = Static<typeof AuthorizedIntakeReferenceSchema>;

const StringInferenceSchema = Type.Union([
  Type.Object({ value: Type.Null(), assumption_id: Type.Null() }, { additionalProperties: false }),
  Type.Object({ value: Type.String({ minLength: 1 }), assumption_id: Type.String({ pattern: "^ASM-[0-9]{3}$" }) }, { additionalProperties: false }),
]);

const TargetWordsInferenceSchema = Type.Union([
  Type.Object({ value: Type.Null(), assumption_id: Type.Null() }, { additionalProperties: false }),
  Type.Object({ value: Type.Integer({ minimum: 1000 }), assumption_id: Type.String({ pattern: "^ASM-[0-9]{3}$" }) }, { additionalProperties: false }),
]);

export const IntakeSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  original_idea: Type.String(),
  authorized_briefs: Type.Array(AuthorizedIntakeReferenceSchema),
  authorized_samples: Type.Array(AuthorizedIntakeReferenceSchema),
  inferred: Type.Object({
    language: StringInferenceSchema,
    profile: StringInferenceSchema,
    audience: StringInferenceSchema,
    target_words: TargetWordsInferenceSchema,
  }, { additionalProperties: false }),
  unresolved_blockers: Type.Array(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type IntakeState = Static<typeof IntakeSchema>;

export interface V14Finding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

const terminalStatuses = new Set<AssumptionStatus>(["confirmed", "corrected", "rejected", "superseded"]);

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates].sort();
}

export function decisionLedgerFindings(ledger: DecisionLedger): V14Finding[] {
  const findings: V14Finding[] = [];
  for (const id of duplicateValues(ledger.assumptions.map((item) => item.id))) {
    findings.push({ severity: "blocker", code: "duplicate-assumption-id", message: `Decision ledger assumption ID ${id} is duplicated.` });
  }
  for (const id of duplicateValues(ledger.decisions.map((item) => item.id))) {
    findings.push({ severity: "blocker", code: "duplicate-decision-id", message: `Decision ledger decision ID ${id} is duplicated.` });
  }

  const earlierAssumptions = new Map<string, AssumptionRecord>();
  for (const assumption of ledger.assumptions) {
    if (assumption.supersedes) {
      const previous = earlierAssumptions.get(assumption.supersedes);
      if (!previous) findings.push({ severity: "blocker", code: "unknown-assumption-supersedes", message: `${assumption.id} supersedes unknown or later assumption ${assumption.supersedes}.` });
      else {
        if (previous.id === assumption.id) findings.push({ severity: "blocker", code: "self-assumption-supersedes", message: `${assumption.id} cannot supersede itself.` });
        if (previous.scope !== assumption.scope || previous.subject !== assumption.subject) findings.push({ severity: "blocker", code: "assumption-supersedes-mismatch", message: `${assumption.id} must preserve scope and subject from ${previous.id}.` });
        if (previous.status !== "superseded") findings.push({ severity: "blocker", code: "assumption-superseded-status", message: `${previous.id} must have status superseded before ${assumption.id} may replace it.` });
      }
    }
    earlierAssumptions.set(assumption.id, assumption);
  }

  const activeBySubject = new Map<string, AssumptionRecord[]>();
  for (const assumption of ledger.assumptions.filter((item) => !terminalStatuses.has(item.status))) {
    const key = `${assumption.scope}\u0000${assumption.subject}`;
    activeBySubject.set(key, [...(activeBySubject.get(key) ?? []), assumption]);
  }
  for (const assumptions of activeBySubject.values()) {
    if (assumptions.length > 1) findings.push({ severity: "blocker", code: "duplicate-active-assumption", message: `Decision ledger has multiple active assumptions for ${assumptions[0]!.scope}/${assumptions[0]!.subject}.` });
  }

  const earlierDecisions = new Map<string, WriterDecisionRecord>();
  for (const decision of ledger.decisions) {
    if (decision.replaces) {
      const previous = earlierDecisions.get(decision.replaces);
      if (!previous) findings.push({ severity: "blocker", code: "unknown-decision-replaces", message: `${decision.id} replaces unknown or later decision ${decision.replaces}.` });
      else if (previous.scope !== decision.scope || previous.subject !== decision.subject) findings.push({ severity: "blocker", code: "decision-replaces-mismatch", message: `${decision.id} must preserve scope and subject from ${previous.id}.` });
    }
    earlierDecisions.set(decision.id, decision);
  }

  const replaced = new Set(ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  const activeDecisionBySubject = new Map<string, WriterDecisionRecord[]>();
  for (const decision of ledger.decisions.filter((item) => !replaced.has(item.id))) {
    const key = `${decision.scope}\u0000${decision.subject}`;
    activeDecisionBySubject.set(key, [...(activeDecisionBySubject.get(key) ?? []), decision]);
  }
  for (const decisions of activeDecisionBySubject.values()) {
    if (decisions.length > 1) findings.push({ severity: "blocker", code: "duplicate-active-decision", message: `Decision ledger has multiple unreplaced decisions for ${decisions[0]!.scope}/${decisions[0]!.subject}.` });
  }

  for (const assumption of ledger.assumptions.filter((item) => item.status === "confirmed" || item.status === "corrected" || item.status === "rejected")) {
    const matching = ledger.decisions.some((decision) => decision.scope === assumption.scope && decision.subject === assumption.subject);
    if (!matching) findings.push({ severity: "blocker", code: "terminal-assumption-without-decision", message: `${assumption.id} has status ${assumption.status} without a writer decision for the same subject.` });
  }
  return findings;
}

export function intakeDecisionFindings(intake: IntakeState, ledger: DecisionLedger): V14Finding[] {
  const findings = [...decisionLedgerFindings(ledger)];
  const assumptions = new Map(ledger.assumptions.map((item) => [item.id, item]));
  const slots: Array<[string, { value: string | number | null; assumption_id: string | null }]> = [
    ["language", intake.inferred.language],
    ["profile", intake.inferred.profile],
    ["audience", intake.inferred.audience],
    ["target_words", intake.inferred.target_words],
  ];
  for (const [subject, slot] of slots) {
    if ((slot.value === null) !== (slot.assumption_id === null)) {
      findings.push({ severity: "blocker", code: "partial-inference-slot", message: `Intake inferred ${subject} must provide both value and assumption_id or neither.` });
      continue;
    }
    if (!slot.assumption_id) continue;
    const assumption = assumptions.get(slot.assumption_id);
    if (!assumption) findings.push({ severity: "blocker", code: "unknown-inference-assumption", message: `Intake inferred ${subject} references unknown assumption ${slot.assumption_id}.` });
    else {
      if (assumption.subject !== subject) findings.push({ severity: "blocker", code: "inference-subject-mismatch", message: `Intake inferred ${subject} must reference an assumption with subject ${subject}.` });
      if (String(slot.value) !== assumption.value) findings.push({ severity: "blocker", code: "inference-value-mismatch", message: `Intake inferred ${subject} value must match ${assumption.id}.` });
    }
  }
  return findings;
}

export function defaultIntake(): IntakeState {
  return {
    schema_version: "1.0.0",
    original_idea: "",
    authorized_briefs: [],
    authorized_samples: [],
    inferred: {
      language: { value: null, assumption_id: null },
      profile: { value: null, assumption_id: null },
      audience: { value: null, assumption_id: null },
      target_words: { value: null, assumption_id: null },
    },
    unresolved_blockers: [],
  };
}

export function defaultDecisionLedger(): DecisionLedger {
  return { schema_version: "1.0.0", assumptions: [], decisions: [] };
}
export { PremiseLabSchema, PremiseVariantSchema, defaultPremiseLab, type PremiseLab, type PremiseVariant } from "./v1-4-premise-schemas.js";
