import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanPrompt, reviewPrompt } from "../src/application/prompts.js";
import { ContextBudgetError } from "../src/context/context-budget.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { defaultHistoricalContext, defaultInventionLedger } from "../src/domain/historical-fiction.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-historical-context-"));
}

function readyResearch(id: string, sourceId: string, chapter: number) {
  return {
    id, lane: "story-world", claim: `${id} bounded historical claim`, source_ids: [sourceId],
    confidence: "high", verified_on: "2026-07-18", risk: ["historical"],
    dramatic_uses: ["procedural-constraint"], status: "ready",
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    story_use: { chapters: [chapter], decision_affected: `${id} changes the route.` }, notes: "",
  } as const;
}

function prepareHistoricalChapter(root: string): void {
  const bookRoot = join(root, "books/book-01");
  const context = defaultHistoricalContext("book-01");
  context.temporal_scope = "Paris, February 1848";
  context.geographic_scope = "Paris";
  context.calendar = "Gregorian display dates";
  context.chronology.push(
    {
      id: "HIST-001", sequence: 1, display_date: "24 February 1848", certainty: "documented",
      event: "The monarchy falls.", source_ids: ["SRC-001"], research_ids: ["RES-001"],
      story_effect: "Lucie's travel papers lose authority.", uncertainty: "", invention_ref: null,
    },
    {
      id: "HIST-999", sequence: 2, display_date: "25 February 1848", certainty: "documented",
      event: "An unrelated ministry reorganizes.", source_ids: ["SRC-999"], research_ids: ["RES-999"],
      story_effect: "No effect on this chapter.", uncertainty: "", invention_ref: null,
    },
  );
  context.constraints.push(
    {
      id: "HC-001", category: "transport", statement: "Barricades block carriage routes.",
      dramatic_consequence: "Lucie crosses on foot.", source_ids: ["SRC-001"], research_ids: ["RES-001"],
      risk: "medium", confidence: "high",
    },
    {
      id: "HC-999", category: "economic", statement: "An unrelated tax changes wholesale prices.",
      dramatic_consequence: "No effect on this chapter.", source_ids: ["SRC-999"], research_ids: ["RES-999"],
      risk: "low", confidence: "high",
    },
  );
  context.knowledge_boundaries.push(
    {
      id: "KB-001", character_or_group: "Lucie", as_of: "HIST-001",
      known: ["The palace is abandoned."], believed: ["The western road remains open."],
      mistaken: [], cannot_yet_know: ["The king has abdicated."], research_ids: ["RES-001"],
    },
    {
      id: "KB-999", character_or_group: "A distant minister", as_of: "HIST-999",
      known: ["The ministry is reorganizing."], believed: [], mistaken: [], cannot_yet_know: [],
      research_ids: ["RES-999"],
    },
  );
  context.language_conventions = {
    dialogue_translation: "Readable English represents spoken French.",
    period_flavor: "Formal address marks class and familiarity.",
    prohibited_modern_idioms: ["process your feelings"],
    prohibited_faux_archaism: ["forsooth"],
  };
  writeFileSync(join(bookRoot, "historical-context.yaml"), stringifyYaml(context), "utf8");

  const ledger = defaultInventionLedger("book-01");
  ledger.entries.push(
    {
      id: "INV-001", claim: "Lucie crosses a private courtyard.", classification: "invented", risk: "low",
      source_ids: [], research_ids: [], rationale: "The household is fictional.",
      story_necessity: "Routes her around the barricade.", affected_chapters: [1], portrayal_risks: [],
      continuity_risks: [], disclosure: "none", writer_decision_id: null, major_counterfactual: false,
    },
    {
      id: "INV-999", claim: "A distant minister misses breakfast.", classification: "invented", risk: "low",
      source_ids: [], research_ids: [], rationale: "Private action is undocumented.",
      story_necessity: "Supports an unrelated later chapter.", affected_chapters: [2], portrayal_risks: [],
      continuity_risks: [], disclosure: "none", writer_decision_id: null, major_counterfactual: false,
    },
  );
  writeFileSync(join(bookRoot, "invention-ledger.yaml"), stringifyYaml(ledger), "utf8");

  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [], decisions: [], chapters: [
      { chapter: 1, act: "I", causality: "Because the route closes, Lucie enters the courtyard.", state_change: "She is trapped inside the district.", setup_ids: [], payoff_ids: [], profile_obligations: [] },
      { chapter: 2, act: "I", causality: "Therefore", state_change: "Later change", setup_ids: [], payoff_ids: [], profile_obligations: [] },
    ],
  }), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0", active_window: "Act I", packets: [{
      chapter: 1, title: "The Barricade", status: "ready", pov: "Lucie", purpose: "cross the city",
      scene_engine: "journey", pressure_movement: "the safe route closes", character_movement: "Lucie acts",
      relationship_movement: "trust strains", story_thread_refs: [], continuity_refs: [], character_refs: [],
      required_research: ["RES-001"], profile_fields: {
        historical_risk: "high", chronology_refs: ["HIST-001"], constraint_refs: ["HC-001"],
        invention_refs: ["INV-001"], knowledge_boundary: "KB-001",
        historical_pressure: "Barricades make the direct route impossible.",
        material_world: "Broken paving stones become fortifications.",
      }, ending_hook: "The courtyard gate is chained.", milestone_gate: null, target_words: 2500,
    }],
  }), "utf8");
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    items: [readyResearch("RES-001", "SRC-001", 1), readyResearch("RES-999", "SRC-999", 2)],
  }), "utf8");
  writeFileSync(join(root, "research/source-register.yaml"), stringifyYaml({
    schema_version: "1.0.0", sources: [
      { id: "SRC-001", type: "book", title: "Relevant history", location: "library", verified_on: "2026-07-18", supports: ["RES-001"], notes: "", reliability: "high", observed_on: null, supports_research_ids: ["RES-001"] },
      { id: "SRC-999", type: "book", title: "Unrelated history", location: "library", verified_on: "2026-07-18", supports: ["RES-999"], notes: "", reliability: "high", observed_on: null, supports_research_ids: ["RES-999"] },
    ],
  }), "utf8");
}

