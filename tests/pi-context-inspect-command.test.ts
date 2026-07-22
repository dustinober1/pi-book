import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectActiveContext, renderContextInspection } from "../src/application/context-inspection.js";
import { chapterContractPath } from "../src/domain/chapter-contract.js";
import { buildGuideScreen } from "../src/application/guide.js";
import { registerNovelForge } from "../src/pi/extension.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function commandHarness() {
  const commands = new Map<string, any>();
  const notifications: string[] = [];
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage() {},
  } as never);
  return { commands, notifications };
}

function context(cwd: string, notifications: string[]) {
  return {
    cwd,
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => true,
      editor: async () => undefined,
      notify(message: string) { notifications.push(message); },
    },
    isIdle: () => true,
  };
}

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-context-inspect-"));
  const root = initializeProject(parent, {
    projectName: "Context Inspection",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const project = readProject(root);
  project.current_stage = "chapter-queue";
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
    entities: [
      { id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" },
      { id: "LOC-ARCHIVE", category: "location", display_name: "Archive", aliases: [], status: "locked-canon", source: "book-bible", introduced_in: "book-01" },
    ],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    records: [{
      id: "STATE-MARA-LOCATION",
      subject_id: "CHAR-MARA",
      field: "location",
      value: "LOC-ARCHIVE",
      status: "current-state",
      source: "chapter-00",
      introduced_in: "chapter-00",
      updated_in: "chapter-00",
      evidence_ids: ["C00-P001"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-ACCESS", category: "access", subject: "Mara", fact: "PROTECTED EXCERPT SHOULD NOT PRINT", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 1, act: "act-1", causality: "therefore she enters", state_change: "access is tested", setup_ids: [], payoff_ids: [], profile_obligations: [] }],
    decisions: [],
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
    purpose: "Reach the archive terminal.",
    required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: [],
    required_record_ids: ["CAN-ACCESS"],
    start_state_ids: ["STATE-MARA-LOCATION"],
    required_end_state: [],
    forbidden_changes: ["Do not identify the prior user."],
    knowledge_boundary_ids: [],
    target_words: { minimum: 700, maximum: 900 },
    ending_hook: "Mara reaches the terminal unseen.",
    small_model_ready: true,
    missing_small_model_fields: [],
  }), "utf8");
  return { parent, root };
}

test("context inspection shows IDs, reasons, budgets, dependencies, omissions, and cache status without payloads", () => {
  const { parent, root } = setup();
  try {
    const first = inspectActiveContext(root, { chapter: 1, sceneId: "CH-001-SC-01-V1", jobType: "draft-scene" });
    const second = inspectActiveContext(root, { chapter: 1, sceneId: "CH-001-SC-01-V1", jobType: "draft-scene" });
    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.ok(first.records.some((record) => record.id === "CAN-ACCESS" && /explicit|dependency/i.test(record.reason)));
    assert.ok(first.records.every((record) => record.estimatedTokens > 0));
    const rendered = renderContextInspection(first);
    assert.match(rendered, /CAN-ACCESS/);
    assert.match(rendered, /Estimated evidence tokens:/);
    assert.match(rendered, /Omitted record IDs/);
    assert.match(rendered, /Dependency edges/);
    assert.doesNotMatch(rendered, /PROTECTED EXCERPT SHOULD NOT PRINT/);
    assert.doesNotMatch(rendered, /"fact"|source_path|Payload:/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel-context command is registered and emits the privacy-safe inspection", async () => {
  const { parent, root } = setup();
  try {
    const { commands, notifications } = commandHarness();
    assert.ok(commands.has("novel-context"));
    await commands.get("novel-context").handler(
      "--chapter 1 --scene CH-001-SC-01-V1 --job draft-scene",
      context(root, notifications),
    );
    const output = notifications.join("\n");
    assert.match(output, /Active Context Inspection/);
    assert.match(output, /CH-001-SC-01-V1/);
    assert.match(output, /CAN-ACCESS/);
    assert.doesNotMatch(output, /PROTECTED EXCERPT SHOULD NOT PRINT/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("the guided screen exposes context inspection when an executable chapter contract exists", () => {
  const { parent, root } = setup();
  try {
    const screen = buildGuideScreen(root);
    assert.ok(screen.actions.some((action) => action.id === "context" && /inspect active context/i.test(action.label)));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
