import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject } from "../src/project/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { defaultTasteProfile, defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-context-")); }

function prepareReadyChapter(root: string): void {
  const book = join(root, "books", "book-01");
  writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 1, act: "I", causality: "therefore", state_change: "door locks", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "Act I",
    packets: [{
      chapter: 1,
      title: "Locked Room",
      status: "ready",
      pov: "Mara",
      purpose: "force escape",
      scene_engine: "physical pursuit",
      pressure_movement: "threat enters room",
      character_movement: "Mara chooses evidence over safety",
      relationship_movement: "",
      story_thread_refs: [],
      continuity_refs: [],
      character_refs: ["Mara"],
      required_research: [],
      profile_fields: { threat_delta: "+2", evidence_delta: "EV-1", reader_forecast_change: "inside job", protagonist_choice: "stays" },
      ending_hook: "second lock engages",
      milestone_gate: "first-chapter-approval",
      target_words: 2500,
    }],
  }), "utf8");
}

function tasteWithPrivateReference() {
  const taste = defaultTasteProfile();
  taste.influences.push({
    id: "INF-001",
    reference: "Example Author — Example Book",
    influence_type: "voice",
    admired_for: ["compression"],
    not_for: ["signature phrasing"],
    derived_traits: ["compressed interiority"],
    status: "approved",
  });
  return taste;
}

