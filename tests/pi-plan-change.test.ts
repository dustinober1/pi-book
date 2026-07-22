import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStateHash } from "../src/application/project-hash.js";
import { readPlanChangeRequest } from "../src/application/plan-change.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const chapterText = "Mara proves the archive route is unusable.";

function futureContract() {
  return stringifyYaml({
    schema_version: "2.0.0", contract_id: "CH-002", version: 1, chapter: 2, title: "River",
    source_kind: "legacy-packet", source_packet_hash: "a".repeat(64), pov: "CHAR-MARA", purpose: "Take the river route.",
    required_beats: ["Reach river"], active_thread_ids: [], required_record_ids: [], start_state_ids: [], required_end_state: [],
    forbidden_changes: [], knowledge_boundary_ids: [], target_words: { minimum: 900, maximum: 1200 }, ending_hook: "watched",
    small_model_ready: false, missing_small_model_fields: ["start_state_ids", "required_end_state", "forbidden_changes", "knowledge_boundary_ids"],
  });
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-pi-plan-change-"));
  const root = initializeProject(parent, { projectName: "Pi Plan Change", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const book = readBook(root);
  book.current_chapter = 1;
  book.status = "drafting";
  writeFileSync(join(root, "books/book-01/BOOK.yaml"), stringifyYaml(book), "utf8");
  const manuscriptPath = "books/book-01/manuscript/chapters/01-opening.md";
  writeFileSync(join(root, manuscriptPath), chapterText, "utf8");
  return { parent, root, manuscriptPath };
}

function surfaces() {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  registerNovelForgeWithRecalibration({
    registerCommand(name: string, command: any) { commands.set(name, command); },
    registerTool(tool: any) { tools.set(tool.name, tool); },
    sendUserMessage() {},
  } as never);
  return { tools, commands };
}

test("novel_propose_plan_change stores a proposal without canonical mutation", async () => {
  const { parent, root, manuscriptPath } = setup();
  try {
    const before = projectStateHash(root);
    const tool = surfaces().tools.get("novel_propose_plan_change");
    assert.ok(tool, "novel_propose_plan_change must be registered");
    const result = await tool.execute("tool-plan-change", {
      project_root: root,
      request_id: "PC-001",
      scope: "local",
      proposed_change: "Use the river route in Chapter 2.",
      reason: "Accepted prose makes the archive route unusable.",
      manuscript_evidence: [{ chapter: 1, manuscript_path: manuscriptPath, manuscript_hash: hash(chapterText), quote: "archive route is unusable" }],
      affected_chapters: [2],
      affected_contract_ids: ["CH-002"],
      affected_arc_ids: [],
      affected_thread_ids: [],
      affected_payoff_ids: [],
      proposed_files: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", content: futureContract() }],
      source_project_hash: before,
    }, undefined, undefined, { cwd: root });
    assert.match(result.content[0].text, /plan change PC-001 proposed/i);
    assert.equal(result.details.status, "proposed");
    assert.equal(projectStateHash(root), before);
    assert.equal(existsSync(join(root, "books/book-01/contracts/chapters/CH-002.yaml")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("novel-plan-change approval command requires UI confirmation and applies the pending request", async () => {
  const { parent, root, manuscriptPath } = setup();
  try {
    const before = projectStateHash(root);
    const { tools, commands } = surfaces();
    await tools.get("novel_propose_plan_change").execute("tool-plan-change", {
      project_root: root, request_id: "PC-001", scope: "local",
      proposed_change: "Use the river route in Chapter 2.", reason: "Accepted prose makes the archive route unusable.",
      manuscript_evidence: [{ chapter: 1, manuscript_path: manuscriptPath, manuscript_hash: hash(chapterText), quote: "archive route is unusable" }],
      affected_chapters: [2], affected_contract_ids: ["CH-002"], affected_arc_ids: [], affected_thread_ids: [], affected_payoff_ids: [],
      proposed_files: [{ path: "books/book-01/contracts/chapters/CH-002.yaml", content: futureContract() }], source_project_hash: before,
    }, undefined, undefined, { cwd: root });

    const notifications: string[] = [];
    const context = {
      cwd: root,
      isIdle: () => true,
      ui: {
        confirm: async () => true,
        input: async () => "Writer approves the route correction.",
        notify: (message: string) => { notifications.push(message); },
        select: async () => undefined,
      },
    };
    const command = commands.get("novel-plan-change");
    assert.ok(command, "novel-plan-change must be registered");
    await command.handler("--approve PC-001", context);
    assert.ok(existsSync(join(root, "books/book-01/contracts/chapters/CH-002.yaml")));
    assert.ok(existsSync(join(root, "books/book-01/plan-changes/PC-001.yaml")));
    assert.equal(readPlanChangeRequest(root, "PC-001")?.status, "applied");
    assert.ok(notifications.some((message) => /applied plan change PC-001/i.test(message)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
