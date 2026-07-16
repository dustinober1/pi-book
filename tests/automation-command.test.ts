import test from "node:test";
import assert from "node:assert/strict";
import { parseRunOptions } from "../src/pi/arguments.js";
import { registerNovelForge } from "../src/pi/extension.js";

test("run options parse resume pause and cancel and reject conflicting controls", () => {
  assert.deepEqual(parseRunOptions("--resume"), {
    resume: true,
    pause: false,
    cancel: false,
    noProse: false,
    reviewOnly: false,
    stopOnWarning: false,
  });
  assert.deepEqual(parseRunOptions("--pause"), {
    resume: false,
    pause: true,
    cancel: false,
    noProse: false,
    reviewOnly: false,
    stopOnWarning: false,
  });
  assert.deepEqual(parseRunOptions("--cancel"), {
    resume: false,
    pause: false,
    cancel: true,
    noProse: false,
    reviewOnly: false,
    stopOnWarning: false,
  });
  assert.throws(() => parseRunOptions("--resume --pause"), /mutually exclusive|one of/i);
  assert.throws(() => parseRunOptions("--pause --cancel"), /mutually exclusive|one of/i);
});

test("novel-run command documents resume pause and cancel", () => {
  const commands = new Map<string, any>();
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage() {},
  } as never);
  const run = commands.get("novel-run");
  assert.ok(run);
  assert.match(run.description, /resume|pause|persistent/i);
});
