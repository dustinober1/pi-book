import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGuideScreen } from "../src/application/guide.js";
import { bookPlanPrompt, premisePlanPrompt } from "../src/application/prompts.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { defaultTasteProfile } from "../src/domain/v1-3-schemas.js";
import { defaultDecisionLedger, defaultPremiseLab, type PremiseVariant } from "../src/domain/v1-4-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function variant(order: number): PremiseVariant {
  return {
    id: `PV-${String(order).padStart(3, "0")}`,
    order,
    title: `Version ${order}`,
    premise: `UNIQUE PREMISE PROSE ${order}: Mara follows the signal through engine ${order}.`,
    is_raw_idea_baseline: order === 1,
    preserved_seed_elements: ["Mara", "signal"],
    story_engine: `engine-${order}`,
    central_final_page_question: `Final question ${order}?`,
    immediate_gain: `Gain ${order}`,
    deferred_cost: `Cost ${order}`,
    irreversible_effect: `Effect ${order}`,
    differentiation: `Difference ${order}`,
    series_potential: `Potential ${order}`,
    accepted_tradeoffs: [`Tradeoff ${order}`],
    diagnostics: [`Observation ${order}`],
  };
}

function setup(selected = false) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-premise-prompts-"));
  const root = initializeProject(parent, { projectName: "Premise Prompts", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "book-planning";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const taste = defaultTasteProfile();
  taste.influences.push({ id: "INF-001", reference: "PRIVATE INFLUENCE NAME", influence_type: "structure", admired_for: ["pressure"], not_for: ["copying"], derived_traits: ["causal pressure"], status: "approved" });
  writeFileSync(join(root, "series", "taste-profile.yaml"), stringifyYaml(taste), "utf8");
  const lab = defaultPremiseLab("book-01");
  lab.raw_idea = "Mara follows a signal no one else can hear.";
  lab.seed_elements = ["Mara", "signal"];
  lab.variants = [1, 2, 3].map(variant);
  const ledger = defaultDecisionLedger();
  if (selected) {
    ledger.decisions.push({ id: "DEC-001", scope: "book-01", subject: "premise-selection", choice: "PV-002", decidedAt: "2026-07-16T12:00:00Z", evidenceRefs: ["writer selection"], replaces: null });
    lab.selected_variant_id = "PV-002";
    lab.selection_decision_id = "DEC-001";
  }
  writeFileSync(join(root, "series", "decision-ledger.yaml"), stringifyYaml(ledger), "utf8");
  writeFileSync(join(root, "books", "book-01", "premise-lab.yaml"), stringifyYaml(lab), "utf8");
  return { parent, root };
}

test("premise generation prompt uses the raw seed but excludes private influence references and scoring", () => {
  const { parent, root } = setup(false);
  try {
    const prompt = premisePlanPrompt(root);
    assert.match(prompt, /Mara follows a signal no one else can hear/);
    assert.match(prompt, /Mara/);
    assert.match(prompt, /signal/);
    assert.match(prompt, /three to five/i);
    assert.match(prompt, /neutral diagnostic/i);
    assert.match(prompt, /premise-update/);
    assert.match(prompt, /writer.*select/i);
    assert.doesNotMatch(prompt, /PRIVATE INFLUENCE NAME/);
    assert.doesNotMatch(prompt, /highest score|automatic winner|rank the variants/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("book-plan prompt includes only the explicitly selected premise", () => {
  const { parent, root } = setup(true);
  try {
    const prompt = bookPlanPrompt(root);
    assert.match(prompt, /Selected premise/);
    assert.match(prompt, /UNIQUE PREMISE PROSE 2/);
    assert.match(prompt, /Gain 2/);
    assert.match(prompt, /Cost 2/);
    assert.doesNotMatch(prompt, /UNIQUE PREMISE PROSE 1|UNIQUE PREMISE PROSE 3/);
    assert.doesNotMatch(prompt, /PRIVATE INFLUENCE NAME/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("unselected premise lab produces a compare-and-select guide action", () => {
  const { parent, root } = setup(false);
  try {
    const screen = buildGuideScreen(root);
    const premise = screen.actions.find((action) => action.id === "premise");
    assert.ok(premise);
    assert.match(premise.label, /premise/i);
    assert.equal(screen.primary.id, "continue");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter drafting context does not load selected or nonselected premise prose", () => {
  const { parent, root } = setup(true);
  try {
    const book = join(root, "books", "book-01");
    writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, act: "I", causality: "therefore", state_change: "door locks", setup_ids: [], payoff_ids: [], profile_obligations: [] }] }), "utf8");
    writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "Act I", packets: [{ chapter: 1, title: "Opening", status: "ready", pov: "Mara", purpose: "force choice", scene_engine: "pursuit", pressure_movement: "rises", character_movement: "commits", relationship_movement: "", story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"], required_research: [], profile_fields: { threat_delta: "+1", evidence_delta: "EV-1", reader_forecast_change: "inside job", protagonist_choice: "stays" }, ending_hook: "lock engages", milestone_gate: null, target_words: 2000 }] }), "utf8");
    const context = buildChapterContext(root, 1, 72000);
    assert.doesNotMatch(context.text, /UNIQUE PREMISE PROSE|Selected premise|Final question/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