test("chapter context includes explicit and graph-discovered continuity while blocking unsafe records", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Context Test", projectType: "planned-series", profile: "thriller" });
    const book = join(root, "books", "book-01");
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [
      { id: "CAN-1", category: "injury", subject: "Mara", fact: "left wrist sprained", source: "chapter-01", status: "locked", introduced_in: "book-01" },
      { id: "CAN-2", category: "secret", subject: "Unrelated", fact: "unrelated provisional fact", source: "plan", status: "provisional", introduced_in: null },
      { id: "CAN-3", category: "injury", subject: "Mara", fact: "right knee bruised", source: "chapter-01", status: "locked", introduced_in: "book-01" },
      { id: "CAN-D", category: "uncertainty", subject: "Mara", fact: "directly requested provisional observation", source: "chapter-plan", status: "provisional", introduced_in: null },
      { id: "CAN-P", category: "secret", subject: "Mara", fact: "unreferenced provisional theory", source: "plan", status: "provisional", introduced_in: null },
      { id: "CAN-F", category: "future", subject: "Mara", fact: "later-book revelation", source: "series-plan", status: "locked", introduced_in: "book-02" },
    ], relationships: [] }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [
      { id: "ST-1", type: "mystery", setup: "missing device", reader_knows: "stolen", characters_know: { lead: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null },
      { id: "ST-2", type: "future", setup: "unrelated", reader_knows: "none", characters_know: {}, status: "planned", intended_payoff: "book-03", last_advanced_in: null },
      { id: "ST-3", type: "mystery", setup: "altered evacuation log", reader_knows: "the log changed", characters_know: { Mara: "suspicious" }, status: "advanced", intended_payoff: "book-01", last_advanced_in: "chapter-01" },
    ] }), "utf8");
    writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({ schema_version: "1.0.0", sources: [
      { id: "SRC-1", type: "reference", title: "Sports medicine notes", location: "research/injuries.md", verified_on: "2026-07-14", supports: ["CAN-3"], notes: "bruise mobility constraints" },
    ] }), "utf8");
    writeFileSync(join(book, "remarkability.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      safe_obvious_version: "A routine locked-room escape.",
      author_only_advantage: "Institutional shame rendered through physical procedure.",
      productive_discomfort: "Mara may preserve evidence at an unforgivable human cost.",
      retellable_hook: "A security auditor discovers the building is editing its own evacuation record.",
      signature_moments: [{ id: "RM-1", description: "The exit sign changes its testimony", intended_reader_memory: "The building lies in plain sight", planned_location: "chapter-01", status: "planned" }],
      productive_disagreements: [{ question: "Was Mara right to stay?", competing_readings: ["She protected the truth", "She valued proof over people"] }],
      recurring_motifs: [],
      lingering_question: "What evidence is worth a life?",
      hand_sell_reason: "A procedural thriller with a building that falsifies the record around its occupants.",
      accepted_reader_costs: ["Moral discomfort without immediate reassurance"],
    }), "utf8");
    writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, act: "I", causality: "therefore", state_change: "door locks", setup_ids: ["ST-1"], payoff_ids: [], profile_obligations: [] }] }), "utf8");
    writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "Act I", packets: [{
      chapter: 1, title: "Locked Room", status: "ready", pov: "Mara", purpose: "force escape", scene_engine: "physical pursuit",
      pressure_movement: "threat enters room", character_movement: "Mara chooses evidence over safety", relationship_movement: "",
      story_thread_refs: ["ST-1"], continuity_refs: ["CAN-1", "CAN-D"], character_refs: ["Mara"], required_research: [],
      profile_fields: { threat_delta: "+2", evidence_delta: "EV-1", reader_forecast_change: "inside job", protagonist_choice: "stays" },
      ending_hook: "second lock engages", milestone_gate: "first-chapter-approval", target_words: 2500,
    }] }), "utf8");

    const context = buildChapterContext(root);

    assert.match(context.text, /CAN-1/);
    assert.match(context.text, /CAN-3/);
    assert.match(context.text, /CAN-D/);
    assert.doesNotMatch(context.text, /CAN-2/);
    assert.doesNotMatch(context.text, /CAN-P/);
    assert.doesNotMatch(context.text, /CAN-F/);
    assert.match(context.text, /ST-1/);
    assert.match(context.text, /ST-3/);
    assert.doesNotMatch(context.text, /ST-2/);
    assert.match(context.text, /Graph-selected research provenance/);
    assert.match(context.text, /SRC-1/);
    assert.match(context.text, /editing its own evacuation record/);
    assert.match(context.text, /exit sign changes its testimony/i);

    const discovered = context.report.graph.selections.find((item) => item.refId === "CAN-3");
    assert.ok(discovered);
    assert.equal(discovered.reason, "graph-discovered");
    assert.deepEqual(discovered.path, ["character:mara", "canon-fact:CAN-3"]);
    assert.equal(context.report.graph.blocked.find((item) => item.refId === "CAN-P")?.reason, "provisional");
    assert.equal(context.report.graph.blocked.find((item) => item.refId === "CAN-F")?.reason, "future-book");
    assert.ok(context.report.included.includes("graph canon CAN-3"));
    assert.ok(context.report.excluded.includes("future books"));
    assert.ok(context.report.excluded.includes("graph-blocked unsafe records"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter context includes neutral approved guardrails but excludes private references and experiments", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Guardrail Context", projectType: "standalone", profile: "thriller" });
    prepareReadyChapter(root);
    writeFileSync(join(root, "series", "taste-profile.yaml"), stringifyYaml(tasteWithPrivateReference()), "utf8");
    writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
      ...defaultVoiceGuardrails(),
      must: ["concrete sensory detail"],
      prefer: ["compressed interiority"],
      avoid: ["ornamental metaphors"],
      monitor: ["paragraph density"],
      pov_signatures: [{ id: "mara", pov: "Mara", must: ["notice procedure before emotion"], prefer: [], avoid: [] }],
    }), "utf8");
    writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\nUse compressed interiority and concrete sensory detail.\n", "utf8");

    const context = buildChapterContext(root, 1, 72000);
    assert.match(context.text, /Approved voice guardrails/);
    assert.match(context.text, /PREFER: compressed interiority/);
    assert.match(context.text, /POV MUST: notice procedure before emotion/);
    assert.doesNotMatch(context.text, /Example Author|Example Book/);
    assert.ok(context.report.included.includes("approved voice guardrails"));
    assert.ok(context.report.excluded.includes("raw influence references"));
    assert.ok(context.report.excluded.includes("voice experiment source and variants"));
    assert.ok(context.report.estimatedTokens <= 18000);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("chapter context blocks unsafe existing guardrails instead of leaking them", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Unsafe Guardrails", projectType: "standalone", profile: "thriller" });
    prepareReadyChapter(root);
    writeFileSync(join(root, "series", "taste-profile.yaml"), stringifyYaml(tasteWithPrivateReference()), "utf8");
    writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({ ...defaultVoiceGuardrails(), prefer: ["Use Example Book pacing"] }), "utf8");
    assert.throws(() => buildChapterContext(root, 1), /voice originality|raw influence|unsafe/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
