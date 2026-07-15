import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  defaultBookStrategy,
  defaultTasteProfile,
  defaultVoiceAudits,
  defaultVoiceExperimentIndex,
  defaultVoiceGuardrails,
} from "../src/domain/v1-3-schemas.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-research-event-")); }

function setDraftingGate(root: string): void {
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = "first-chapter-approval";
  project.gates["first-chapter-approval"] = "pending";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
}

test("research updates preserve stage, gate, and book state during a pending creative decision", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Event", projectType: "standalone", profile: "thriller" });
    setDraftingGate(root);
    const beforeProject = readProject(root);
    const beforeBook = readBook(root);

    const result = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      scope: "taste",
      files: [{ path: "series/taste-profile.yaml", content: stringifyYaml(defaultTasteProfile()) }],
    });

    const afterProject = readProject(root);
    const afterBook = readBook(root);
    assert.equal(result.stage, "drafting");
    assert.equal(afterProject.current_stage, beforeProject.current_stage);
    assert.equal(afterProject.next_gate, beforeProject.next_gate);
    assert.deepEqual(afterProject.gates, beforeProject.gates);
    assert.deepEqual(afterBook, beforeBook);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("research updates accept only bounded evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Paths", projectType: "standalone", profile: "romantasy" });
    const stage = readProject(root).current_stage;
    const allowed = [
      { path: "series/voice-guardrails.yaml", content: stringifyYaml(defaultVoiceGuardrails()) },
      { path: "series/voice-experiments/index.yaml", content: stringifyYaml(defaultVoiceExperimentIndex()) },
      { path: "series/voice-experiments/VE-001/source-scene.md", content: "# Source scene\n" },
      { path: "books/book-01/book-strategy.yaml", content: stringifyYaml(defaultBookStrategy()) },
      { path: "books/book-01/voice-audits.yaml", content: stringifyYaml(defaultVoiceAudits()) },
    ];
    assert.doesNotThrow(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: stage,
      expectedProjectHash: projectStateHash(root),
      scope: "foundation",
      files: allowed,
    }));

    for (const path of [
      "PROJECT.yaml",
      "books/book-01/BOOK.yaml",
      "books/book-01/manuscript/chapters/01-opening.md",
      "books/book-01/publishing.yaml",
      "books/book-01/marketing.yaml",
      "books/book-01/reader-kits/RE-001/responses.csv",
      "series/voice-experiments/unsafe/notes.md",
      "series/voice-experiments/VE-001/payload.exe",
    ]) {
      assert.throws(() => applyNovelEvent(root, {
        eventType: "research-update",
        expectedStage: stage,
        expectedProjectHash: projectStateHash(root),
        files: [{ path, content: "blocked" }],
      }), /not allowed/i, path);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("research updates reject empty events and stale state", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Stale", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: project.current_stage,
      expectedProjectHash: projectStateHash(root),
      files: [],
    }), /missing|required|output/i);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: project.current_stage,
      expectedProjectHash: "stale-hash",
      files: [{ path: "series/taste-profile.yaml", content: stringifyYaml(defaultTasteProfile()) }],
    }), /stale project hash/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("malformed research YAML is rejected without replacing the accepted artifact", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Rollback", projectType: "standalone", profile: "thriller" });
    const path = join(root, "series", "taste-profile.yaml");
    const before = readFileSync(path, "utf8");
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "series/taste-profile.yaml", content: "schema_version: 1.0.0\nunknown: true\n" }],
    }), /schema validation/i);
    assert.equal(readFileSync(path, "utf8"), before);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
