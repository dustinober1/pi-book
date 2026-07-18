import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  HistoricalContextSchema,
  InventionLedgerSchema,
  defaultHistoricalContext,
  defaultInventionLedger,
} from "../src/domain/historical-fiction.js";
import { v15SchemaForPath } from "../src/domain/v1-5-schema-registry.js";

function validContext() {
  return {
    ...defaultHistoricalContext("book-01"),
    temporal_scope: "Paris, February to June 1848",
    geographic_scope: "Paris and the road to Rouen",
    calendar: "Gregorian display dates; revolutionary references preserved in notes",
    chronology: [{
      id: "HIST-001",
      sequence: 1,
      display_date: "24 February 1848",
      certainty: "documented",
      event: "The monarchy falls after days of unrest.",
      source_ids: ["SRC-001"],
      research_ids: ["RES-001"],
      story_effect: "The household loses its patron and safe passage.",
      uncertainty: "",
      invention_ref: null,
    }],
    constraints: [{
      id: "HC-001",
      category: "transport",
      statement: "Barricades interrupt ordinary carriage routes.",
      dramatic_consequence: "The protagonist must cross the district on foot.",
      source_ids: ["SRC-001"],
      research_ids: ["RES-001"],
      risk: "medium",
      confidence: "high",
    }],
    knowledge_boundaries: [{
      id: "KB-001",
      character_or_group: "Lucie",
      as_of: "HIST-001",
      known: ["The palace has been abandoned."],
      believed: ["The army will restore order before nightfall."],
      mistaken: ["The northern road remains open."],
      cannot_yet_know: ["The king has abdicated."],
      research_ids: ["RES-001"],
    }],
  };
}

function validLedger() {
  return {
    ...defaultInventionLedger("book-01"),
    entries: [{
      id: "INV-001",
      claim: "Lucie crosses a private courtyard during the uprising.",
      classification: "invented",
      risk: "low",
      source_ids: [],
      research_ids: [],
      rationale: "No surviving record covers the fictional household.",
      story_necessity: "Moves her past a blocked public street.",
      affected_chapters: [1],
      portrayal_risks: [],
      continuity_risks: ["The courtyard must remain accessible in Chapter 3."],
      disclosure: "none",
      writer_decision_id: null,
      major_counterfactual: false,
    }],
  };
}

test("historical artifact defaults and complete documents satisfy strict schemas", () => {
  assert.equal(Value.Check(HistoricalContextSchema, defaultHistoricalContext("book-01")), true);
  assert.equal(Value.Check(InventionLedgerSchema, defaultInventionLedger("book-01")), true);
  assert.equal(Value.Check(HistoricalContextSchema, validContext()), true);
  assert.equal(Value.Check(InventionLedgerSchema, validLedger()), true);
});

test("historical schemas reject malformed IDs enums provenance and rationale", () => {
  const context = validContext();
  assert.equal(Value.Check(HistoricalContextSchema, {
    ...context,
    chronology: [{ ...context.chronology[0], id: "EVENT-1" }],
  }), false);
  assert.equal(Value.Check(HistoricalContextSchema, {
    ...context,
    chronology: [{ ...context.chronology[0], certainty: "documented", research_ids: [] }],
  }), false);
  assert.equal(Value.Check(HistoricalContextSchema, {
    ...context,
    constraints: [{ ...context.constraints[0], category: "fashion" }],
  }), false);

  const ledger = validLedger();
  assert.equal(Value.Check(InventionLedgerSchema, {
    ...ledger,
    entries: [{ ...ledger.entries[0], id: "I-1" }],
  }), false);
  assert.equal(Value.Check(InventionLedgerSchema, {
    ...ledger,
    entries: [{ ...ledger.entries[0], classification: "plausible" }],
  }), false);
  assert.equal(Value.Check(InventionLedgerSchema, {
    ...ledger,
    entries: [{ ...ledger.entries[0], rationale: "" }],
  }), false);
});

test("v1.5 registry recognizes only canonical historical artifact paths", () => {
  assert.equal(v15SchemaForPath("books/book-01/historical-context.yaml"), HistoricalContextSchema);
  assert.equal(v15SchemaForPath("./books/book-99/invention-ledger.yaml"), InventionLedgerSchema);
  assert.equal(v15SchemaForPath("historical-context.yaml"), null);
  assert.equal(v15SchemaForPath("books/not-a-book/historical-context.yaml"), null);
});
