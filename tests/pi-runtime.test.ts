import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";
import { projectStateHash } from "../src/application/events.js";
import { defaultResearchLedger } from "../src/domain/v1-3-schemas.js";
import { gitHeadInfo, gitState } from "../src/infrastructure/git.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { readProject } from "../src/project/store.js";

function voiceFiles(root: string, profile: string) {
  return [
    { path: "series/voice-profile.md", content: profile },
    { path: "series/taste-profile.yaml", content: readFileSync(join(root, "series", "taste-profile.yaml"), "utf8") },
    { path: "series/voice-guardrails.yaml", content: readFileSync(join(root, "series", "voice-guardrails.yaml"), "utf8") },
    { path: "series/voice-experiments/index.yaml", content: readFileSync(join(root, "series", "voice-experiments", "index.yaml"), "utf8") },
  ];
}

test("real Pi command and tool boundary creates a clean checkpointed project and applies voice and research events", async () => {
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
    assert.match(JSON.stringify(tool.parameters), /research-update/);
    const researchResult = await tool.execute("call-research", {
      project_root: root,
      event_type: "research-update",
      expected_stage: "voice-intake",
      expected_project_hash: projectStateHash(root),
      files: [{ path: "books/book-01/research-ledger.yaml", content: stringifyYaml(defaultResearchLedger()) }],
    }, new AbortController().signal, undefined, { cwd: root });
    assert.match(researchResult.content[0].text, /Applied research-update/);
    assert.equal(readProject(root).current_stage, "voice-intake");

    const result = await tool.execute("call-voice", {
      project_root: root,
      event_type: "voice-profile",
      expected_stage: "voice-intake",
      expected_project_hash: projectStateHash(root),
      files: voiceFiles(root, "# Voice Profile\n\nDistinct compression and withheld emotion.\n"),
    }, new AbortController().signal, undefined, { cwd: root });
    assert.match(result.content[0].text, /Applied voice-profile/);
    assert.equal(readProject(root).gates["voice-approval"], "pending");
    assert.equal(gitState(root).dirty, 0);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
