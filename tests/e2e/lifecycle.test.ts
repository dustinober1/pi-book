import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject, readProject } from "../../src/project/store.js";
import { approveProjectGate, decideNextRun } from "../../src/application/run.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { compileActiveBook } from "../../src/application/package.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-e2e-")); }

test("project can move from voice approval to draft context and manuscript compilation", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "E2E", projectType: "open-ended-series", profile: "romantasy", targetWords: 105000 });
    assert.equal(decideNextRun(root).action, "voice");
    const project = readProject(root);
    project.gates["voice-approval"] = "pending";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    assert.equal(decideNextRun(root).action, "blocked");
    approveProjectGate(root, "voice-approval");
    assert.equal(readProject(root).current_stage, "series-planning");
    const bookRoot = join(root, "books", "book-01");
    writeFileSync(join(bookRoot, "manuscript", "chapters", "01-opening.md"), "# Opening\n\nA ward broke, and the bargain became personal.", "utf8");
    const compiled = compileActiveBook(root);
    assert.equal(compiled.chapters, 1);
    assert.match(readFileSync(compiled.output, "utf8"), /ward broke/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
