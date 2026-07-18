import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { explainFirstBlocker, inspectUndo, reconcileMilestoneState, runIntegritySummary, undoLastNovelEvent } from "../src/application/recovery.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject, writeProjectEvent } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-recovery-")); }
function git(root: string, args: string[]): string { return execFileSync("git", args, { cwd: root }).toString().trim(); }
function configuredProject(name: string): string {
  const parent = temp();
  const root = initializeProject(parent, { projectName: name, projectType: "standalone", profile: "thriller" });
  git(root, ["config", "user.email", "novel-forge@example.test"]);
  git(root, ["config", "user.name", "Novel Forge Test"]);
  writeFileSync(join(root, "manual-note.txt"), "Manual repository change.\n", "utf8");
  git(root, ["add", "manual-note.txt"]);
  git(root, ["commit", "-m", "Initial project"]);
  return root;
}

test("undo inspection rejects dirty and non-Novel-Forge heads", () => {
  const root = configuredProject("Undo Guard");
  const parent = join(root, "..");
  try {
    assert.equal(inspectUndo(root).allowed, false);
    assert.match(inspectUndo(root).reason, /not a Novel Forge checkpoint/i);
    appendFileSync(join(root, "START-HERE.md"), "\nchanged\n", "utf8");
    assert.equal(inspectUndo(root).allowed, false);
    assert.match(inspectUndo(root).reason, /uncommitted/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("undo reverts a normal Novel Forge checkpoint with a new commit", () => {
  const root = configuredProject("Undo Event");
  const parent = join(root, "..");
  try {
    const project = readProject(root);
    project.project_name = "Changed Name";
    writeProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], "Novel Forge: test change");
    const inspection = inspectUndo(root);
    assert.equal(inspection.allowed, true);
    const before = git(root, ["rev-parse", "HEAD"]);
    const result = undoLastNovelEvent(root);
    assert.equal(result.reverted, true);
    assert.notEqual(git(root, ["rev-parse", "HEAD"]), before);
    assert.equal(readProject(root).project_name, "Undo Event");
    assert.match(git(root, ["log", "-1", "--pretty=%s"]), /^Revert /);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("approval reversal requires explicit permission", () => {
  const root = configuredProject("Undo Approval");
  const parent = join(root, "..");
  try {
    const project = readProject(root);
    project.gates["voice-approval"] = "approved";
    project.next_gate = null;
    writeProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], "Novel Forge: approve voice-approval");
    assert.equal(inspectUndo(root).approvalCheckpoint, true);
    assert.throws(() => undoLastNovelEvent(root), /approval/i);
    assert.equal(undoLastNovelEvent(root, true).reverted, true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("recovery explains the first blocker and summarizes integrity", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Explain", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.gates["voice-approval"] = "pending";
    project.next_gate = "voice-approval";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const explanation = explainFirstBlocker(root);
    assert.match(explanation, /Voice Profile/i);
    assert.match(explanation, /\/novel/);
    assert.match(runIntegritySummary(root), /Integrity/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("recovery identifies an overdue act review without deleting later chapters", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Overdue Act", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    project.gates["first-chapter-approval"] = "approved";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      acts: [{ id: "ACT-1", purpose: "entry", start_chapter: 1, end_chapter: 6, gate: "act-1-review" }],
      chapters: [],
    }), "utf8");
    mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "09-later.md"), "# Later\n\nStill provisional.\n", "utf8");
    const recovery = reconcileMilestoneState(root);
    assert.deepEqual(recovery?.chapterRange, { startChapter: 1, endChapter: 6 });
    assert.equal(recovery?.gate, "act-1-review");
    assert.match(recovery?.findings[0] ?? "", /Chapters 1-6/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
