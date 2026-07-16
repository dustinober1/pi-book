import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  DecisionLedgerSchema,
  IntakeSchema,
  defaultDecisionLedger,
  defaultIntake,
  decisionLedgerFindings,
  type DecisionLedger,
} from "../src/domain/v1-4-schemas.js";
import { v14SchemaForPath } from "../src/domain/v1-4-schema-registry.js";

function assumption(id = "ASM-001") {
  return {
    id,
    scope: "project" as const,
    subject: "profile",
    value: "thriller",
    status: "inferred" as const,
    source: { type: "inference" as const, path: "series/intake.yaml" },
    confidence: "moderate" as const,
    affects: ["voice-plan", "book-plan"],
    supersedes: null,
  };
}

test("default intake and decision ledger validate without invented evidence", () => {
  const intake = defaultIntake();
  const ledger = defaultDecisionLedger();
  assert.deepEqual(intake, {
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
  });
  assert.deepEqual(ledger, { schema_version: "1.0.0", assumptions: [], decisions: [] });
  assert.doesNotThrow(() => parseYaml(stringifyYaml(intake), IntakeSchema, "intake.yaml"));
  assert.doesNotThrow(() => parseYaml(stringifyYaml(ledger), DecisionLedgerSchema, "decision-ledger.yaml"));
  assert.deepEqual(decisionLedgerFindings(ledger), []);
});

test("schema registry resolves only the two canonical 1.4 paths", () => {
  assert.equal(v14SchemaForPath("series/intake.yaml"), IntakeSchema);
  assert.equal(v14SchemaForPath("series/decision-ledger.yaml"), DecisionLedgerSchema);
  assert.equal(v14SchemaForPath("books/book-01/intake.yaml"), null);
  assert.equal(v14SchemaForPath("series/other.yaml"), null);
});

test("intake inferred slots require both values and assumption IDs and valid target words", () => {
  const intake = defaultIntake();
  intake.inferred.profile = { value: "thriller", assumption_id: null } as never;
  assert.throws(() => parseYaml(stringifyYaml(intake), IntakeSchema, "intake.yaml"));

  const target = defaultIntake();
  target.inferred.target_words = { value: 999, assumption_id: "ASM-001" };
  assert.throws(() => parseYaml(stringifyYaml(target), IntakeSchema, "intake.yaml"));

  const valid = defaultIntake();
  valid.inferred.target_words = { value: 100000, assumption_id: "ASM-001" };
  assert.doesNotThrow(() => parseYaml(stringifyYaml(valid), IntakeSchema, "intake.yaml"));
});

test("decision ledger schema rejects malformed records", () => {
  const invalid: DecisionLedger[] = [
    { schema_version: "1.0.0", assumptions: [{ ...assumption(), id: "BAD-001" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...assumption(), scope: "book-one" as never }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...assumption(), subject: "" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...assumption(), value: "" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...assumption(), status: "guessed" as never }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [], decisions: [{ id: "BAD-001", scope: "project", subject: "profile", choice: "thriller", decidedAt: "2026-07-16T00:00:00Z", evidenceRefs: ["author"], replaces: null }] },
  ];
  for (const ledger of invalid) assert.throws(() => parseYaml(stringifyYaml(ledger), DecisionLedgerSchema, "decision-ledger.yaml"));
});

test("cross-record findings reject duplicate IDs broken links and duplicate active assumptions", () => {
  const base = assumption();
  const cases: DecisionLedger[] = [
    { schema_version: "1.0.0", assumptions: [base, { ...base }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [base, { ...base, id: "ASM-002" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...base, supersedes: "ASM-404" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [{ ...base, supersedes: "ASM-001" }], decisions: [] },
    { schema_version: "1.0.0", assumptions: [base], decisions: [
      { id: "DEC-001", scope: "project", subject: "profile", choice: "thriller", decidedAt: "2026-07-16T00:00:00Z", evidenceRefs: ["author"], replaces: "DEC-404" },
    ] },
    { schema_version: "1.0.0", assumptions: [base], decisions: [
      { id: "DEC-001", scope: "project", subject: "profile", choice: "thriller", decidedAt: "2026-07-16T00:00:00Z", evidenceRefs: ["author"], replaces: null },
      { id: "DEC-001", scope: "project", subject: "profile", choice: "romantasy", decidedAt: "2026-07-16T01:00:00Z", evidenceRefs: ["author"], replaces: null },
    ] },
  ];
  for (const ledger of cases) assert.ok(decisionLedgerFindings(ledger).some((finding) => finding.severity === "blocker"));
});

test("valid supersession and decision replacement preserve a coherent chain", () => {
  const ledger: DecisionLedger = {
    schema_version: "1.0.0",
    assumptions: [
      { ...assumption(), status: "superseded" },
      { ...assumption("ASM-002"), value: "romantasy", supersedes: "ASM-001" },
    ],
    decisions: [
      { id: "DEC-001", scope: "project", subject: "profile", choice: "thriller", decidedAt: "2026-07-16T00:00:00Z", evidenceRefs: ["author"], replaces: null },
      { id: "DEC-002", scope: "project", subject: "profile", choice: "romantasy", decidedAt: "2026-07-16T01:00:00Z", evidenceRefs: ["author correction"], replaces: "DEC-001" },
    ],
  };
  assert.deepEqual(decisionLedgerFindings(ledger), []);
});
