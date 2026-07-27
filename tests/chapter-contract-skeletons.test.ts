import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../src/domain/chapter-contract.js";
import { compileLegacyChapterContract } from "../src/application/contracts/chapter-contract-compiler.js";
import { renderChapterContract } from "../src/application/contracts/chapter-contract-renderer.js";
import { applyNovelEvent, projectStateHash, validateNovelEvent } from "../src/application/events.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture } from "./phase4-fixtures.js";

function writeReferencePrerequisites(root: string): void {
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{
      id: "CAN-001", category: "access", subject: "Mara", fact: "Mara has archive access.",
      source: "series-plan", status: "locked", introduced_in: "book-01",
    }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{
      id: "ST-001", type: "mystery", setup: "The archive log is incomplete.",
      reader_knows: "The log existed.", characters_know: { Mara: "The log is incomplete." },
      status: "open", intended_payoff: "book-01", last_advanced_in: null,
    }],
  }), "utf8");
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-contract-skeleton-"));
  const root = initializeProject(parent, { projectName: "Skeleton", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "chapter-queue";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const queue = queueFixture();
  for (const packet of queue.packets) packet.required_research = [];
  writeReferencePrerequisites(root);
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
  return { parent, root, queue };
}

function queueEvent(root: string, queue: unknown, extra: Array<{ path: string; content: string }> = []) {
  return {
    eventType: "chapter-queue" as const,
    expectedStage: "chapter-queue" as const,
    expectedProjectHash: projectStateHash(root),
    files: [{ path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queue) }, ...extra],
  };
}

function readContract(root: string, path: string): ChapterContract {
  return parseYaml<ChapterContract>(readFileSync(join(root, path), "utf8"), ChapterContractSchema, path);
}

test("a chapter-queue event compiles a contract skeleton for every ready packet", () => {
  const { parent, root, queue } = setup();
  try {
    applyNovelEvent(root, queueEvent(root, queue));
    const ready = queue.packets.filter((packet) => packet.status === "ready");
    assert.ok(ready.length > 0, "fixture must contain ready packets");
    for (const packet of ready) {
      const path = chapterContractPath("book-01", packet.chapter);
      assert.equal(existsSync(join(root, path)), true, `missing skeleton for chapter ${packet.chapter}`);
      const contract = readContract(root, path);
      assert.ok(Value.Check(ChapterContractSchema, contract));
      assert.equal(contract.chapter, packet.chapter);
      assert.equal(contract.source_kind, "legacy-packet");
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a skeleton derives its word band from the packet and never invents semantic fields", () => {
  const { parent, root, queue } = setup();
  try {
    applyNovelEvent(root, queueEvent(root, queue));
    const packet = queue.packets.find((item) => item.status === "ready")!;
    const contract = readContract(root, chapterContractPath("book-01", packet.chapter));

    assert.equal(contract.target_words.minimum, Math.max(300, Math.floor(packet.target_words * 0.85)));
    assert.equal(contract.target_words.maximum, Math.max(contract.target_words.minimum, Math.ceil(packet.target_words * 1.1)));

    // Judgement fields stay empty and are named as missing rather than guessed.
    assert.equal(contract.small_model_ready, false);
    assert.deepEqual(contract.start_state_ids, []);
    assert.deepEqual(contract.required_end_state, []);
    assert.deepEqual(contract.forbidden_changes, []);
    assert.deepEqual(contract.knowledge_boundary_ids, []);
    assert.deepEqual(contract.missing_small_model_fields.slice().sort(), [
      "forbidden_changes", "knowledge_boundary_ids", "required_end_state", "start_state_ids",
    ]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("an authored contract submitted with the event is never overwritten by a skeleton", () => {
  const { parent, root, queue } = setup();
  try {
    const packet = queue.packets.find((item) => item.status === "ready")!;
    const path = chapterContractPath("book-01", packet.chapter);
    const authored: ChapterContract = {
      ...compileLegacyChapterContract(packet),
      version: 7,
      forbidden_changes: ["Mara loses archive access."],
      missing_small_model_fields: ["start_state_ids", "required_end_state", "knowledge_boundary_ids"],
    };
    applyNovelEvent(root, queueEvent(root, queue, [{ path, content: renderChapterContract(authored) }]));

    const stored = readContract(root, path);
    assert.equal(stored.version, 7);
    assert.deepEqual(stored.forbidden_changes, ["Mara loses archive access."]);
    assert.equal(stored.missing_small_model_fields.includes("forbidden_changes"), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("an existing contract on disk is never overwritten by a later queue event", () => {
  const { parent, root, queue } = setup();
  try {
    applyNovelEvent(root, queueEvent(root, queue));
    const packet = queue.packets.find((item) => item.status === "ready")!;
    const path = chapterContractPath("book-01", packet.chapter);

    const completed: ChapterContract = {
      ...readContract(root, path),
      version: 2,
      forbidden_changes: ["Mara loses archive access."],
      missing_small_model_fields: ["start_state_ids", "required_end_state", "knowledge_boundary_ids"],
    };
    writeFileSync(join(root, path), renderChapterContract(completed), "utf8");

    // The first queue event advanced the stage; return to it to re-run.
    const project = readProject(root);
    project.current_stage = "chapter-queue";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    // Re-running the queue event must not revert authored judgement to a skeleton.
    applyNovelEvent(root, queueEvent(root, queue));
    const stored = readContract(root, path);
    assert.equal(stored.version, 2);
    assert.deepEqual(stored.forbidden_changes, ["Mara loses archive access."]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("readiness advisories name the incomplete contracts and the remedy in a dry run", () => {
  const { parent, root, queue } = setup();
  try {
    const result = validateNovelEvent(root, queueEvent(root, queue));
    assert.equal(result.valid, true);
    const text = result.advisories.join("\n");
    assert.match(text, /no executable chapter contract yet/);
    assert.match(text, /novel_advance_chapter_step cannot run/);
    assert.match(text, /Complete them in a chapter-queue event/);
    assert.match(text, /small_model_ready: true/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a fully authored contract set produces no readiness advisory", () => {
  const { parent, root, queue } = setup();
  try {
    const extra = queue.packets.filter((packet) => packet.status === "ready").map((packet) => ({
      path: chapterContractPath("book-01", packet.chapter),
      content: renderChapterContract({
        ...compileLegacyChapterContract(packet),
        start_state_ids: ["ST-001"],
        required_end_state: [{ record_id: "ST-001", field: "status", operation: "set", value: "advanced" }],
        forbidden_changes: ["Mara loses archive access."],
        knowledge_boundary_ids: ["CAN-001"],
        small_model_ready: true,
        missing_small_model_fields: [],
      }),
    }));
    const result = validateNovelEvent(root, queueEvent(root, queue, extra));
    assert.equal(result.valid, true);
    assert.equal(result.advisories.some((item) => /no executable chapter contract yet/.test(item)), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
