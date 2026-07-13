import test from "node:test";
import assert from "node:assert/strict";
import { registerNovelForge } from "../src/pi/extension.js";
import type { PiCommandDefinition, PiExtensionApi } from "../src/pi/types.js";

test("Pi adapter exposes eight normal commands and one administrative migration command", () => {
  const commands = new Map<string, PiCommandDefinition>();
  const pi: PiExtensionApi = {
    registerCommand(name, definition) { commands.set(name, definition); },
    sendUserMessage() {},
  };
  registerNovelForge(pi);
  const normal = ["novel-start", "novel-status", "novel-plan", "novel-run", "novel-draft", "novel-review", "novel-revise", "novel-package"];
  assert.deepEqual([...commands.keys()].filter((name) => name !== "novel-migrate"), normal);
  assert.ok(commands.has("novel-migrate"));
  assert.equal(commands.size, 9);
});
