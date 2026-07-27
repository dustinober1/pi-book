import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";

/**
 * The README quick start is exactly:
 *
 *   /novel-start My Novel --profile thriller --type planned-series --target-words 110000
 *   /novel
 *
 * run from the same shell directory, with no cd in between. novel-start
 * creates the project one directory below that cwd, and nothing moves the
 * shell into it, so /novel must still be able to find the project it just
 * created — this is what requireProjectRoot's sibling-project fallback exists
 * for. These tests exercise the actual command handlers, not just the
 * underlying resolver, so a regression here would be the same failure the
 * writer would see at the terminal.
 */
function harness(cwd: string) {
  const commands = new Map<string, any>();
  const notifications: Array<{ message: string; level: string }> = [];
  const sentMessages: string[] = [];
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage(message: string) { sentMessages.push(message); },
  } as never);
  const context = {
    cwd,
    hasUI: true,
    ui: {
      input: async (_prompt: string, fallback?: string) => fallback,
      select: async (_prompt: string, options: string[]) => options[0],
      confirm: async () => true,
      editor: async () => undefined,
      notify: (message: string, level: string) => notifications.push({ message, level }),
    },
    isIdle: () => true,
  };
  return { commands, notifications, sentMessages, context };
}

test("novel-status run immediately after novel-start, from the same directory, finds the project", async () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-start-then-status-"));
  try {
    const { commands, notifications, context } = harness(parent);
    await commands.get("novel-start").handler(`"My Novel" --profile thriller --type standalone --target-words 100000`, context);
    assert.equal(existsSync(join(parent, "my-novel", "PROJECT.yaml")), true);

    notifications.length = 0;
    await commands.get("novel-status").handler("", context);

    assert.equal(notifications.length, 1, "novel-status should notify exactly once");
    assert.equal(notifications[0]?.level, "info");
    assert.doesNotMatch(notifications[0]?.message ?? "", /No Novel Forge project found/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("novel (the guided command) run immediately after novel-start reaches voice intake, not the missing-project warning", async () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-start-then-novel-"));
  try {
    const { commands, notifications, context } = harness(parent);
    await commands.get("novel-start").handler(`"My Novel" --profile thriller --type standalone --target-words 100000`, context);

    notifications.length = 0;
    await commands.get("novel").handler("", context);

    assert.equal(notifications.some((item) => /No Novel Forge project found/.test(item.message)), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("novel-budget run immediately after novel-start, from the same directory, reports the new project's budget", async () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-start-then-budget-"));
  try {
    const { commands, notifications, context } = harness(parent);
    await commands.get("novel-start").handler(`"My Novel" --profile thriller --type standalone --target-words 100000`, context);

    notifications.length = 0;
    await commands.get("novel-budget").handler("", context);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.level, "info");
    assert.match(notifications[0]?.message ?? "", /economy/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a second novel-start in the same parent directory makes the next command ambiguous, not silently wrong", async () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-start-twice-"));
  try {
    const { commands, notifications, context } = harness(parent);
    await commands.get("novel-start").handler(`"Novel A" --profile thriller --type standalone --target-words 100000`, context);
    await commands.get("novel-start").handler(`"Novel B" --profile thriller --type standalone --target-words 100000`, context);

    notifications.length = 0;
    await commands.get("novel-status").handler("", context);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.level, "warning");
    assert.match(notifications[0]?.message ?? "", /Multiple Novel Forge projects exist directly under/);
    assert.match(notifications[0]?.message ?? "", /novel-a/);
    assert.match(notifications[0]?.message ?? "", /novel-b/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
