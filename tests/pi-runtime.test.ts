import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";
import { projectStateHash } from "../src/application/events.js";
import { gitHeadInfo, gitState } from "../src/infrastructure/git.js";
import { readProject } from "../src/project/store.js";

test("real Pi command and tool boundary creates a clean checkpointed project and applies a voice event", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-pi-runtime-"));
  try {
    const commands = new Map<string, any>();
    const tools = new Map<string, any>();
    const messages: string[] = [];
    const pi = {
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool(definition: any) { tools.set(definition.name, definition); },
      sendUserMessage(message: string) { messages.push(message); },
    };
    registerNovelForge(pi as never);
    const context = {
      cwd: parent,
      hasUI: true,
      ui: {
        input: async () => "100000",
        select: async () => undefined,
        confirm: async () => true,
        editor: async () => undefined,
        notify() {},
      },
      isIdle: () => true,
    };
    await commands.get("novel-start").handler('"Runtime Project" thriller standalone', context);
    const root = join(parent, "runtime-project");
    assert.ok(existsSync(join(root, "PROJECT.yaml")));
    assert.equal(gitState(root).dirty, 0);
    assert.match(gitHeadInfo(root)?.subject ?? "", /^Novel Forge: initialize/);

    const tool = tools.get("novel_apply_event");
    const result = await tool.execute("call-1", {
      project_root: root,
      event_type: "voice-profile",
      expected_stage: "voice-intake",
      expected_project_hash: projectStateHash(root),
      files: [{ path: "series/voice-profile.md", content: "# Voice Profile\n\nDistinct compression and withheld emotion.\n" }],
    }, new AbortController().signal, undefined, { cwd: root });
    assert.match(result.content[0].text, /Applied voice-profile/);
    assert.equal(readProject(root).gates["voice-approval"], "pending");
    assert.equal(gitState(root).dirty, 0);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});