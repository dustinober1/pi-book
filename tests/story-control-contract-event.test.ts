import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileLegacyChapterContract } from "../src/application/contracts/chapter-contract-compiler.js";
import { renderChapterContract } from "../src/application/contracts/chapter-contract-renderer.js";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture } from "./phase4-fixtures.js";

const chapterOneContractPath = "books/book-01/contracts/chapters/CH-001.yaml";

test("chapter queue events may store schema-validated compiled contracts", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-contract-event-"));
  try {
    const root = initializeProject(parent, { projectName: "Contract Event", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "chapter-queue";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const queue = queueFixture();
    for (const packet of queue.packets) packet.required_research = [];
    writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
    writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
    const contractContent = renderChapterContract(compileLegacyChapterContract(queue.packets[0]!));
    const result = applyNovelEvent(root, {
      eventType: "chapter-queue",
      expectedStage: "chapter-queue",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queue) },
        { path: chapterOneContractPath, content: contractContent },
      ],
    });
    assert.equal(result.stage, "drafting");
    assert.equal(existsSync(join(root, chapterOneContractPath)), true);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("draft events cannot bypass contract ownership", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-contract-event-"));
  try {
    const root = initializeProject(parent, { projectName: "Contract Draft", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const contractContent = renderChapterContract(compileLegacyChapterContract(queueFixture().packets[0]!));
    assert.throws(() => applyNovelEvent(root, {
      eventType: "draft-chapter",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      chapter: 1,
      files: [{ path: chapterOneContractPath, content: contractContent }],
    }), /not allowed/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
