import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";
import { readProject } from "../src/project/store.js";

test("novel-start accepts an authorized brief and starts target autopilot", async () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-start-brief-"));
  try {
    const brief = join(parent, "brief.md");
    const content = `# Brief\n\n## Idea\nMara follows a signal no one else can hear.\n\nLanguage: English\nAudience: Adult thriller readers\nProfile: thriller\nTarget Words: 110000\n`;
    writeFileSync(brief, content, "utf8");
    const commands = new Map<string, any>();
    const messages: string[] = [];
    registerNovelForge({
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage(message: string) { messages.push(message); },
    } as never);
    const context = {
      cwd: parent,
      hasUI: true,
      ui: { input: async () => undefined, select: async () => undefined, confirm: async () => true, editor: async () => undefined, notify() {} },
      isIdle: () => true,
    };
    await commands.get("novel-start").handler(`"Brief Project" --profile thriller --type planned-series --target-words 110000 --brief "${brief}" --auto-to book-plan-approval`, context);
    const root = join(parent, "brief-project");
    assert.equal(existsSync(join(root, "PROJECT.yaml")), true);
    assert.equal(readFileSync(brief, "utf8"), content);
    assert.equal((readProject(root) as any).automation.active_run?.target, "book-plan-approval");
    assert.ok(messages.some((message) => /voice intake|voice/i.test(message)));
    assert.equal(existsSync(join(root, "brief.md")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
