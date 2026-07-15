import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReaderWizardHandler } from "../src/application/readers/wizard.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-reader-wizard-")); }

test("reader wizard previews and creates an isolated kit", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Wizard", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), `# Chapter 1\n\n${"signal ".repeat(1000)}`, "utf8");
    const handler = createReaderWizardHandler(root);
    const preview = await handler.preview!("kit", { proposal: { scope: "first-page", targetReader: "core thriller readers", minimumImmediateCount: 2, minimumDelayedCount: 2, delayedAfterHours: 48 } }) as any;
    assert.match(preview.preview_id, /^reader-preview-/);
    assert.ok(preview.wordCount <= 900);
    const project = readProject(root);
    const result = await handler.apply!({ proposal_id: "p1", workflow: "readers", action: "create-kit", expected_stage: project.current_stage, expected_project_hash: projectStateHash(root), payload: { preview_id: preview.preview_id } }) as any;
    assert.equal(result.experimentId, "RE-001");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("reader wizard requires a known CSV preview before import", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Import", projectType: "standalone", profile: "thriller" });
    const handler = createReaderWizardHandler(root);
    const project = readProject(root);
    await assert.rejects(Promise.resolve().then(() => handler.apply!({ proposal_id: "p2", workflow: "readers", action: "import-csv", expected_stage: project.current_stage, expected_project_hash: projectStateHash(root), payload: { preview_id: "missing", decisions: {} } })), /unknown or expired reader preview/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
