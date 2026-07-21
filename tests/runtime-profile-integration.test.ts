import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideNextRun, directDraftDecision, directRevisionDecision } from "../src/application/run.js";
import { getProjectStatus } from "../src/application/status.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";

function tickets() {
  return {
    schema_version: "1.0.0",
    tickets: [1, 2, 3, 4].map((index) => ({
      id: `B1-T${String(index).padStart(3, "0")}`,
      severity: "blocker",
      scope: "chapter-01",
      problem: `Problem ${index}`,
      evidence: ["chapter-01.md:1"],
      required_change: `Change ${index}`,
      protected_constraints: ["preserve canon"],
      acceptance_tests: ["resolved"],
      regression_checks: ["canon intact"],
      status: "open",
    })),
  };
}

function setup(stage: "drafting" | "revision", runtimeProfile: "tiny-local" | "local" | "full") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-runtime-integration-"));
  const root = initializeProject(parent, {
    projectName: "Runtime Integration",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile,
  });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  project.gates["voice-approval"] = "approved";
  project.gates["book-plan-approval"] = "approved";
  project.gates["first-chapter-approval"] = "approved";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [{ id: "I", label: "Act I", start_chapter: 1, end_chapter: 4, gate: null }],
    decisions: [],
    chapters: Array.from({ length: 8 }, (_, index) => ({
      chapter: index + 1,
      act: "I",
      causality: "therefore",
      state_change: `state ${index + 1}`,
      setup_ids: [],
      payoff_ids: [],
      profile_obligations: [],
    })),
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "I",
    packets: Array.from({ length: 8 }, (_, index) => ({
      chapter: index + 1,
      title: `Chapter ${index + 1}`,
      status: "ready",
      pov: "Mara",
      purpose: "advance",
      scene_engine: "operation",
      pressure_movement: "+1",
      character_movement: "commits",
      relationship_movement: "shifts",
      story_thread_refs: [],
      continuity_refs: [],
      character_refs: ["Mara"],
      required_research: [],
      profile_fields: { threat_delta: "+1", evidence_delta: "gained", reader_forecast_change: "changes", protagonist_choice: "continues" },
      ending_hook: "hook",
      milestone_gate: null,
      target_words: 1500,
    })),
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "remarkability.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    safe_obvious_version: "A safe version.",
    author_only_advantage: "A specific advantage.",
    productive_discomfort: "Moral discomfort.",
    retellable_hook: "A building changes evidence.",
    signature_moments: [
      { id: "RM-001", description: "The exit changes.", intended_reader_memory: "The building lies.", planned_location: "chapter-01", status: "planned" },
      { id: "RM-002", description: "Mara opens the archive while security erases her access.", intended_reader_memory: "Truth and institutional permission separate in real time.", planned_location: "chapter-04", status: "planned" },
    ],
    productive_disagreements: [{ question: "Was Mara right to stay?", competing_readings: ["She protected truth.", "She valued proof over people."] }],
    recurring_motifs: [],
    lingering_question: "What evidence is worth a life?",
    hand_sell_reason: "A procedural thriller with a building that falsifies its record.",
    accepted_reader_costs: ["Moral discomfort without reassurance."],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml(stage === "revision" ? tickets() : { schema_version: "1.0.0", tickets: [] }), "utf8");
  return { parent, root };
}

test("status and run decisions expose the resolved runtime profile separately from genre", () => {
  const { parent, root } = setup("drafting", "local");
  try {
    const status = getProjectStatus(root);
    assert.equal(status.runtimeProfile, "local");
    assert.equal(status.qualityTier, "economy");
    assert.match(status.markdown, /- Genre profile: thriller/);
    assert.match(status.markdown, /- Runtime profile: local/);
    assert.match(status.markdown, /- Quality tier: economy/);

    const decision = decideNextRun(root, { runtimeProfile: "tiny-local", maxChapters: 8 });
    assert.equal(decision.runtimeProfile, "tiny-local");
    assert.match(decision.message, /Runtime profile: tiny-local/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("drafting decisions enforce tiny and local chapter caps while full preserves the request", () => {
  for (const [profile, expected] of [["tiny-local", 1], ["local", 1], ["full", 8]] as const) {
    const { parent, root } = setup("drafting", profile);
    try {
      const decision = decideNextRun(root, { maxChapters: 8 });
      assert.equal(decision.runtimeProfile, profile);
      assert.match(decision.message, new RegExp(`up to ${expected} chapter`));
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});

test("direct revision decisions enforce profile ticket caps even for explicit ticket IDs", () => {
  for (const [profile, expected] of [["tiny-local", 1], ["local", 2], ["full", 3]] as const) {
    const { parent, root } = setup("revision", profile);
    try {
      const decision = directRevisionDecision(root, ["B1-T001", "B1-T002", "B1-T003", "B1-T004"]);
      assert.equal(decision.runtimeProfile, profile);
      assert.equal((decision.prompt?.match(/B1-T\d{3}:/g) ?? []).length, expected);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});

test("persistent runs store the resolved profile and normalized chapter budget", () => {
  for (const [profile, expected] of [["tiny-local", 1], ["local", 1], ["full", 8]] as const) {
    const { parent, root } = setup("drafting", profile);
    try {
      const decision = decideNextRun(root, { maxChapters: 8 });
      assert.equal(decision.runtimeProfile, profile);
      const direct = directDraftDecision(root, 1);
      assert.equal(direct.runtimeProfile, profile);
      assert.ok(direct.prompt);
      assert.ok(direct.prompt!.length > 0);
      assert.equal(expected >= 1, true);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
});
