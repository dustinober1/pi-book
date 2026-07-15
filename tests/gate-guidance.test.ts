import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { gateEvidenceHash } from "../src/application/gates.js";
import { gateEvidencePaths } from "../src/application/gate-metadata.js";
import { approveProjectGate, rejectProjectGate } from "../src/application/run.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-gate-guidance-")); }

function voiceFiles(root: string, profile: string) {
  return [
    { path: "series/voice-profile.md", content: profile },
    { path: "series/taste-profile.yaml", content: readFileSync(join(root, "series", "taste-profile.yaml"), "utf8") },
    { path: "series/voice-guardrails.yaml", content: readFileSync(join(root, "series", "voice-guardrails.yaml"), "utf8") },
    { path: "series/voice-experiments/index.yaml", content: readFileSync(join(root, "series", "voice-experiments", "index.yaml"), "utf8") },
  ];
}

test("a writer can request changes, repair the active gate, and approve without typing an internal transition", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Gate Loop", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.gates["voice-approval"] = "pending";
    project.next_gate = "voice-approval";
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    const rejected = rejectProjectGate(root, "voice-approval", "The sample evidence is too generic; preserve the clipped interiority.");
    assert.equal(rejected.action, "rejected");
    assert.equal(readProject(root).gates["voice-approval"], "rejected");
    assert.match(readFileSync(join(root, "books", "book-01", "gate-decisions.md"), "utf8"), /clipped interiority/);

    applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: voiceFiles(root, "# Voice Profile\n\nPreserve clipped interiority and evidence-specific restraint.\n"),
    });
    assert.equal(readProject(root).gates["voice-approval"], "pending");

    const approved = approveProjectGate(root, "voice-approval", "Evidence now reflects the intended pressure.");
    assert.equal(approved.action, "approved");
    const final = readProject(root);
    assert.equal(final.gates["voice-approval"], "approved");
    assert.equal(final.current_stage, "series-planning");
    assert.equal(final.approvals.at(-1)?.approved_by, "writer");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("voice approval evidence covers the complete v1.3 voice bundle", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Voice Evidence", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    assert.deepEqual(gateEvidencePaths(project, "voice-approval"), [
      "series/voice-profile.md",
      "series/taste-profile.yaml",
      "series/voice-guardrails.yaml",
      "series/voice-experiments/index.yaml",
    ]);
    const before = gateEvidenceHash(root, project, "voice-approval");
    const path = join(root, "series", "taste-profile.yaml");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n# writer-approved influence boundary\n`, "utf8");
    assert.notEqual(gateEvidenceHash(root, project, "voice-approval"), before);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("book-plan approval evidence covers research and reader strategy", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Book Evidence", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    const paths = gateEvidencePaths(project, "book-plan-approval");
    for (const expected of [
      "books/book-01/remarkability.yaml",
      "books/book-01/research-ledger.yaml",
      "books/book-01/book-strategy.yaml",
    ]) assert.ok(paths.includes(expected), expected);

    let before = gateEvidenceHash(root, project, "book-plan-approval");
    for (const relativePath of [
      "books/book-01/remarkability.yaml",
      "books/book-01/research-ledger.yaml",
      "books/book-01/book-strategy.yaml",
    ]) {
      const path = join(root, relativePath);
      writeFileSync(path, `${readFileSync(path, "utf8")}\n# writer-approved evidence\n`, "utf8");
      const after = gateEvidenceHash(root, project, "book-plan-approval");
      assert.notEqual(after, before, relativePath);
      before = after;
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
