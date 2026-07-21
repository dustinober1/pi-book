import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelCallReport } from "../../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../../src/domain/quality-worker.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { readProject } from "../../src/project/store.js";
import { registerNovelForgeWithRecalibration } from "../../src/pi/recalibration-extension.js";
import { createDraftableQualityProject } from "../quality-project-fixture.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("missing metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

class CommandPersistentWorker implements QualityWorker {
  calls = 0;
  async resolveModelCapacity() { return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls += 1;
    const meta = metadata(request.prompt);
    const chapter = Number(meta.chapter);
    const common = { schema_version: "1.0.0", run_id: meta.run_id, chapter, source_hashes: meta.source_hashes, creation_order: meta.creation_order };
    const type = String(meta.output_type);
    let text: string;
    if (type === "scene-plan") text = JSON.stringify({ ...common, artifact_type: "scene-plan", objective: "Escalate.", beats: ["Enter", "Choose"], protected_constraints: [], ending_hook: "Pressure.", evidence_refs: [] });
    else if (type === "draft-candidate") text = JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: meta.candidate_id, text: `# Chapter ${chapter}\n\nCandidate.\n`, proposed_delta: { canon: [], relationships: [], threads: [] } });
    else if (type === "candidate-selection") text = JSON.stringify({ ...common, artifact_type: "candidate-selection", candidate_ids: meta.candidate_ids, selected_candidate_id: "CAND-02", rationale: "Sharper.", evidence: ["Concrete consequence."] });
    else if (type === "lane-critique") text = JSON.stringify({ ...common, artifact_type: "lane-critique", candidate_id: meta.candidate_id, lane: meta.lane, findings: [], verdict: "accept" });
    else if (type === "event-output") text = JSON.stringify({ schema_version: "1.0.0", chapter, files: [{ path: `books/book-01/manuscript/chapters/${String(chapter).padStart(2, "0")}-chapter-${chapter}.md`, content: `# Chapter ${chapter}\n\nPersistent command drafted Chapter ${chapter}.\n` }], summary: "Done." });
    else if (type === "claim-extraction") text = JSON.stringify({ ...common, artifact_type: "claim-extraction", claims: [] });
    else if (type === "claim-audit") text = JSON.stringify({ ...common, artifact_type: "claim-audit", findings: [] });
    else throw new Error(`unexpected ${type}`);
    const usage: ModelCallReport = {
      callId: request.callId,
      stage: request.stage,
      ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
      pass: request.pass,
      inputTokens: 100,
      outputTokens: 50,
      estimated: false,
      elapsedMs: 1,
      promptHash: hash(request.prompt),
      contextHash: hash(request.context ?? ""),
      outputHash: hash(text),
    };
    return { text, usage };
  }
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

test("premium novel-run starts and resumes isolated persistent drafting without host prompts", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const state = readProject(project.root);
    state.automation.require_first_chapter_approval = false;
    state.quality!.budget.maximum_calls_per_chapter = 20;
    writeFileSync(join(project.root, "PROJECT.yaml"), stringifyYaml(state), "utf8");

    const commands = new Map<string, any>();
    const messages: string[] = [];
    const notifications: string[] = [];
    const worker = new CommandPersistentWorker();
    registerNovelForgeWithRecalibration({
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage(message: string) { messages.push(message); },
    } as never, { createQualityWorker: () => worker });

    await commands.get("novel-run").handler("--max-chapters 2 --until next-milestone", context(project.root, notifications));
    assert.equal(messages.length, 0);
    assert.equal(readProject(project.root).automation.active_run?.status, "paused");
    assert.equal(readProject(project.root).automation.active_run?.completedEventKeys.length, 2);
    assert.ok(notifications.some((message) => /paused.*chapter-limit/i.test(message)));

    await commands.get("novel-run").handler("--resume", context(project.root, notifications));
    assert.equal(messages.length, 0);
    const final = readProject(project.root);
    assert.equal(final.current_stage, "manuscript-review");
    assert.equal(final.automation.active_run?.status, "stopped");
    assert.equal(final.automation.active_run?.completedEventKeys.length, 4);
    assert.ok(worker.calls > 20);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});
