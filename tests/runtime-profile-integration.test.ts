import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beginPersistentRun, decideNextRun, directDraftDecision, directRevisionDecision } from "../src/application/run.js";
import { getProjectStatus } from "../src/application/status.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import type { RuntimeProfileId } from "../src/domain/runtime-profile.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture } from "./phase4-fixtures.js";

function tickets() {
  return {
    schema_version: "1.0.0",
    tickets: [1, 2, 3].map((number) => ({
      id: `B01-T${String(number).padStart(3, "0")}`,
      severity: "high",
      category: "continuity",
      chapter: number,
      evidence: `Chapter ${number} contradicts the locked state.`,
      problem: `Ticket ${number} problem.`,
      required_change: `Repair ticket ${number}.`,
      protected_constraints: ["Preserve the reveal order."],
      acceptance_tests: [`Ticket ${number} is resolved without changing canon.`],
      status: "open",
    })),
  };
}

function setup(stage: "drafting" | "revision", runtimeProfile: RuntimeProfileId) {
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
  project.automation.max_chapters_per_run = 8;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{
      id: "CAN-001",
      category: "access",
      subject: "Mara",
      fact: "Mara has archive access.",
      source: "chapter-00",
      status: "locked",
      introduced_in: "book-01",
    }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{
      id: "ST-001",
      type: "mystery",
      setup: "The archive log is missing.",
      reader_knows: "The log existed.",
      characters_know: { Mara: "The log is missing." },
      status: "open",
      intended_payoff: "book-01",
      last_advanced_in: null,
    }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queueFixture()), "utf8");
  writeFileSync(join(root, "books", "book-01", "remarkability.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    safe_obvious_version: "A routine archive breach.",
    author_only_advantage: "Institutional pressure rendered through procedure.",
    productive_discomfort: "Mara protects evidence before safety.",
    retellable_hook: "The building edits its own evacuation record.",
    signature_moments: [{
      id: "RM-001",
      description: "The exit sign changes its testimony.",
      intended_reader_memory: "The building lies in plain sight.",
      planned_location: "chapter-01",
      status: "planned",
    }],
    productive_disagreements: [{
      question: "Was Mara right to stay?",
      competing_readings: ["She protected truth.", "She valued proof over people."],
    }],
    recurring_motifs: [],
    lingering_question: "What evidence is worth a life?",
    hand_sell_reason: "A procedural thriller with a building that falsifies its record.",
    accepted_reader_costs: ["Moral discomfort without reassurance."],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), stringifyYaml(tickets()), "utf8");
  return { parent, root };
}

test("status and run decisions expose the resolved runtime profile separately from genre", () => {
  const { parent, root } = setup("drafting", "local");
  try {
    const status = getProjectStatus(root);
    assert.equal(status.runtimeProfile, "local");
    assert.match(status.markdown, /- Profile: thriller/);
    assert.match(status.markdown, /- Runtime profile: local/);

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
      assert.match(decision.prompt ?? "", new RegExp(`no more than ${expected} chapter workflow event`));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }
});

test("direct revision decisions enforce profile ticket caps even for explicit ticket IDs", () => {
  for (const [profile, included, excluded] of [
    ["tiny-local", ["B01-T001"], ["B01-T002", "B01-T003"]],
    ["local", ["B01-T001", "B01-T002"], ["B01-T003"]],
    ["full", ["B01-T001", "B01-T002", "B01-T003"], []],
  ] as const) {
    const { parent, root } = setup("revision", profile);
    try {
      const decision = directRevisionDecision(root, ["B01-T001", "B01-T002", "B01-T003"]);
      assert.equal(decision.runtimeProfile, profile);
      for (const id of included) assert.match(decision.prompt ?? "", new RegExp(id));
      for (const id of excluded) assert.doesNotMatch(decision.prompt ?? "", new RegExp(id));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }
});

test("persistent runs store the resolved profile and normalized chapter budget", () => {
  const { parent, root } = setup("drafting", "tiny-local");
  try {
    const decision = beginPersistentRun(root, {
      target: "next-milestone",
      maxChapters: 8,
      runtimeProfile: "tiny-local",
      now: "2026-07-16T20:00:00Z",
    });
    const run = readProject(root).automation.active_run;
    assert.equal(decision.runtimeProfile, "tiny-local");
    assert.equal(run?.requestedMaxChapters, 1);
    assert.equal(run?.runtimeProfile, "tiny-local");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("tiny-local drafting context uses its hard character budget and graph depth one", () => {
  const { parent, root } = setup("drafting", "tiny-local");
  try {
    const context = buildChapterContext(root, 1, 12_000, 1);
    assert.equal(context.report.graph.maxDepth, 1);
    assert.ok(context.text.length <= 12_000);
    assert.equal(directDraftDecision(root, 1).runtimeProfile, "tiny-local");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
