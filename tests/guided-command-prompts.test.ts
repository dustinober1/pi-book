import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanPrompt, seriesPlanPrompt, voicePlanPrompt } from "../src/application/prompts.js";
import { registerNovelForge } from "../src/pi/extension.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-guided-command-")); }

test("planning prompts conduct short one-at-a-time author interviews", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Interview", projectType: "planned-series", profile: "thriller" });
    for (const prompt of [voicePlanPrompt(root), seriesPlanPrompt(root), bookPlanPrompt(root)]) {
      assert.match(prompt, /existing evidence first/i);
      assert.match(prompt, /one question at a time/i);
      assert.match(prompt, /no more than four/i);
      assert.match(prompt, /complete typed|complete required/i);
    }
    const voice = voicePlanPrompt(root);
    for (const path of [
      "series/voice-profile.md",
      "series/taste-profile.yaml",
      "series/voice-guardrails.yaml",
      "series/voice-experiments/index.yaml",
    ]) assert.match(voice, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), path);
    assert.match(voice, /admired_for/i);
    assert.match(voice, /not_for/i);
    assert.match(voice, /neutral derived traits/i);
    assert.match(voice, /600[–-]900 words/i);
    assert.match(voice, /anonymous variants A, B, and C/i);
    assert.match(voice, /never label a variant with an author or book/i);
    assert.match(voice, /research-update/i);
    assert.match(voice, /writer samples.*outrank/i);

    const series = seriesPlanPrompt(root);
    assert.match(series, /canon\.yaml top level requires schema_version 1\.0\.0, facts as an array, and relationships as an array/i);
    assert.match(series, /facts entries require.*id, category, subject, fact,.*source.*status.*introduced_in/i);
    assert.match(series, /relationship entries require id, characters.*state, trust, public_status, private_status, unresolved,.*status/i);
    assert.match(series, /characters is an array of at least two strings.*unresolved is an array of strings/i);
    assert.match(series, /story-threads\.yaml top level requires schema_version 1\.0\.0 and threads as an array/i);
    assert.match(series, /thread entries require id, type, setup, reader_knows, characters_know, status, intended_payoff,.*last_advanced_in/i);
    assert.match(series, /characters_know is a string-to-string map.*intended_payoff and last_advanced_in are each a string or null/i);
    assert.match(series, /status must be locked or provisional/i);
    assert.match(series, /planned, open, advanced, paid-off, or abandoned/i);
    assert.match(series, /submit all four series-plan files in one event/i);

    const book = bookPlanPrompt(root);
    assert.match(book, /safe, predictable version/i);
    assert.match(book, /uniquely deliver/i);
    assert.match(book, /moment should readers retell/i);
    assert.match(book, /remain alive after the ending/i);
    assert.match(book, /research-ledger\.yaml/);
    assert.match(book, /book-strategy\.yaml/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("real Pi boundary registers the guided root and adoption commands", async () => {
  const commands = new Map<string, any>();
  const notices: string[] = [];
  const pi = {
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage() {},
  };
  registerNovelForge(pi as never);
  assert.ok(commands.has("novel"));
  assert.ok(commands.has("novel-adopt"));
  const context = {
    cwd: temp(),
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => false,
      editor: async () => undefined,
      notify(message: string) { notices.push(message); },
    },
    isIdle: () => true,
  };
  try {
    await commands.get("novel").handler("", context);
    assert.ok(notices.some((message) => /novel-start/i.test(message)));
  } finally { rmSync(context.cwd, { recursive: true, force: true }); }
});
