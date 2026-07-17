import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";
import { initializeProject, readProject } from "../src/project/store.js";

function commandHarness() {
  const commands = new Map<string, any>();
  const messages: string[] = [];
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage(message: string) { messages.push(message); },
  } as never);
  return { commands, messages };
}

function context(cwd: string) {
  return {
    cwd,
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => true,
      editor: async () => undefined,
      notify() {},
    },
    isIdle: () => true,
  };
}

test("novel-start stores an explicit runtime profile without treating it as project name text", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-runtime-start-"));
  try {
    const { commands } = commandHarness();
    await commands.get("novel-start").handler(
      '"Tiny Project" --profile thriller --type standalone --target-words 100000 --runtime-profile tiny-local',
      context(parent),
    );
    const root = join(parent, "tiny-project");
    assert.equal(existsSync(root), true);
    assert.equal(readProject(root).runtime?.profile, "tiny-local");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel-run forwards the explicit runtime profile into the persistent run", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-runtime-run-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Run Profile",
      projectType: "standalone",
      profile: "thriller",
      runtimeProfile: "full",
    });
    const { commands } = commandHarness();
    await commands.get("novel-run").handler(
      "--runtime-profile tiny-local --max-chapters 8 --until next-milestone",
      context(root),
    );
    const run = readProject(root).automation.active_run;
    assert.equal(run?.runtimeProfile, "tiny-local");
    assert.equal(run?.requestedMaxChapters, 1);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
