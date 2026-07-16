import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertReviewAllowed } from "../src/application/authorization.js";
import { runExplicitVoiceRecalibration } from "../src/application/recalibration.js";
import { VoiceAuditsPhase5Schema, type VoiceAuditsPhase5 } from "../src/domain/v1-3-audit-schemas.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import novelForgeExtension from "../extensions/novel-forge.js";

function setup(stage: "drafting" | "act-review" | "revision" | "manuscript-review" | "packaging" = "drafting") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-recalibration-"));
  try {
    const root = initializeProject(parent, { projectName: "Recalibration", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = stage;
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    return { parent, root };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
}

function approveBaseline(root: string): void {
  const path = join(root, "series", "voice-guardrails.yaml");
  const guardrails = parseYaml<VoiceGuardrails>(readFileSync(path, "utf8"), VoiceGuardrailsSchema, "voice-guardrails.yaml");
  guardrails.baseline.content_hash = "a".repeat(64);
  guardrails.baseline.metrics = {
    average_sentence_words: 9,
    median_sentence_words: 8,
    dialogue_ratio: 0.2,
    fragment_ratio: 0.1,
  };
  writeFileSync(path, stringifyYaml(guardrails), "utf8");
}

function writeChapter(root: string): string {
  const path = join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md");
  const content = "# Chapter 1\n\nMara stopped at the archive door.\n\n\"Wait,\" Jonah said. \"Listen first.\"\n";
  writeFileSync(path, content, "utf8");
  return path;
}

function readAudits(root: string): VoiceAuditsPhase5 {
  const path = join(root, "books", "book-01", "voice-audits.yaml");
  return parseYaml<VoiceAuditsPhase5>(readFileSync(path, "utf8"), VoiceAuditsPhase5Schema, "voice-audits.yaml");
}

test("recalibration review authorization is limited to active creative and review stages", () => {
  for (const stage of ["drafting", "act-review", "revision", "manuscript-review", "packaging"] as const) {
    const { parent, root } = setup(stage);
    try { assert.doesNotThrow(() => assertReviewAllowed(readProject(root), "recalibration"), stage); }
    finally { rmSync(parent, { recursive: true, force: true }); }
  }
  const { parent, root } = setup();
  try {
    const project = readProject(root);
    project.current_stage = "book-planning";
    assert.throws(() => assertReviewAllowed(project, "recalibration"), /book-planning|requires/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("explicit recalibration appends one audit and preserves project, book, gates, and manuscript bytes", () => {
  const { parent, root } = setup("drafting");
  try {
    approveBaseline(root);
    const chapterPath = writeChapter(root);
    const projectBefore = readFileSync(join(root, "PROJECT.yaml"), "utf8");
    const bookBefore = readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8");
    const chapterBefore = readFileSync(chapterPath, "utf8");
    const gatesBefore = structuredClone(readProject(root).gates);
    const result = runExplicitVoiceRecalibration(root);
    const audits = readAudits(root);
    assert.equal(audits.audits.length, 1);
    assert.equal(audits.audits[0]?.scope, "recalibration");
    assert.equal(audits.audits[0]?.assessment, "evidence-only");
    assert.equal(result.stage, "drafting");
    assert.deepEqual(readProject(root).gates, gatesBefore);
    assert.equal(readFileSync(join(root, "PROJECT.yaml"), "utf8"), projectBefore);
    assert.equal(readFileSync(join(root, "books", "book-01", "BOOK.yaml"), "utf8"), bookBefore);
    assert.equal(readFileSync(chapterPath, "utf8"), chapterBefore);
    assert.equal(result.changed.some((path) => path.includes("manuscript/chapters")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("explicit recalibration refuses missing baseline evidence without mutation", () => {
  const { parent, root } = setup();
  try {
    writeChapter(root);
    const auditsBefore = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
    assert.throws(() => runExplicitVoiceRecalibration(root), /approved voice baseline|baseline metrics/i);
    assert.equal(readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8"), auditsBefore);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("explicit recalibration refuses an empty manuscript without mutation", () => {
  const { parent, root } = setup();
  try {
    approveBaseline(root);
    const auditsBefore = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
    assert.throws(() => runExplicitVoiceRecalibration(root), /manuscript chapter|manuscript sample/i);
    assert.equal(readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8"), auditsBefore);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the installed Pi review command exposes and executes recalibration", async () => {
  const { parent, root } = setup();
  try {
    approveBaseline(root);
    writeChapter(root);
    const commands = new Map<string, { getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null; handler: (args: string, context: unknown) => Promise<void> }>();
    const notifications: Array<{ message: string; level: string }> = [];
    const pi = {
      registerCommand(name: string, definition: unknown) { commands.set(name, definition as never); },
      registerTool() {},
      sendUserMessage() {},
    };
    novelForgeExtension(pi as never);
    const review = commands.get("novel-review");
    assert.ok(review);
    const values = review.getArgumentCompletions?.("")?.map((item) => item.value) ?? [];
    assert.ok(values.includes("recalibration"));
    await review.handler("recalibration", {
      cwd: root,
      isIdle: () => true,
      ui: {
        notify(message: string, level: string) { notifications.push({ message, level }); },
        input: async () => undefined,
        select: async () => undefined,
        confirm: async () => false,
      },
    });
    const audits = readAudits(root);
    assert.equal(audits.audits.length, 1);
    assert.equal(audits.audits[0]?.scope, "recalibration");
    assert.ok(notifications.some((item) => /recalibration/i.test(item.message) && item.level === "info"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
