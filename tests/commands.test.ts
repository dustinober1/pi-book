import test from "node:test";
import assert from "node:assert/strict";
import { registerNovelForge } from "../src/pi/extension.js";

test("Pi adapter exposes the guided shell, browser wizard, power-user commands, administration, and the transactional event tool", () => {
  const commands = new Map<string, unknown>();
  const tools = new Map<string, unknown>();
  const pi = {
    registerCommand(name: string, definition: unknown) { commands.set(name, definition); },
    registerTool(definition: { name: string }) { tools.set(definition.name, definition); },
    sendUserMessage() {},
  };
  registerNovelForge(pi as never);
  const normal = ["novel", "novel-wizard", "novel-start", "novel-status", "novel-plan", "novel-run", "novel-draft", "novel-review", "novel-readers", "novel-revise", "novel-package", "novel-adopt"];
  assert.deepEqual([...commands.keys()].filter((name) => name !== "novel-migrate"), normal);
  assert.ok(commands.has("novel-migrate"));
  assert.ok(tools.has("novel_apply_event"));
  assert.equal(commands.size, 13);
});
