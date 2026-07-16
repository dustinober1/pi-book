import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../../src/application/events.js";
import { NovelEventRejection } from "../../src/application/event-rejection.js";
import { createWizardRegistry } from "../../src/application/wizard.js";
import { registerNovelForge } from "../../src/pi/extension.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../../src/project/store.js";
import { startWizardSession } from "../../src/wizard/session.js";
import { completePlot, queueFixture } from "../phase4-fixtures.js";

function setup(prefix: string): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), prefix));
  const root = initializeProject(parent, { projectName: "Structured Rejection", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

function expectRejection(run: () => unknown, code: string): NovelEventRejection {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof NovelEventRejection);
    assert.equal(error.detail.code, code);
    return error;
  }
  assert.fail(`Expected ${code} rejection.`);
}

test("guarded events expose schema stale allowlist and reference rejection details before mutation", () => {
  const { parent, root } = setup("novel-forge-structured-event-");
  try {
    const projectPath = join(root, "PROJECT.yaml");
    const bookPath = join(root, "books", "book-01", "BOOK.yaml");
    const projectBefore = readFileSync(projectPath, "utf8");
    const bookBefore = readFileSync(bookPath, "utf8");
    const hashBefore = projectStateHash(root);

    const schema = expectRejection(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: hashBefore,
      files: [{ path: "books/book-01/book-strategy.yaml", content: "schema_version: [\n" }],
    }), "schema-validation");
    assert.equal(schema.detail.retryable, true);
    assert.deepEqual(schema.detail.invalidPaths, ["books/book-01/book-strategy.yaml"]);
    assert.equal(schema.detail.currentStage, "voice-intake");
    assert.equal(schema.detail.currentProjectHash, hashBefore);
    assert.match(schema.message, /not valid YAML/i);

    const stale = expectRejection(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: "stale-hash",
      files: [{ path: "books/book-01/book-strategy.yaml", content: readFileSync(join(root, "books", "book-01", "book-strategy.yaml"), "utf8") }],
    }), "stale-project-hash");
    assert.equal(stale.detail.requiresReload, true);
    assert.equal(stale.detail.retryable, false);

    const disallowed = expectRejection(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: hashBefore,
      files: [{ path: "books/book-01/manuscript/chapters/01-opening.md", content: "# Forbidden" }],
    }), "allowlist-violation");
    assert.deepEqual(disallowed.detail.invalidPaths, ["books/book-01/manuscript/chapters/01-opening.md"]);
    assert.equal(disallowed.detail.retryable, false);

    const project = readProject(root);
    project.current_stage = "chapter-queue";
    project.next_gate = null;
    writeFileSync(projectPath, stringifyYaml(project), "utf8");
    const queue = queueFixture();
    queue.packets[0]!.continuity_refs = ["CAN-MISSING"];
    queue.packets[0]!.story_thread_refs = [];
    queue.packets[0]!.required_research = [];
    const reference = expectRejection(() => applyNovelEvent(root, {
      eventType: "chapter-queue",
      expectedStage: "chapter-queue",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queue) },
        { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(completePlot()) },
      ],
    }), "reference-validation");
    assert.equal(reference.detail.retryable, true);
    assert.match(reference.message, /Reference validation blocked/i);

    const restored = readProject(root);
    restored.current_stage = "voice-intake";
    writeFileSync(projectPath, stringifyYaml(restored), "utf8");
    assert.equal(readFileSync(bookPath, "utf8"), bookBefore);
    assert.equal(readFileSync(join(root, "books", "book-01", "manuscript", "chapters", ".gitkeep"), "utf8"), "");
    assert.equal(readFileSync(projectPath, "utf8"), stringifyYaml(restored));
    assert.notEqual(readFileSync(projectPath, "utf8"), projectBefore, "only the test's explicit stage setup may differ");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("wizard stale proposals use the same rejection class and HTTP envelope", async () => {
  const { parent, root } = setup("novel-forge-structured-wizard-");
  let session: Awaited<ReturnType<typeof startWizardSession>> | null = null;
  try {
    const registry = createWizardRegistry(root, {
      research: { apply: () => ({ ok: true }) },
    });
    const envelope = {
      proposal_id: "stale",
      workflow: "research" as const,
      action: "save-influence",
      expected_stage: "voice-intake",
      expected_project_hash: "stale-hash",
      payload: {},
    };
    const value = expectRejection(() => registry.apply(envelope), "stale-project-hash");
    assert.equal(value.detail.requiresReload, true);

    session = await startWizardSession({ projectRoot: root, registry, workflow: "research", openBrowser: false, idleTimeoutMs: 60_000 });
    const origin = new URL(session.url).origin;
    const response = await fetch(`${origin}/api/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "X-Novel-Forge-Origin": origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    assert.equal(response.status, 409);
    const body = await response.json() as any;
    assert.equal(body.rejection.code, "stale-project-hash");
    assert.equal(body.rejection.requiresReload, true);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await session?.close();
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel_apply_event returns concise text plus the structured rejection detail", async () => {
  const { parent, root } = setup("novel-forge-structured-tool-");
  try {
    const tools = new Map<string, any>();
    registerNovelForge({
      registerCommand() {},
      registerTool(definition: any) { tools.set(definition.name, definition); },
      sendUserMessage() {},
    } as never);
    const tool = tools.get("novel_apply_event");
    const result = await tool.execute("call-rejected", {
      project_root: root,
      event_type: "research-update",
      expected_stage: "voice-intake",
      expected_project_hash: projectStateHash(root),
      files: [{ path: "books/book-01/book-strategy.yaml", content: "schema_version: [\n" }],
    }, new AbortController().signal, undefined, { cwd: root });

    assert.match(result.content[0].text, /Novel Forge event rejected/);
    assert.match(result.content[0].text, /resubmit once/i);
    assert.equal(result.details.rejection.code, "schema-validation");
    assert.equal(result.details.rejection.retryable, true);
    assert.deepEqual(result.details.rejection.invalidPaths, ["books/book-01/book-strategy.yaml"]);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
