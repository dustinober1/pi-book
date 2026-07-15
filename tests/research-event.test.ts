import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { defaultResearchLedger } from "../src/domain/v1-3-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-research-event-")); }

function researchLedger(): string {
  const ledger = defaultResearchLedger();
  ledger.items.push({
    id: "RES-001",
    lane: "story-world",
    claim: "The control room uses a two-person release procedure.",
    source_ids: [],
    confidence: "medium",
    verified_on: null,
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: ["protagonist"], incorrectly_believed_by: [], unknown_to: ["antagonist"] },
    risk: ["procedure may vary by jurisdiction"],
    dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [4], decision_affected: "The protagonist must recruit a second operator." },
    notes: "",
    status: "researching",
  });
  return stringifyYaml(ledger);
}

test("research-update writes evidence without changing project or book creative state", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Event", projectType: "standalone", profile: "thriller" });
    const projectBefore = structuredClone(readProject(root));
    const bookBefore = structuredClone(readBook(root));
    const result = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/research-ledger.yaml", content: researchLedger() }],
    });

    assert.equal(result.stage, "voice-intake");
    assert.deepEqual(readProject(root), projectBefore);
    assert.deepEqual(readBook(root), bookBefore);
    assert.equal(result.changed.includes("PROJECT.yaml"), false);
    assert.equal(result.changed.includes("books/book-01/BOOK.yaml"), false);
    assert.equal(result.changed.includes("books/book-01/research-ledger.yaml"), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("research-update changes the guarded hash and rejects a stale evidence proposal", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Hash", projectType: "standalone", profile: "thriller" });
    const originalHash = projectStateHash(root);
    const first = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: originalHash,
      files: [{ path: "books/book-01/research-ledger.yaml", content: researchLedger() }],
    });
    assert.notEqual(first.projectHash, originalHash);
    assert.equal(first.projectHash, projectStateHash(root));

    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: originalHash,
      files: [{ path: "books/book-01/book-strategy.yaml", content: readFileSync(join(root, "books", "book-01", "book-strategy.yaml"), "utf8") }],
    }), /stale project hash/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("research-update rejects manuscript and protected state submissions", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Guard", projectType: "standalone", profile: "thriller" });
    for (const path of [
      "books/book-01/manuscript/chapters/01-opening.md",
      "PROJECT.yaml",
      "books/book-01/BOOK.yaml",
      "STATUS.md",
      "HANDOFF.md",
      "books/book-01/reader-experiments.yaml",
    ]) {
      assert.throws(() => applyNovelEvent(root, {
        eventType: "research-update",
        expectedStage: "voice-intake",
        expectedProjectHash: projectStateHash(root),
        files: [{ path, content: path.endsWith(".yaml") ? "schema_version: 1.0.0\n" : "forbidden" }],
      }), /not allowed/i, path);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("research-update rejects empty and stale submissions", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Stale", projectType: "standalone", profile: "romantasy" });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [],
    }), /at least one evidence file/i);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "series-planning",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/research-ledger.yaml", content: researchLedger() }],
    }), /stale event stage/i);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: "stale-hash",
      files: [{ path: "books/book-01/research-ledger.yaml", content: researchLedger() }],
    }), /stale project hash/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("research-update is not available after the project is complete", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Research Complete", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "complete";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "complete",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/research-ledger.yaml", content: researchLedger() }],
    }), /not allowed during complete/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("rebuilding a voice profile requires the new voice evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Voice Rebuild", projectType: "standalone", profile: "thriller" });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [{ path: "series/voice-profile.md", content: "# Voice Profile\n\nControlled and specific.\n" }],
    }), /taste-profile\.yaml/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("rebuilding a book plan requires research ledger and book strategy evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Book Rebuild", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "book-planning";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const bookRoot = join(root, "books", "book-01");
    const files = [
      "book-bible.md", "genre.yaml", "plot-grid.yaml", "chapter-queue.yaml", "continuity-delta.yaml", "remarkability.yaml",
    ].map((name) => ({ path: `books/book-01/${name}`, content: readFileSync(join(bookRoot, name), "utf8") }));
    files.push({ path: "series/story-threads.yaml", content: readFileSync(join(root, "series", "story-threads.yaml"), "utf8") });

    assert.throws(() => applyNovelEvent(root, {
      eventType: "book-plan",
      expectedStage: "book-planning",
      expectedProjectHash: projectStateHash(root),
      files,
    }), /book-strategy\.yaml/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
