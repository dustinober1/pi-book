import test from "node:test";
import assert from "node:assert/strict";
import {
  decideAssumption,
  inferAssumption,
  intakePromptContext,
  replaceWriterDecision,
  resolvedDecision,
  supersedeAssumption,
} from "../src/application/intake.js";
import { defaultDecisionLedger, defaultIntake } from "../src/domain/v1-4-schemas.js";

const inferredInput = {
  scope: "project" as const,
  subject: "profile",
  value: "thriller",
  source: { type: "inference" as const, path: "series/intake.yaml" },
  confidence: "moderate" as const,
  affects: ["voice-plan", "book-plan"],
};

test("inferring a setup value remains visibly inferred and creates no decision", () => {
  const original = defaultDecisionLedger();
  const ledger = inferAssumption(original, inferredInput);
  assert.deepEqual(original, defaultDecisionLedger());
  assert.deepEqual(ledger.assumptions, [{
    id: "ASM-001",
    ...inferredInput,
    status: "inferred",
    supersedes: null,
  }]);
  assert.deepEqual(ledger.decisions, []);
});

test("confirming an assumption appends an immutable matching writer decision", () => {
  const inferred = inferAssumption(defaultDecisionLedger(), inferredInput);
  const snapshot = structuredClone(inferred);
  const decided = decideAssumption(inferred, {
    assumptionId: "ASM-001",
    choice: "thriller",
    decidedAt: "2026-07-16T10:00:00Z",
    evidenceRefs: ["author confirmation"],
  });
  assert.deepEqual(inferred, snapshot);
  assert.equal(decided.assumptions[0]?.value, "thriller");
  assert.equal(decided.assumptions[0]?.status, "confirmed");
  assert.deepEqual(decided.decisions, [{
    id: "DEC-001",
    scope: "project",
    subject: "profile",
    choice: "thriller",
    decidedAt: "2026-07-16T10:00:00Z",
    evidenceRefs: ["author confirmation"],
    replaces: null,
  }]);
});

test("correcting target length preserves the original assumption value", () => {
  const inferred = inferAssumption(defaultDecisionLedger(), {
    ...inferredInput,
    subject: "target_words",
    value: "90000",
    affects: ["book-plan"],
  });
  const decided = decideAssumption(inferred, {
    assumptionId: "ASM-001",
    choice: "110000",
    decidedAt: "2026-07-16T10:10:00Z",
    evidenceRefs: ["writer correction"],
  });
  assert.equal(decided.assumptions[0]?.value, "90000");
  assert.equal(decided.assumptions[0]?.status, "corrected");
  assert.equal(decided.decisions[0]?.choice, "110000");
});

test("rejecting an assumption records explicit rejection without deleting history", () => {
  const inferred = inferAssumption(defaultDecisionLedger(), inferredInput);
  const rejected = decideAssumption(inferred, {
    assumptionId: "ASM-001",
    choice: "rejected",
    decidedAt: "2026-07-16T10:15:00Z",
    evidenceRefs: ["writer rejection"],
  });
  assert.equal(rejected.assumptions[0]?.status, "rejected");
  assert.equal(rejected.assumptions[0]?.value, "thriller");
  assert.equal(rejected.decisions[0]?.choice, "rejected");
});

test("writer decision replacement appends a linked record and preserves the old record", () => {
  const confirmed = decideAssumption(inferAssumption(defaultDecisionLedger(), inferredInput), {
    assumptionId: "ASM-001",
    choice: "thriller",
    decidedAt: "2026-07-16T10:00:00Z",
    evidenceRefs: ["author confirmation"],
  });
  const oldDecision = structuredClone(confirmed.decisions[0]);
  const replaced = replaceWriterDecision(confirmed, "DEC-001", "romantasy", "2026-07-16T11:00:00Z", ["author correction"]);
  assert.deepEqual(replaced.decisions[0], oldDecision);
  assert.deepEqual(replaced.decisions[1], {
    id: "DEC-002",
    scope: "project",
    subject: "profile",
    choice: "romantasy",
    decidedAt: "2026-07-16T11:00:00Z",
    evidenceRefs: ["author correction"],
    replaces: "DEC-001",
  });
  assert.equal(resolvedDecision(replaced, "project", "profile")?.id, "DEC-002");
});

test("assumption supersession preserves both records and terminates the old one", () => {
  const first = inferAssumption(defaultDecisionLedger(), inferredInput);
  assert.throws(() => inferAssumption(first, { ...inferredInput, value: "romantasy" }), /active assumption/i);
  const second = supersedeAssumption(first, "ASM-001", { ...inferredInput, value: "romantasy", confidence: "high" });
  assert.equal(second.assumptions[0]?.status, "superseded");
  assert.equal(second.assumptions[0]?.value, "thriller");
  assert.deepEqual(second.assumptions[1], {
    id: "ASM-002",
    ...inferredInput,
    value: "romantasy",
    confidence: "high",
    status: "inferred",
    supersedes: "ASM-001",
  });
});

test("terminal assumptions and decision replacements require valid evidence", () => {
  const confirmed = decideAssumption(inferAssumption(defaultDecisionLedger(), inferredInput), {
    assumptionId: "ASM-001",
    choice: "thriller",
    decidedAt: "2026-07-16T10:00:00Z",
    evidenceRefs: ["author confirmation"],
  });
  assert.throws(() => decideAssumption(confirmed, { assumptionId: "ASM-001", choice: "romantasy", decidedAt: "2026-07-16T11:00:00Z", evidenceRefs: ["author"] }), /terminal/i);
  assert.throws(() => replaceWriterDecision(confirmed, "DEC-001", "romantasy", "2026-07-16T11:00:00Z", []), /evidence/i);
});

test("prompt context separates settled decisions from unresolved inference", () => {
  let ledger = inferAssumption(defaultDecisionLedger(), inferredInput);
  ledger = inferAssumption(ledger, { ...inferredInput, subject: "audience", value: "adult procedural readers", affects: ["voice-plan"] });
  ledger = decideAssumption(ledger, { assumptionId: "ASM-001", choice: "thriller", decidedAt: "2026-07-16T10:00:00Z", evidenceRefs: ["author"] });
  const intake = defaultIntake();
  intake.original_idea = "A systems auditor finds a pattern no one signed.";
  const context = intakePromptContext(intake, ledger);
  assert.match(context, /Confirmed writer decisions/);
  assert.match(context, /profile: thriller/);
  assert.match(context, /Unresolved inferred assumptions/);
  assert.match(context, /audience: adult procedural readers/);
  assert.match(context, /not confirmed facts/i);
});

test("absent or empty intake evidence compiles to no fabricated prompt context", () => {
  assert.equal(intakePromptContext(null, null), "");
  assert.equal(intakePromptContext(defaultIntake(), defaultDecisionLedger()), "");
});
