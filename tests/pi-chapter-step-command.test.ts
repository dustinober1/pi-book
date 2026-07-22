import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { readChapterExecutionState } from "../src/infrastructure/chapter-execution-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";

const runId = "CHSTEP-book-01-001";
const sceneId = "CH-001-SC-01-V1";
const prose = Array.from({ length: 320 }, (_, index) => `word${index + 1}`).join(" ");

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-step-command-"));
  const root = initializeProject(parent, {
    projectName: "Step Command",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "voice-profile.md"), "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n", "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    must: ["Keep cause and effect legible."],
    prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."],
    monitor: [],
    baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", records: [] }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "The archive credential is revoked.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({ schema_version: "1.0.0", items: [] }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 1, act: "ACT-1", causality: "therefore", state_change: "access is copied", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "ACT-1",
    packets: [{
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
      continuity_refs: ["CAN-ACCESS"],
      character_refs: ["CHAR-MARA"],
      required_research: [],
      profile_fields: { threat_delta: "+1", evidence_delta: "access denied", reader_forecast_change: "the archive is compromised", protagonist_choice: "enters" },
      ending_hook: "the access log is copied",
      milestone_gate: null,
      target_words: 360,
    }],
  }), "utf8");
  mkdirSync(join(root, "books", "book-01", "contracts", "chapters"), { recursive: true });
  writeFileSync(join(root, chapterContractPath("book-01", 1)), stringifyYaml({
    schema_version: "2.0.0",
    contract_id: "CH-001",
    version: 1,
    chapter: 1,
    title: "Opening",
    source_kind: "approved-contract",
    source_packet_hash: "a".repeat(64),
    pov: "CHAR-MARA",
    purpose: "Enter the archive and copy the access log.",
    required_beats: ["Enter the archive", "Copy the access log"],
    active_thread_ids: [],
    required_record_ids: ["CAN-ACCESS"],
    start_state_ids: [],
    required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."],
    knowledge_boundary_ids: [],
    target_words: { minimum: 300, maximum: 360 },
    ending_hook: "Mara leaves with the access log.",
    small_model_ready: true,
    missing_small_model_fields: [],
  }), "utf8");
  return { parent, root };
}

function usage(request: QualityWorkerRequest): QualityWorkerResult["usage"] {
  return {
    callId: request.callId,
    stage: request.stage,
    ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
    ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
    ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
    pass: request.pass,
    ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
    estimated: true,
    elapsedMs: 1,
    promptHash: "1".repeat(64),
    contextHash: "2".repeat(64),
    outputHash: "3".repeat(64),
  };
}

class CommandWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") return {
      text: JSON.stringify({
        schema_version: "1.0.0",
        steps: [
          { required_beat: "Enter the archive", execution: "Mara enters through maintenance.", pressure: "A patrol closes in." },
          { required_beat: "Copy the access log", execution: "Mara copies the log.", pressure: "The transfer exposes her." },
        ],
        turn_execution: "She uses a local port.",
        ending_execution: "She leaves with the access log.",
        evidence_record_ids: ["CAN-ACCESS"],
      }),
      usage: usage(request),
    };
    if (request.jobType === "draft-scene") return { text: prose, usage: usage(request) };
    if (request.jobType === "critic-continuity") return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    if (request.jobType === "extract-state-delta") return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    throw new Error(`Unexpected model job ${request.jobType}.`);
  }
  async resolveModelCapacity() { return null; }
}

function commandContext(root: string, notifications: Array<{ message: string; level?: string }>) {
  return {
    cwd: root,
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => true,
      editor: async () => undefined,
      notify(message: string, level?: string) {
        notifications.push({ message, ...(level !== undefined ? { level } : {}) });
      },
    },
    isIdle: () => true,
  };
}

test("novel-chapter-step exposes deterministic resumable chapter execution through the Pi command surface", async () => {
  const { parent, root } = setup();
  try {
    const commands = new Map<string, any>();
    const worker = new CommandWorker();
    const notifications: Array<{ message: string; level?: string }> = [];
    registerNovelForgeWithRecalibration({
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage() { throw new Error("chapter stepping must not enqueue a host prompt"); },
    } as never, { createQualityWorker: () => worker });

    const command = commands.get("novel-chapter-step");
    assert.ok(command, "novel-chapter-step must be registered");
    for (let index = 0; index < 14; index += 1) {
      await command.handler("1 --critics continuity", commandContext(root, notifications));
    }

    const state = readChapterExecutionState(root, runId)!;
    assert.equal(state.status, "completed");
    assert.equal(state.current_node, "complete");
    assert.deepEqual(worker.requests.map((request) => request.jobType), [
      "plan-scene", "draft-scene", "critic-continuity", "extract-state-delta",
    ]);
    assert.ok(notifications.some(({ message }) => message.includes(`Run: ${runId}`)));
    assert.ok(notifications.some(({ message }) => /chapter-committed/i.test(message)));
    assert.equal(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md")), true);

    const calls = worker.requests.length;
    await command.handler("1 --critics continuity", commandContext(root, notifications));
    assert.equal(worker.requests.length, calls);
    assert.ok(notifications.at(-1)?.message.match(/approval|required writer gate|first chapter/i));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel-chapter-step blocks before preparation when a writer gate is already active", async () => {
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.next_gate = "first-chapter-approval";
    project.gates["first-chapter-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    const commands = new Map<string, any>();
    const worker = new CommandWorker();
    const notifications: Array<{ message: string; level?: string }> = [];
    registerNovelForgeWithRecalibration({
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage() {},
    } as never, { createQualityWorker: () => worker });

    await commands.get("novel-chapter-step").handler("1", commandContext(root, notifications));
    assert.equal(worker.requests.length, 0);
    assert.equal(readChapterExecutionState(root, runId), null);
    assert.ok(notifications.at(-1)?.message.match(/approval|required writer gate|first chapter/i));
    assert.equal(notifications.at(-1)?.level, "warning");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