test("historical drafting context includes only packet-referenced historical evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Bounded History", projectType: "standalone", profile: "historical-fiction" });
    prepareHistoricalChapter(root);
    const context = buildChapterContext(root, 1);
    assert.match(context.text, /Historical scene contract/);
    for (const id of ["HIST-001", "HC-001", "KB-001", "INV-001", "RES-001", "SRC-001"]) assert.match(context.text, new RegExp(id));
    for (const id of ["HIST-999", "HC-999", "KB-999", "INV-999", "RES-999", "SRC-999"]) assert.doesNotMatch(context.text, new RegExp(id));
    assert.match(context.text, /Readable English represents spoken French/);
    assert.ok(context.report.included.includes("historical chronology HIST-001"));
    assert.ok(context.report.excluded.includes("unreferenced historical chronology"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical required-record overflow names every referenced evidence ID", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Historical Overflow", projectType: "standalone", profile: "historical-fiction" });
    prepareHistoricalChapter(root);
    assert.throws(
      () => buildChapterContext(root, 1, 100),
      (error: unknown) => {
        assert.ok(error instanceof ContextBudgetError);
        for (const id of ["HIST-001", "HC-001", "KB-001", "INV-001", "RES-001", "SRC-001"]) {
          assert.ok(error.requiredRecordIds.includes(id), `missing historical overflow ID ${id}`);
        }
        return true;
      },
    );
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("historical planning and review prompts name the guarded contract", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Plan History", projectType: "standalone", profile: "historical-fiction" });
    const planning = bookPlanPrompt(root);
    assert.match(planning, /historical-context\.yaml/);
    assert.match(planning, /invention-ledger\.yaml/);
    assert.match(planning, /high[- ]risk/i);
    assert.match(planning, /historical-invention:INV-NNN/);
    const review = reviewPrompt(root, "manuscript");
    assert.match(review, /anachronism/i);
    assert.match(review, /portrayal/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
