import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceChapterExecutionStep } from "../src/application/chapter-execution-stepper.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

const runId = "RUN-DELTA-STEP-001";
const sceneId = "CH-001-SC-01-V1";
const draftProse = `${Array.from({ length: 319 }, (_, index) => `word${index + 1}`).join(" ")} terminal-anchor`;
const repairedEvidence = "remained at the terminal";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-delta-step-"));
  const root = initializeProject(parent, {
    projectName: "Delta Repair Stepper", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4",
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

class DeltaRepairWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  deltaCalls = 0;
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
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
    if (request.jobType === "extract-state-delta") {
      this.deltaCalls += 1;
      const mutations = this.deltaCalls === 1 ? [] : [{
        record_id: "STATE-MARA-LOCATION", field: "location", operation: "set", value: "LOC-TERMINAL", evidence_quote: repairedEvidence,
      }];
      return { text: JSON.stringify({ schema_version: "1.0.0", mutations }), usage: usage(request) };
    }
    if (request.jobType === "patch-spans") return { text: JSON.stringify({
      schema_version: "1.0.0",
      operations: [{
        operation: "replace", anchor_quote: "terminal-anchor", replacement: repairedEvidence,
        finding_refs: ["state-delta:missing-expected-mutation:STATE-MARA-LOCATION:location"],
      }],
    }), usage: usage(request) };
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

test("the stepper repairs a state-delta mismatch and rechecks the repaired draft", async () => {
  const { parent, root } = setup();
  try {
    const worker = new DeltaRepairWorker();
    const actions: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      const result = await advanceChapterExecutionStep({
        root, chapter: 1, runId, worker, requiredCriticJobTypes: ["critic-continuity"],
      });
      actions.push(result.action);
      if (result.state.current_node === "scene-accept") break;
    }
    assert.deepEqual(actions.slice(-7), [
      "critic-review-finalized", "state-delta-extracted", "scene-repaired", "scene-validated",
      "critic-completed", "critic-review-finalized", "state-delta-extracted",
    ]);
    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.current_node, "scene-accept");
    assert.equal(state.attempts[`${sceneId}:state-delta`], 2);
    assert.deepEqual(worker.requests.map((request) => request.jobType).filter((job) => job === "patch-spans"), ["patch-spans"]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
