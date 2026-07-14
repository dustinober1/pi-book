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
    const book = bookPlanPrompt(root);
    assert.match(book, /safe, predictable version/i);
    assert.match(book, /uniquely deliver/i);
    assert.match(book, /moment should readers retell/i);
    assert.match(book, /remain alive after the ending/i);
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