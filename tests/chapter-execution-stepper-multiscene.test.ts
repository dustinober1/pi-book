import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advanceChapterExecutionStep } from "../src/application/chapter-execution-stepper.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionManifest } from "../src/infrastructure/chapter-execution-manifest-store.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

const runId = "RUN-MULTI-001";
const sceneIds = ["CH-001-SC-01-V1", "CH-001-SC-02-V1"] as const;
const prose = {
  [sceneIds[0]]: Array.from({ length: 450 }, (_, index) => `first${index + 1}`).join(" "),
  [sceneIds[1]]: Array.from({ length: 450 }, (_, index) => `second${index + 1}`).join(" "),
};

function packet() {
  return {
    chapter: 1, title: "Opening", status: "ready", pov: "CHAR-MARA", purpose: "open the archive",
    scene_engine: "attack", pressure_movement: "worse", character_movement: "chooses",
    relationship_movement: "changes", story_thread_refs: [], continuity_refs: ["CAN-ACCESS"],
    character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: "access denied", reader_forecast_change: "the archive is compromised", protagonist_choice: "enters" },
    ending_hook: "the access log is copied", milestone_gate: null, target_words: 1000,
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-multiscene-"));
  const root = initializeProject(parent, {
    projectName: "Multi Scene Execution", projectType: "standalone", profile: "thriller",
    runtimeProfile: "tiny-local", modelExecutionProfile: "small-12b-q4",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
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
    schema_version: "1.0.0", facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The archive credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }], relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0", acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "archive access is copied", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "ACT-1", packets: [packet()] }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-001", version: 1, chapter: 1, title: "Opening",
    source_kind: "approved-contract", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: "Enter the archive and copy the access log.",
    required_beats: ["Enter the archive", "Reach the terminal", "Discover revoked access", "Copy the access log"],
    active_thread_ids: [], required_record_ids: ["CAN-ACCESS"], start_state_ids: [], required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."], knowledge_boundary_ids: [],
    target_words: { minimum: 800, maximum: 1200 }, ending_hook: "Mara leaves with the access log.",
    small_model_ready: true, missing_small_model_fields: [],
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

class MultiSceneWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") {
      const first = request.sceneId === sceneIds[0];
      return { text: JSON.stringify({
        schema_version: "1.0.0",
        steps: first
          ? [
              { required_beat: "Enter the archive", execution: "Mara enters through maintenance.", pressure: "A patrol turns toward her." },
              { required_beat: "Discover revoked access", execution: "The reader rejects her credential.", pressure: "The rejection logs her presence." },
            ]
          : [
              { required_beat: "Reach the terminal", execution: "Mara reaches the terminal bank.", pressure: "The patrol seals the corridor." },
              { required_beat: "Copy the access log", execution: "Mara copies the access log.", pressure: "The transfer exposes her location." },
            ],
        turn_execution: first ? "She finds the maintenance conduit." : "She reroutes the transfer through a local port.",
        ending_execution: first ? "She reaches the terminal bank." : "She leaves with the access log.",
        evidence_record_ids: ["CAN-ACCESS"],
      }), usage: usage(request) };
    }
    if (request.jobType === "draft-scene") return { text: prose[request.sceneId as keyof typeof prose], usage: usage(request) };
    if (request.jobType === "critic-continuity") return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    if (request.jobType === "extract-state-delta") return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

test("one-step execution completes a two-scene chapter without replay or provenance drift", async () => {
  const { parent, root } = setup();
  try {
    const worker = new MultiSceneWorker();
    const actions: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const result = await advanceChapterExecutionStep({
        root, chapter: 1, runId, worker, requiredCriticJobTypes: ["critic-continuity"],
      });
      actions.push(result.action);
      if (result.state.status === "completed") break;
    }

    const state = readChapterExecutionState(root, runId)!;
    const manifest = readChapterExecutionManifest(root, runId, 1)!;
    assert.equal(manifest.scenes.length, 2);
    assert.notEqual(manifest.scenes[0]?.contract_hash, manifest.scenes[1]?.contract_hash);
    assert.deepEqual(state.accepted_scene_ids, [...sceneIds]);
    assert.equal(state.status, "completed");
    assert.equal(state.current_node, "complete");
    assert.equal(actions.filter((action) => action === "context-built").length, 2);
    assert.equal(actions.filter((action) => action === "scene-planned").length, 2);
    assert.equal(actions.filter((action) => action === "scene-drafted").length, 2);
    assert.equal(actions.filter((action) => action === "scene-accepted").length, 2);
    assert.deepEqual(worker.requests.map((request) => request.jobType), [
      "plan-scene", "draft-scene", "critic-continuity", "extract-state-delta",
      "plan-scene", "draft-scene", "critic-continuity", "extract-state-delta",
    ]);
    const manuscript = join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md");
    assert.equal(existsSync(manuscript), true);
    assert.equal(readFileSync(manuscript, "utf8"), `${prose[sceneIds[0]]}\n\n${prose[sceneIds[1]]}`);
    assert.equal(readBook(root).current_chapter, 1);
    assert.equal(readProject(root).next_gate, "first-chapter-approval");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
