import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sceneExecutionDraftStageSpec } from "../src/application/stage-specs/draft-execution.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { initializeProject, readProject } from "../src/project/store.js";

const runId = "CHSTEP-book-01-001";

function readyPacket() {
  return {
    chapter: 1,
    title: "Opening",
    status: "ready",
    pov: "CHAR-MARA",
    purpose: "enter the archive",
    scene_engine: "attack",
    pressure_movement: "worse",
    character_movement: "chooses",
    relationship_movement: "changes",
    story_thread_refs: [],
    continuity_refs: [],
    character_refs: [],
    required_research: [],
    profile_fields: {
      threat_delta: "+1",
      evidence_delta: "none",
      reader_forecast_change: "the archive is unsafe",
      protagonist_choice: "enters",
    },
    ending_hook: "the terminal stays dark",
    milestone_gate: null,
    target_words: 1000,
  };
}

function chapterContract() {
  return {
    schema_version: "2.0.0",
    contract_id: "CH-001",
    version: 1,
    chapter: 1,
    title: "Opening",
    source_kind: "approved-contract",
    source_packet_hash: "a".repeat(64),
    pov: "CHAR-MARA",
    purpose: "Enter the archive and secure the terminal log.",
    required_beats: ["Enter the archive", "Cross the patrol corridor", "Reach the terminal", "Secure the access log"],
    active_thread_ids: [],
    required_record_ids: [],
    start_state_ids: [],
    required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."],
    knowledge_boundary_ids: [],
    target_words: { minimum: 1400, maximum: 1800 },
    ending_hook: "The access light stays dark.",
    small_model_ready: true,
    missing_small_model_fields: [],
  };
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-step-tool-"));
  const root = initializeProject(parent, {
    projectName: "Step Tool",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "ACT-1",
    packets: [readyPacket()],
  }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml(chapterContract()), "utf8");
  return { parent, root };
}

class NoopWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    throw new Error("the first deterministic steps must not call a model");
  }
  async resolveModelCapacity() { return null; }
}

function registeredTool(worker: QualityWorker) {
  const tools = new Map<string, any>();
  registerNovelForgeWithRecalibration({
    registerCommand() {},
    registerTool(tool: any) { tools.set(tool.name, tool); },
    sendUserMessage() {},
  } as never, { createQualityWorker: () => worker });
  return tools.get("novel_advance_chapter_step");
}

test("novel_advance_chapter_step advances one persisted stage and returns the stable run identity", async () => {
  const { parent, root } = setup();
  try {
    const worker = new NoopWorker();
    const tool = registeredTool(worker);
    assert.ok(tool, "novel_advance_chapter_step must be registered");

    const first = await tool.execute("tool-1", {
      project_root: root,
      chapter: 1,
      critics: ["critic-continuity"],
    }, undefined, undefined, { cwd: root });
    assert.match(first.content[0].text, /Action: prepared/);
    assert.match(first.content[0].text, new RegExp(`Run: ${runId}`));
    assert.equal(first.details.action, "prepared");
    assert.equal(first.details.run_id, runId);
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "contract-compile");

    const second = await tool.execute("tool-2", {
      project_root: root,
      chapter: 1,
      run_id: runId,
      critics: ["critic-continuity"],
    }, undefined, undefined, { cwd: root });
    assert.equal(second.details.action, "chapter-contract-compiled");
    assert.equal(readChapterExecutionState(root, runId)?.current_node, "scene-contract-compile");
    assert.equal(worker.requests.length, 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel_advance_chapter_step reports an active writer gate without preparing a run", async () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.next_gate = "first-chapter-approval";
    project.gates["first-chapter-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    const tool = registeredTool(new NoopWorker());
    const result = await tool.execute("tool-gate", {
      project_root: root,
      chapter: 1,
      critics: ["critic-continuity"],
    }, undefined, undefined, { cwd: root });
    assert.match(result.content[0].text, /writer approval|required before chapter execution/i);
    assert.equal(result.details.error !== undefined, true);
    assert.equal(readChapterExecutionState(root, runId), null);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("draft guidance routes chapter work through the one-step execution tool", () => {
  const spec = sceneExecutionDraftStageSpec({
    root: "/project",
    bookId: "book-01",
    chapter: 7,
    estimatedTokens: 10_000,
    excluded: ["future books"],
    projectHash: "hash-123",
  });
  const rules = spec.toolRules.join("\n");
  assert.match(rules, /novel_advance_chapter_step/);
  assert.match(rules, /Do not use novel_apply_event/);
  assert.doesNotMatch(rules, /When .*call .*novel_apply_event|Send event_type=draft-chapter/i);
  assert.match(rules, /same run|run_id/i);
  assert.match(rules, /one persisted stage|one tool call at a time/i);
});
