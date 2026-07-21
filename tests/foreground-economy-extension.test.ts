import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ForegroundEconomyTelemetry } from "../src/application/foreground-economy-telemetry.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { createDraftableQualityProject } from "./quality-project-fixture.js";

function commandContext(root: string) {
  return {
    cwd: root,
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

test("economy novel-draft records the completed foreground Pi turn", async () => {
  const project = createDraftableQualityProject("economy");
  let now = 1_000;
  try {
    const commands = new Map<string, any>();
    const handlers = new Map<string, Array<(event: any, context: any) => unknown>>();
    const messages: string[] = [];
    const tracker = new ForegroundEconomyTelemetry({ now: () => now, runId: () => "ECO-EVENT" });
    registerNovelForgeWithRecalibration({
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage(message: string) { messages.push(message); },
      on(name: string, handler: (event: any, context: any) => unknown) {
        handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      },
    } as never, { foregroundTelemetry: tracker });

    await commands.get("novel-draft").handler("1", commandContext(project.root));
    assert.equal(messages.length, 1);
    assert.equal(tracker.active, true);

    await handlers.get("before_agent_start")?.[0]?.({ type: "before_agent_start", prompt: "RAW-EVENT-PROMPT", systemPrompt: "system", systemPromptOptions: {} }, {});
    await handlers.get("model_select")?.[0]?.({ type: "model_select", model: { provider: "fake", id: "economy-model" }, previousModel: undefined, source: "set" }, {});
    now = 1_150;
    await handlers.get("turn_end")?.[0]?.({
      type: "turn_end",
      turnIndex: 0,
      message: {
        role: "assistant",
        content: [{ type: "text", text: "RAW-EVENT-OUTPUT" }],
        provider: "fake",
        model: "economy-model",
        usage: { input: 400, cacheRead: 50, cacheWrite: 10, output: 100, reasoning: 20, cost: { total: 0.002 } },
        stopReason: "stop",
      },
      toolResults: [],
    }, { getContextUsage: () => ({ tokens: 800, contextWindow: 128_000, percent: 0.625 }) });

    assert.equal(tracker.active, false);
    const reportText = readFileSync(join(project.root, ".pi-book", "runs", "ECO-EVENT", "run-report.json"), "utf8");
    const report = JSON.parse(reportText) as { modelCalls: Array<{ inputTokens: number; outputTokens: number; estimated: boolean }> };
    assert.equal(report.modelCalls.length, 1);
    assert.equal(report.modelCalls[0]?.inputTokens, 460);
    assert.equal(report.modelCalls[0]?.outputTokens, 100);
    assert.equal(report.modelCalls[0]?.estimated, false);
    assert.equal(reportText.includes("RAW-EVENT-PROMPT"), false);
    assert.equal(reportText.includes("RAW-EVENT-OUTPUT"), false);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});
