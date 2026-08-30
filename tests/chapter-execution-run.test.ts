import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chapterExecutionReadiness, runChapterExecution } from "../src/application/chapter-execution-run.js";
import { summarizeJourneyVelocity } from "../src/application/journey-trace.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { readJourneyTrace } from "../src/infrastructure/journey-trace-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

const runId = "RUN-DRIVER-001";
const sceneId = "CH-001-SC-01-V1";

function packet() {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "begin",
    scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["CAN-ACCESS"],
    character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "none", reader_forecast_change: "threat is real", protagonist_choice: "acts" },
    ending_hook: "danger", milestone_gate: null, target_words: 1000,
  };
}

function setup(overrides: { gatePending?: boolean } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-driver-"));
  const root = initializeProject(parent, {
    projectName: "Driver Loop", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "host-default",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = overrides.gatePending ? "first-chapter-approval" : null;
  if (overrides.gatePending) project.gates["first-chapter-approval"] = "pending";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: ["Keep cause and effect legible."], prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."], monitor: [], baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0", facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The terminal credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }], relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "access is tested", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet()] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Reach the terminal.", required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: [], required_record_ids: ["CAN-ACCESS"], start_state_ids: [], required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
    target_words: { minimum: 300, maximum: 360 }, ending_hook: "Mara reaches the terminal unseen.",
    small_model_ready: true, missing_small_model_fields: [],
  }), "utf8");
  return { parent, root };
}

const planOutput = {
  schema_version: "1.0.0",
  steps: [
    { required_beat: "Enter the archive", execution: "Mara enters through the maintenance threshold.", pressure: "A patrol cycle narrows the window." },
    { required_beat: "Discover revoked access", execution: "The terminal rejects her credential.", pressure: "The failure may log her presence." },
  ],
  turn_execution: "She notices a conduit beneath the reader.", ending_execution: "She reaches the terminal unseen.",
  evidence_record_ids: ["CAN-ACCESS"],
};
const baseDraft = Array.from({ length: 320 }, (_, index) => index % 16 === 15 ? `checkpoint${index + 1}.` : `word${index + 1}`).join(" ");

function usage(request: QualityWorkerRequest): QualityWorkerResult["usage"] {
  return {
    callId: request.callId, stage: request.stage,
    ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
    ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
    ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
    pass: request.pass, ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
    estimated: true, elapsedMs: 5, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
  };
}

class CleanWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") return { text: JSON.stringify(planOutput), usage: usage(request) };
    if (request.jobType === "draft-scene") return { text: baseDraft, usage: usage(request) };
    if (request.jobType === "critic-continuity" || request.jobType === "critic-style") {
      return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    }
    if (request.jobType === "extract-state-delta") return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

const critics = ["critic-continuity", "critic-style"] as const;

