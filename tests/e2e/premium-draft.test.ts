import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { ModelCallReport } from "../../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../../src/domain/quality-worker.js";
import { registerNovelForgeWithRecalibration } from "../../src/pi/recalibration-extension.js";
import { createDraftableQualityProject } from "../quality-project-fixture.js";

function sha(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function meta(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("Missing quality metadata.");
  return JSON.parse(line) as Record<string, unknown>;
}

class PremiumWorker implements QualityWorker {
  calls: QualityWorkerRequest[] = [];
  async resolveModelCapacity() { return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls.push(request);
    const value = meta(request.prompt);
    const common = {
      schema_version: "1.0.0",
      run_id: value.run_id,
      chapter: value.chapter,
      source_hashes: value.source_hashes,
      creation_order: value.creation_order,
    };
    const outputType = String(value.output_type);
    let text: string;
    if (outputType === "scene-plan") text = JSON.stringify({ ...common, artifact_type: "scene-plan", objective: "Make access costly.", beats: ["Enter", "Lose access", "Choose"], protected_constraints: ["Preserve endpoint."], ending_hook: "The record changes.", evidence_refs: ["CAN-001"] });
    else if (outputType === "draft-candidate") text = JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: value.candidate_id, text: `# Chapter 1\n\n${value.candidate_id} opens the lying door.\n`, proposed_delta: { canon: [], relationships: [], threads: [] } });
    else if (outputType === "candidate-selection") text = JSON.stringify({ ...common, artifact_type: "candidate-selection", candidate_ids: value.candidate_ids, selected_candidate_id: "CAND-02", rationale: "The consequence is sharper.", evidence: ["Mara pays for entry."] });
    else if (outputType === "lane-critique") text = JSON.stringify({ ...common, artifact_type: "lane-critique", candidate_id: "CAND-02", lane: value.lane, findings: [], verdict: "accept" });
    else if (outputType === "event-output") text = JSON.stringify({ schema_version: "1.0.0", chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-chapter-1.md", content: "# Chapter 1\n\nThe lying door opened, and Mara lost the authority that brought her there.\n" }], summary: "Premium synthesis complete." });
    else throw new Error(`Unexpected output type ${outputType}`);
    const usage: ModelCallReport = {
      callId: request.callId,
      stage: request.stage,
      chapter: request.chapter,
      pass: request.pass,
      provider: "fake",
      model: "quality-model",
      inputTokens: 100,
      outputTokens: 50,
      estimated: false,
      elapsedMs: 1,
      finishReason: "stop",
      promptHash: sha(request.prompt),
      contextHash: sha(request.context ?? ""),
      outputHash: sha(text),
    };
    return { text, usage };
  }
}

function harness(worker: PremiumWorker) {
  const commands = new Map<string, any>();
  const messages: string[] = [];
  const notifications: string[] = [];
  registerNovelForgeWithRecalibration({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage(message: string) { messages.push(message); },
  } as never, { createQualityWorker: () => worker });
  return { commands, messages, notifications };
}

function context(root: string, notifications: string[]) {
  return {
    cwd: root,
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => true,
      editor: async () => undefined,
      notify(message: string) { notifications.push(message); },
    },
    isIdle: () => true,
  };
}

test("premium novel-draft runs isolated passes while economy retains the host prompt path", async () => {
  const premiumProject = createDraftableQualityProject("premium");
  const economyProject = createDraftableQualityProject("economy");
  try {
    const premiumWorker = new PremiumWorker();
    const premium = harness(premiumWorker);
    await premium.commands.get("novel-draft").handler("1", context(premiumProject.root, premium.notifications));
    assert.equal(premium.messages.length, 0);
    assert.equal(premiumWorker.calls.length, 8);
    assert.ok(premium.notifications.some((message) => /premium quality draft complete/i.test(message)));
    assert.match(readFileSync(join(premiumProject.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md"), "utf8"), /lost the authority/);

    let economyWorkerCreated = false;
    const economyCommands = new Map<string, any>();
    const economyMessages: string[] = [];
    registerNovelForgeWithRecalibration({
      registerCommand(name: string, definition: any) { economyCommands.set(name, definition); },
      registerTool() {},
      sendUserMessage(message: string) { economyMessages.push(message); },
    } as never, { createQualityWorker: () => { economyWorkerCreated = true; return new PremiumWorker(); } });
    await economyCommands.get("novel-draft").handler("1", context(economyProject.root, []));
    assert.equal(economyWorkerCreated, false);
    assert.equal(economyMessages.length, 1);
    assert.equal(existsSync(join(economyProject.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
  } finally {
    rmSync(premiumProject.parent, { recursive: true, force: true });
    rmSync(economyProject.parent, { recursive: true, force: true });
  }
});
