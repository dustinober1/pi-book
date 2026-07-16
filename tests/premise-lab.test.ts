import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  PremiseLabSchema,
  defaultDecisionLedger,
  defaultPremiseLab,
  type DecisionLedger,
  type PremiseLab,
  type PremiseVariant,
} from "../src/domain/v1-4-schemas.js";
import {
  premiseComparison,
  premiseLabFindings,
  selectPremise,
  selectedPremiseContext,
} from "../src/application/premise-lab.js";
import { v14SchemaForPath } from "../src/domain/v1-4-schema-registry.js";

function variant(order: number, engine = `engine-${order}`): PremiseVariant {
  return {
    id: `PV-${String(order).padStart(3, "0")}`,
    order,
    title: `Variant ${order}`,
    premise: `Mara follows the signal through structural version ${order}.`,
    is_raw_idea_baseline: order === 1,
    preserved_seed_elements: ["Mara", "signal"],
    story_engine: engine,
    central_final_page_question: `What does Mara choose at the end of version ${order}?`,
    immediate_gain: `Immediate gain ${order}`,
    deferred_cost: `Deferred cost ${order}`,
    irreversible_effect: `Irreversible effect ${order}`,
    differentiation: `Differentiation ${order}`,
    series_potential: `Series potential ${order}`,
    accepted_tradeoffs: [`Tradeoff ${order}`],
    diagnostics: [`Observation ${order}`],
  };
}

function lab(count = 3): PremiseLab {
  return {
    schema_version: "1.0.0",
    book_id: "book-01",
    raw_idea: "Mara follows a signal no one else can hear.",
    seed_elements: ["Mara", "signal"],
    variants: Array.from({ length: count }, (_, index) => variant(index + 1)),
    selected_variant_id: null,
    selection_decision_id: null,
  };
}

function ledger(): DecisionLedger {
  const value = defaultDecisionLedger();
  value.decisions.push({
    id: "DEC-001",
    scope: "book-01",
    subject: "premise-selection",
    choice: "PV-002",
    decidedAt: "2026-07-16T12:00:00Z",
    evidenceRefs: ["writer selection"],
    replaces: null,
  });
  return value;
}

test("default premise lab is strict empty book evidence and registry recognizes the path", () => {
  const value = defaultPremiseLab("book-01");
  assert.deepEqual(value, {
    schema_version: "1.0.0",
    book_id: "book-01",
    raw_idea: "",
    seed_elements: [],
    variants: [],
    selected_variant_id: null,
    selection_decision_id: null,
  });
  assert.doesNotThrow(() => parseYaml(stringifyYaml(value), PremiseLabSchema, "premise-lab.yaml"));
  assert.equal(v14SchemaForPath("books/book-01/premise-lab.yaml"), PremiseLabSchema);
});

test("three to five variants are required once the lab is populated", () => {
  assert.ok(premiseLabFindings(lab(2)).some((finding) => finding.code === "premise-variant-count"));
  assert.ok(premiseLabFindings(lab(6)).some((finding) => finding.code === "premise-variant-count"));
  assert.deepEqual(premiseLabFindings(lab(3)), []);
  assert.deepEqual(premiseLabFindings(lab(5)), []);
});

test("raw baseline order IDs and story engines are unique and contiguous", () => {
  const duplicateId = lab();
  duplicateId.variants[1]!.id = "PV-001";
  assert.ok(premiseLabFindings(duplicateId).some((finding) => finding.code === "duplicate-premise-id"));

  const duplicateOrder = lab();
  duplicateOrder.variants[1]!.order = 1;
  assert.ok(premiseLabFindings(duplicateOrder).some((finding) => finding.code === "premise-order"));

  const duplicateEngine = lab();
  duplicateEngine.variants[1]!.story_engine = " Engine 1! ";
  assert.ok(premiseLabFindings(duplicateEngine).some((finding) => finding.code === "duplicate-story-engine"));

  const missingBaseline = lab();
  missingBaseline.variants[0]!.is_raw_idea_baseline = false;
  assert.ok(premiseLabFindings(missingBaseline).some((finding) => finding.code === "raw-idea-baseline"));

  const lateBaseline = lab();
  lateBaseline.variants[0]!.is_raw_idea_baseline = false;
  lateBaseline.variants[1]!.is_raw_idea_baseline = true;
  assert.ok(premiseLabFindings(lateBaseline).some((finding) => finding.code === "raw-idea-baseline"));
});

test("every populated variant preserves all seed elements and complete structural evidence", () => {
  const missingSeed = lab();
  missingSeed.variants[1]!.preserved_seed_elements = ["Mara"];
  assert.ok(premiseLabFindings(missingSeed).some((finding) => finding.code === "missing-seed-element"));

  const blank = lab();
  blank.variants[1]!.deferred_cost = "";
  assert.ok(premiseLabFindings(blank).some((finding) => finding.code === "incomplete-premise-variant"));

  const noRawIdea = lab();
  noRawIdea.raw_idea = "";
  assert.ok(premiseLabFindings(noRawIdea).some((finding) => finding.code === "missing-raw-idea"));
});

test("strict schema rejects score rank winner and recommendation fields", () => {
  const value = lab() as PremiseLab & { winner?: string; variants: Array<PremiseVariant & { score?: number }> };
  value.winner = "PV-003";
  value.variants[0]!.score = 99;
  assert.throws(() => parseYaml(stringifyYaml(value), PremiseLabSchema, "premise-lab.yaml"));
});

test("selection fields are paired and must match an exact active writer decision", () => {
  const half = lab();
  half.selected_variant_id = "PV-002";
  assert.ok(premiseLabFindings(half, ledger()).some((finding) => finding.code === "partial-premise-selection"));

  const unknown = lab();
  unknown.selected_variant_id = "PV-404";
  unknown.selection_decision_id = "DEC-001";
  assert.ok(premiseLabFindings(unknown, ledger()).some((finding) => finding.code === "unknown-selected-premise"));

  const noDecision = lab();
  noDecision.selected_variant_id = "PV-002";
  noDecision.selection_decision_id = "DEC-001";
  assert.ok(premiseLabFindings(noDecision, defaultDecisionLedger()).some((finding) => finding.code === "unauthorized-premise-selection"));

  const selected = selectPremise(lab(), ledger(), "PV-002", "DEC-001");
  assert.equal(selected.selected_variant_id, "PV-002");
  assert.equal(selected.selection_decision_id, "DEC-001");
  assert.deepEqual(premiseLabFindings(selected, ledger()), []);
});

test("selected context contains only the chosen variant and comparison claims no winner", () => {
  const selected = selectPremise(lab(), ledger(), "PV-002", "DEC-001");
  const context = selectedPremiseContext(selected);
  assert.match(context, /Selected premise/);
  assert.match(context, /Variant 2/);
  assert.match(context, /structural version 2/);
  assert.doesNotMatch(context, /structural version 1|structural version 3/);

  const comparison = premiseComparison(lab());
  assert.equal(comparison.length, 3);
  assert.deepEqual(comparison[0], { id: "PV-001", engine: "engine-1", observations: ["Observation 1"] });
  assert.doesNotMatch(JSON.stringify(comparison), /winner|recommended|score|rank/i);
});
