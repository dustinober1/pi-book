import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beginQualityPersistentRun, resumeQualityPersistentRun } from "../../src/application/quality-run.js";
import { runPersistentQualityDraft } from "../../src/application/quality-persistent-run.js";
import type { ModelCallReport } from "../../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../../src/domain/quality-worker.js";
import { readBudgetLedger } from "../../src/infrastructure/budget-ledger-store.js";
import { parseYaml, stringifyYaml } from "../../src/infrastructure/yaml.js";
import { readProject } from "../../src/project/store.js";
import { ChapterQueueSchema, type ChapterQueueState } from "../../src/domain/schemas.js";
import { createDraftableQualityProject } from "../quality-project-fixture.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("missing metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

class PersistentWorker implements QualityWorker {
  calls: QualityWorkerRequest[] = [];
  async resolveModelCapacity() { return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls.push(request);
    const meta = metadata(request.prompt);
    const chapter = Number(meta.chapter);
    const common = { schema_version: "1.0.0", run_id: meta.run_id, chapter, source_hashes: meta.source_hashes, creation_order: meta.creation_order };
    const type = String(meta.output_type);
    let text: string;
    if (type === "scene-plan") text = JSON.stringify({ ...common, artifact_type: "scene-plan", objective: `Escalate Chapter ${chapter}.`, beats: ["Enter", "Choose"], protected_constraints: [], ending_hook: "Pressure rises.", evidence_refs: ["CAN-001"] });
    else if (type === "draft-candidate") text = JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: meta.candidate_id, text: `# Chapter ${chapter}\n\nCandidate ${meta.candidate_id} advances Chapter ${chapter}.\n`, proposed_delta: { canon: [], relationships: [], threads: [] } });
    else if (type === "candidate-selection") text = JSON.stringify({ ...common, artifact_type: "candidate-selection", candidate_ids: meta.candidate_ids, selected_candidate_id: "CAND-02", rationale: "The choice is concrete.", evidence: ["The consequence appears on page."] });
    else if (type === "lane-critique") text = JSON.stringify({ ...common, artifact_type: "lane-critique", candidate_id: meta.candidate_id, lane: meta.lane, findings: [], verdict: "accept" });
    else if (type === "event-output") text = JSON.stringify({ schema_version: "1.0.0", chapter, files: [{ path: `books/book-01/manuscript/chapters/${String(chapter).padStart(2, "0")}-chapter-${chapter}.md`, content: `# Chapter ${chapter}\n\nMara advances Chapter ${chapter} and pays a concrete cost.\n` }], summary: `Completed Chapter ${chapter}.` });
    else if (type === "claim-extraction") text = JSON.stringify({ ...common, artifact_type: "claim-extraction", claims: [] });
    else if (type === "claim-audit") text = JSON.stringify({ ...common, artifact_type: "claim-audit", findings: [] });
    else throw new Error(`unexpected output ${type}`);
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

function queue(root: string): ChapterQueueState {
  return parseYaml(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), ChapterQueueSchema, "chapter-queue.yaml");
}

test("persistent premium drafting reloads after each chapter and respects pause and stage boundaries", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const state = readProject(project.root);
    state.automation.require_first_chapter_approval = false;
    state.quality!.budget.maximum_calls_per_chapter = 20;
    writeFileSync(join(project.root, "PROJECT.yaml"), stringifyYaml(state), "utf8");

    const started = beginQualityPersistentRun(project.root, {
      target: "next-milestone",
      maxChapters: 2,
      quality: { tier: "premium" },
      now: "2026-07-21T15:00:00Z",
    });
    assert.match(started.message, /RUN-001/);
    const worker = new PersistentWorker();
    const first = await runPersistentQualityDraft({
      root: project.root,
      worker,
      maxChapters: 2,
      now: () => "2026-07-21T15:01:00Z",
    });
    assert.deepEqual(first.chapters.map((item) => item.chapter), [1, 2]);
    assert.equal(first.status, "paused");
    assert.equal(first.stopReason, "chapter-limit");
    assert.equal(readProject(project.root).automation.active_run?.status, "paused");
    assert.deepEqual(queue(project.root).packets.map((item) => ({ chapter: item.chapter, status: item.status })), [
      { chapter: 3, status: "ready" },
      { chapter: 4, status: "ready" },
    ]);
    assert.equal(existsSync(join(project.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), true);
    assert.equal(existsSync(join(project.root, "books", "book-01", "manuscript", "chapters", "02-chapter-2.md")), true);

    const resumed = resumeQualityPersistentRun(project.root);
    assert.match(resumed.message, /Resumed RUN-001/);
    const second = await runPersistentQualityDraft({
      root: project.root,
      worker,
      maxChapters: 2,
      now: () => "2026-07-21T15:02:00Z",
    });
    assert.deepEqual(second.chapters.map((item) => item.chapter), [3, 4]);
    assert.equal(second.status, "stopped");
    assert.equal(second.stopReason, "stage:manuscript-review");
    const finalProject = readProject(project.root);
    assert.equal(finalProject.current_stage, "manuscript-review");
    assert.equal(finalProject.automation.active_run?.status, "stopped");
    assert.equal(finalProject.automation.active_run?.completedEventKeys.length, 4);
    assert.deepEqual(queue(project.root).packets, []);
    const ledger = readBudgetLedger(project.root);
    assert.equal(ledger.reservations.length, 0);
    assert.ok(ledger.settledCalls.length >= 20);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});

test("budget downgrade resume uses a fresh deterministic child attempt with matching manifest and report", async () => {
  const project = createDraftableQualityProject("premium");
  try {
    const state = readProject(project.root);
    state.automation.require_first_chapter_approval = false;
    state.quality!.budget.maximum_calls_per_chapter = 1;
    state.quality!.budget.on_exhaustion = "downgrade";
    writeFileSync(join(project.root, "PROJECT.yaml"), stringifyYaml(state), "utf8");
    beginQualityPersistentRun(project.root, {
      target: "next-milestone",
      maxChapters: 1,
      quality: { tier: "premium" },
      now: "2026-07-21T16:00:00Z",
    });

    const worker = new PersistentWorker();
    const first = await runPersistentQualityDraft({
      root: project.root,
      worker,
      maxChapters: 1,
      now: () => "2026-07-21T16:01:00Z",
    });
    assert.equal(first.status, "paused");
    assert.equal(first.downgradedTo, "balanced");
    assert.equal(worker.calls.length, 1);

    resumeQualityPersistentRun(project.root);
    const second = await runPersistentQualityDraft({
      root: project.root,
      worker,
      maxChapters: 1,
      now: () => "2026-07-21T16:02:00Z",
    });
    assert.equal(second.status, "paused");
    assert.equal(second.downgradedTo, "economy");
    assert.equal(worker.calls.length, 1);

    const attempts = [
      ["RUN-001-CH-001-ATT-001", "premium"],
      ["RUN-001-CH-001-ATT-002", "balanced"],
    ] as const;
    for (const [runId, tier] of attempts) {
      const directory = join(project.root, ".pi-book", "runs", runId);
      const manifest = JSON.parse(readFileSync(join(directory, "quality-job-plan.json"), "utf8"));
      const report = JSON.parse(readFileSync(join(directory, "run-report.json"), "utf8"));
      assert.equal(manifest.tier, tier);
      assert.equal(report.runId, runId);
      assert.equal(report.qualityTier, tier);
    }
    assert.equal(readProject(project.root).automation.active_run?.completedEventKeys.length, 0);
    assert.equal(existsSync(join(project.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});
