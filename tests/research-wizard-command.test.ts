import test from "node:test";
import assert from "node:assert/strict";
import { registerNovelForge } from "../src/pi/extension.js";

test("novel-wizard command offers research as a workflow completion", () => {
  const commands = new Map<string, any>();
  const pi = {
    registerCommand(name: string, definition: unknown) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage() {},
  };
  registerNovelForge(pi as never);
  const wizard = commands.get("novel-wizard");
  assert.ok(wizard);
  const values = wizard.getArgumentCompletions("").map((item: { value: string }) => item.value);
  assert.deepEqual(values, ["adoption", "readers", "packaging", "next-book", "research"]);
  assert.match(wizard.description, /research/i);
});