test("one call drives a chapter from contract compile to guarded commit", async () => {
  const { parent, root } = setup();
  try {
    const worker = new CleanWorker();
    const observed: string[] = [];
    const run = await runChapterExecution({
      root, chapter: 1, runId, worker, requiredCriticJobTypes: critics,
      onStep: ({ action }) => { observed.push(action); },
    });
    assert.equal(run.stopReason, "complete");
    assert.equal(run.committed, true);
    assert.equal(run.state.status, "completed");
    // Exactly the sequence the one-step-at-a-time caller produces, unchanged.
    assert.deepEqual(run.actions, [
      "prepared", "chapter-contract-compiled", "scene-contracts-compiled", "context-built",
      "scene-planned", "scene-drafted", "scene-validated",
      "critic-completed", "critic-completed", "critic-review-finalized",
      "state-delta-extracted", "scene-accepted", "chapter-stitched", "chapter-validated", "chapter-committed",
    ]);
    // chapter-commit transitions straight to the terminal node, so the loop
    // stops on the committing step rather than spending one more on "complete".
    assert.equal(run.actions.at(-1), "chapter-committed");
    assert.deepEqual(observed, run.actions);
    assert.equal(run.state.accepted_scene_ids.includes(sceneId), true);
    // The loop adds no authority: acceptance still ends in the same guarded commit.
    assert.equal(existsSync(join(root, "books/book-01/manuscript/chapters")), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// Before this fix, commitValidatedChapter applied its guarded transaction
// through applyGuidedProjectEvent directly, bypassing the telemetry wrapper
// applyNovelEvent provides for the whole-chapter draft-chapter event. A book
// drafted end to end through guarded scene execution — the path this whole
// program exists to make reachable — left summarizeJourneyVelocity's
// chaptersCompleted at 0: the one number the small-model effort cares most
// about was silently unmeasurable for its own flagship path.
test("a guarded-scene chapter commit is recorded in the journey trace", async () => {
  const { parent, root } = setup();
  try {
    const run = await runChapterExecution({
      root, chapter: 1, runId, worker: new CleanWorker(), requiredCriticJobTypes: critics,
    });
    assert.equal(run.committed, true);
    const trace = readJourneyTrace(root);
    const guardedEvents = trace.filter((event) => event.type === "guarded-event");
    assert.equal(guardedEvents.length, 1);
    assert.deepEqual(guardedEvents[0], { type: "guarded-event", id: "E-001", action: "draft-chapter", outcome: "accepted", chapter: 1 });
    assert.equal(summarizeJourneyVelocity(trace).chaptersCompleted, 1);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the loop refuses to start on a pending writer gate", async () => {
  const { parent, root } = setup({ gatePending: true });
  try {
    await assert.rejects(
      () => runChapterExecution({ root, chapter: 1, runId, worker: new CleanWorker(), requiredCriticJobTypes: critics }),
      /Writer approval or repair is required|gate/i,
    );
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an empty critic selection is rejected rather than spun on", async () => {
  const { parent, root } = setup();
  try {
    await assert.rejects(
      () => runChapterExecution({ root, chapter: 1, runId, worker: new CleanWorker(), requiredCriticJobTypes: [] }),
      /at least one scene critic/i,
    );
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// advanceChapterExecutionStep returns awaiting-critic-review WITHOUT advancing
// when no critics are requested, so a naive loop spins here forever.
test("an undefined critic selection stops at awaiting-critic-selection instead of spinning", async () => {
  const { parent, root } = setup();
  try {
    const run = await runChapterExecution({ root, chapter: 1, runId, worker: new CleanWorker() });
    assert.equal(run.stopReason, "awaiting-critic-selection");
    assert.equal(run.state.current_node, "critic-review");
    assert.equal(run.state.status, "active");
    assert.ok(run.steps < 20, `settled in ${run.steps} steps rather than spinning`);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a worker that never satisfies validation stops at the repair limit, not the ceiling", async () => {
  const { parent, root } = setup();
  try {
    class NeverPassesWorker extends CleanWorker {
      patches = 0;
      override async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
        if (request.jobType === "draft-scene") return { text: `Here is the scene. ${baseDraft}`, usage: usage(request) };
        if (request.jobType === "patch-spans") {
          this.patches += 1;
          // Each attempt edits a different untouched checkpoint token, so the
          // prose really changes (a no-op patch is rejected outright) while the
          // leading meta-commentary the validator blocks on is never removed.
          const anchor = `checkpoint${this.patches * 16}.`;
          return { text: JSON.stringify({
            schema_version: "1.0.0",
            operations: [{
              operation: "replace",
              anchor_quote: anchor,
              replacement: `${anchor.slice(0, -1)} revised.`,
              finding_refs: ["deterministic:meta-commentary"],
            }],
          }), usage: usage(request) };
        }
        return super.run(request);
      }
    }
    const run = await runChapterExecution({ root, chapter: 1, runId, worker: new NeverPassesWorker(), requiredCriticJobTypes: critics });
    assert.equal(run.stopReason, "blocked");
    assert.equal(run.state.blocker?.code, "repair-limit");
    assert.equal(run.committed, false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the step ceiling is a backstop that reports itself rather than looping", async () => {
  const { parent, root } = setup();
  try {
    const run = await runChapterExecution({
      root, chapter: 1, runId, worker: new CleanWorker(), requiredCriticJobTypes: critics, maximumSteps: 3,
    });
    assert.equal(run.stopReason, "step-ceiling");
    assert.equal(run.steps, 3);
    assert.equal(run.committed, false);
    // Every visited node persisted, so the run resumes exactly where it stopped.
    assert.equal(readChapterExecutionState(root, runId)?.current_node, run.state.current_node);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an abort after a step stops the loop and preserves persisted progress", async () => {
  const { parent, root } = setup();
  try {
    const controller = new AbortController();
    let steps = 0;
    const run = await runChapterExecution({
      root, chapter: 1, runId, worker: new CleanWorker(), requiredCriticJobTypes: critics,
      signal: controller.signal,
      onStep: () => { steps += 1; if (steps === 2) controller.abort(); },
    });
    assert.equal(run.stopReason, "aborted");
    assert.equal(run.steps, 2);
    assert.equal(run.committed, false);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, run.state.current_node);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a resumed loop finishes a chapter that an earlier ceiling interrupted", async () => {
  const { parent, root } = setup();
  try {
    const worker = new CleanWorker();
    const first = await runChapterExecution({
      root, chapter: 1, runId, worker, requiredCriticJobTypes: critics, maximumSteps: 5,
    });
    assert.equal(first.stopReason, "step-ceiling");
    const second = await runChapterExecution({ root, chapter: 1, runId, worker, requiredCriticJobTypes: critics });
    assert.equal(second.stopReason, "complete");
    assert.equal(second.committed, true);
    // No node is replayed: the two runs together spend one plan and one draft.
    const jobs = worker.requests.map((request) => request.jobType);
    assert.equal(jobs.filter((job) => job === "plan-scene").length, 1);
    assert.equal(jobs.filter((job) => job === "draft-scene").length, 1);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// The routing claim of Phase 2: automation takes the guarded scene path when a
// contract exists, and says so when it does not. Before this, runPersistentQualityDraft
// never used the scene machine at all — it drafted whole chapters through the
// orchestrator, so critics, targeted repair and ordered acceptance never ran on
// the automated path regardless of whether a contract was available.
test("chapterExecutionReadiness routes on the contract, not on hope", () => {
  const { parent, root } = setup();
  try {
    const ready = chapterExecutionReadiness(root, "book-01", 1);
    assert.equal(ready.ready, true);
    assert.match(ready.reason, /CH-001/);

    // A contract that exists but is not executable routes to the other path and
    // names the missing fields, so the disclosure is specific.
    const contract = readFileSync(join(root, chapterContractPath("book-01", 1)), "utf8")
      .replace("small_model_ready: true", "small_model_ready: false")
      .replace("missing_small_model_fields: []", "missing_small_model_fields:\n  - start_state_ids");
    writeFileSync(join(root, chapterContractPath("book-01", 1)), contract, "utf8");
    const incomplete = chapterExecutionReadiness(root, "book-01", 1);
    assert.equal(incomplete.ready, false);
    assert.match(incomplete.reason, /not small-model ready/);
    assert.match(incomplete.reason, /start_state_ids/);

    // No contract at all is an ordinary routing answer, not a throw.
    rmSync(join(root, chapterContractPath("book-01", 1)));
    const missing = chapterExecutionReadiness(root, "book-01", 1);
    assert.equal(missing.ready, false);
    assert.match(missing.reason, /no executable chapter contract exists/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
