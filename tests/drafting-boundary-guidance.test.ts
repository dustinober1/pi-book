import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { parseSceneCriticSelection } from "../src/pi/arguments.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

const skill = readFileSync(join(process.cwd(), "SKILL.md"), "utf8");

function draftingProject(parent: string): string {
  const root = initializeProject(parent, { projectName: "Drafting Boundary", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return root;
}

function rejectionFor(root: string, path: string): string {
  let message = "";
  assert.throws(() => applyNovelEvent(root, {
    eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 1,
    files: [{ path, content: "# Chapter One\n\nProse.\n" }],
  }), (error: Error) => { message = error.message; return true; });
  return message;
}

test("a misnamed chapter file is rejected with the actual naming rule", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-drafting-"));
  try {
    const root = draftingProject(parent);
    const message = rejectionFor(root, "books/book-01/manuscript/chapters/chapter-001.md");
    assert.match(message, /is not allowed for draft-chapter/);
    assert.match(message, /must begin with the chapter number/i);
    assert.match(message, /001-a-short-slug\.md/);
    assert.match(message, /chapter-001\.md does not match/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a chapter file outside the chapters directory names the required directory", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-drafting-"));
  try {
    const root = draftingProject(parent);
    const message = rejectionFor(root, "books/book-01/manuscript/chapter-001.md");
    assert.match(message, /books\/book-01\/manuscript\/chapters\//);
    assert.match(message, /must begin with the chapter number/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an unrelated disallowed path is not given a manuscript naming hint", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-drafting-"));
  try {
    const root = draftingProject(parent);
    let message = "";
    assert.throws(() => applyNovelEvent(root, {
      eventType: "draft-chapter", expectedStage: "drafting", expectedProjectHash: projectStateHash(root), chapter: 1,
      files: [{ path: "series/canon.yaml", content: "schema_version: \"1.0.0\"\n" }],
    }), (error: Error) => { message = error.message; return true; });
    assert.match(message, /series\/canon\.yaml is not allowed for draft-chapter/);
    assert.doesNotMatch(message, /must begin with the chapter number/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a correctly named chapter file passes the path allowlist", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-drafting-"));
  try {
    const root = draftingProject(parent);
    // The event still fails later validation in this bare fixture; the point is
    // that it is no longer rejected for its path.
    const message = rejectionFor(root, "books/book-01/manuscript/chapters/001-the-midnight-hatch.md");
    assert.doesNotMatch(message, /is not allowed for draft-chapter/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the scene critic selection rejects a profile name and names the valid critics", () => {
  assert.throws(() => parseSceneCriticSelection("historical-fiction"), /Unknown scene critic: historical-fiction/);
  assert.deepEqual(parseSceneCriticSelection("continuity,style"), ["critic-continuity", "critic-style"]);
});

test("the chapter step tool enumerates its critics so an invalid value cannot be sent", async () => {
  const { registerChapterStepCommand } = await import("../src/pi/chapter-step-command.js");
  const tools: { name: string; parameters: unknown }[] = [];
  const api = {
    registerTool: (tool: { name: string; parameters: unknown }) => { tools.push(tool); },
    registerCommand: () => {},
  };
  registerChapterStepCommand(api as never, {});
  const tool = tools.find((item) => item.name === "novel_advance_chapter_step");
  assert.ok(tool, "novel_advance_chapter_step should be registered");
  const critics = (tool!.parameters as { properties: { critics: { items: { anyOf: { const: string }[] } } } }).properties.critics;
  const allowed = critics.items.anyOf.map((item) => item.const);
  assert.deepEqual(allowed, ["continuity", "causality", "character-intent", "style", "factuality", "all"]);
});

test("the chapter contract failure explains how to produce a contract and what to do meanwhile", async () => {
  const { prepareChapterExecution } = await import("../src/application/chapter-execution-preparation.js");
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-drafting-"));
  try {
    const root = draftingProject(parent);
    let message = "";
    try {
      await prepareChapterExecution({ root, chapter: 1, runId: "run-001" } as never);
    } catch (error) { message = (error as Error).message; }
    assert.match(message, /contracts\/chapters\/CH-001\.yaml/);
    assert.match(message, /authored, not generated/i);
    assert.match(message, /chapter-queue event/);
    assert.match(message, /draft-chapter event instead/);
    assert.match(message, /without guarded scene execution/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("SKILL.md forbids writing, moving, or deleting inside the project root", () => {
  assert.match(skill, /Never create, move, rename, or delete any file inside the project root/);
  assert.match(skill, /`rm -rf` inside the project root/);
  assert.match(skill, /never means rearrange the working tree until the check passes|it never means rearrange the working tree/i);
});

test("SKILL.md tells agents not to read the implementation source", () => {
  assert.match(skill, /Do not go looking for the implementation's source/);
  assert.match(skill, /a checkout elsewhere on the machine can be a different version/);
  assert.doesNotMatch(skill, /Check the relevant `Type\.Object\(\.\.\.\)` schema in `src\/domain\/schemas\.ts`/);
});

test("SKILL.md documents the chapter file naming rule and the contract requirement", () => {
  assert.match(skill, /must \*\*begin with the chapter number\*\*/);
  assert.match(skill, /`001-the-midnight-hatch\.md`/);
  assert.match(skill, /`chapter-001\.md`, does not match/);
  assert.match(skill, /contracts\/chapters\/CH-NNN\.yaml/);
  assert.match(skill, /Never silently substitute hand-drafting for the guarded path/);
});

test("SKILL.md lists payload-validation as retryable", () => {
  assert.match(skill, /`schema-validation`, `reference-validation`, or `payload-validation`/);
});
