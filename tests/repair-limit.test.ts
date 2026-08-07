import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceChapterExecutionStep } from "../src/application/chapter-execution-stepper.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../src/domain/runtime-profile.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

const sceneId = "CH-001-SC-01-V1";
const draftProse = `${Array.from({ length: 319 }, (_, index) => `word${index + 1}`).join(" ")} terminal-anchor`;

function setup(runtimeProfile: RuntimeProfileId) {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-repair-limit-"));
  const root = initializeProject(parent, {
    projectName: "Repair Limit", projectType: "standalone", profile: "thriller",
    runtimeProfile, modelExecutionProfile: "host-default",
  });
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0", must: ["Keep cause and effect legible."], prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."], monitor: [], baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0", entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0", records: [{
      id: "STATE-MARA-LOCATION", subject_id: "CHAR-MARA", field: "location", value: "LOC-CORRIDOR",
      status: "current-state", source: "chapter-00", introduced_in: "chapter-00", updated_in: "chapter-00", evidence_ids: ["C00-P001"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Reach the terminal.", required_beats: ["Enter the archive", "Reach the terminal"],
    active_thread_ids: [], required_record_ids: ["STATE-MARA-LOCATION"], start_state_ids: ["STATE-MARA-LOCATION"],
    required_end_state: [{ record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL" }],
    forbidden_changes: [], knowledge_boundary_ids: [], target_words: { minimum: 300, maximum: 360 },
    ending_hook: "Mara remains at the terminal.", small_model_ready: true, missing_small_model_fields: [],
  }), "utf8");
  return { parent, root };
}

function usage(request: QualityWorkerRequest): QualityWorkerResult["usage"] {
  return {
    callId: request.callId, stage: request.stage,
    ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
    ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
    ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
    pass: request.pass, ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
    estimated: true, elapsedMs: 1, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
  };
}

/** A worker whose repairs never satisfy the contract's required end state. */
class NeverRepairsWorker implements QualityWorker {
  patchCalls = 0;
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    if (request.jobType === "plan-scene") return { text: JSON.stringify({
      schema_version: "1.0.0",
      steps: [
        { required_beat: "Enter the archive", execution: "Mara enters the archive.", pressure: "A patrol closes in." },
        { required_beat: "Reach the terminal", execution: "Mara reaches the reader.", pressure: "The credential is revoked." },
      ],
      turn_execution: "She finds the maintenance route.", ending_execution: "She remains at the terminal.",
      evidence_record_ids: ["STATE-MARA-LOCATION"],
    }), usage: usage(request) };
    if (request.jobType === "draft-scene") return { text: draftProse, usage: usage(request) };
    if (request.jobType === "critic-continuity") return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    // Always empty: the required location change is never delivered, so the
    // state-delta node keeps routing back into span-repair.
    if (request.jobType === "extract-state-delta") return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    if (request.jobType === "patch-spans") {
      this.patchCalls += 1;
      return { text: JSON.stringify({
        schema_version: "1.0.0",
        operations: [{
          operation: "replace", anchor_quote: "terminal-anchor",
          replacement: `terminal-anchor rewritten ${this.patchCalls}`,
          finding_refs: ["state-delta:missing-expected-mutation:STATE-MARA-LOCATION:location"],
        }],
      }), usage: usage(request) };
    }
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

async function driveUntilSettled(root: string, runId: string, worker: QualityWorker, maximumSteps = 60) {
  const actions: string[] = [];
  for (let index = 0; index < maximumSteps; index += 1) {
    const result = await advanceChapterExecutionStep({
      root, chapter: 1, runId, worker, requiredCriticJobTypes: ["critic-continuity"],
    });
    actions.push(result.action);
    if (result.state.status !== "active") return { actions, state: result.state, exhaustedSteps: false };
  }
  return { actions, state: readChapterExecutionState(root, runId)!, exhaustedSteps: true };
}

// Without this bound the loop below never terminates: the repair cycle had no
// limit at all, because RuntimeProfile.maxRepairAttempts was declared, defaulted
// and asserted but read by no code.
for (const runtimeProfile of ["tiny-local", "local", "full"] as const) {
  test(`a scene that never satisfies its contract blocks after ${runtimeProfile}'s repair limit`, async () => {
    const { parent, root } = setup(runtimeProfile);
    const runId = `RUN-REPAIR-LIMIT-${runtimeProfile.toUpperCase()}`;
    try {
      const worker = new NeverRepairsWorker();
      const { state, exhaustedSteps } = await driveUntilSettled(root, runId, worker);
      assert.equal(exhaustedSteps, false, "the run settles instead of cycling forever");
      assert.equal(state.status, "blocked");
      assert.equal(state.blocker?.code, "repair-limit");
      assert.deepEqual(state.blocker?.record_ids, [sceneId]);
      // Exactly the profile's allowance is spent — no more, no fewer.
      const limit = RUNTIME_PROFILES[runtimeProfile].maxRepairAttempts;
      assert.equal(worker.patchCalls, limit);
      assert.equal(state.attempts[`${sceneId}:span-repair`], limit);
      // The message must name the scene and the limit so the writer can act
      // without reading run artifacts by hand.
      assert.match(state.blocker?.message ?? "", new RegExp(`Scene ${sceneId}`));
      assert.match(state.blocker?.message ?? "", new RegExp(`limit of ${limit} span-repair attempt`));
    } finally { rmSync(parent, { recursive: true, force: true }); }
  });
}

test("a blocked repair-limit run stays blocked rather than silently resuming the cycle", async () => {
  const { parent, root } = setup("tiny-local");
  const runId = "RUN-REPAIR-LIMIT-STICKY";
  try {
    const worker = new NeverRepairsWorker();
    await driveUntilSettled(root, runId, worker);
    const patchesAtBlock = worker.patchCalls;
    // Calling again must not spend another repair; the state machine refuses to
    // advance a blocked run and the step reports the stop.
    const again = await advanceChapterExecutionStep({
      root, chapter: 1, runId, worker, requiredCriticJobTypes: ["critic-continuity"],
    });
    assert.equal(again.action, "stopped");
    assert.equal(again.state.status, "blocked");
    assert.equal(worker.patchCalls, patchesAtBlock);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
