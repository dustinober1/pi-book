import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runQualityDraft } from "../src/application/quality-orchestrator.js";
import type { ModelCallReport } from "../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture } from "./phase4-fixtures.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-orchestrator-"));
  const root = initializeProject(parent, {
    projectName: "Premium Orchestrator",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "full",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  project.quality!.tier = "premium";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "access", subject: "Mara", fact: "Mara has archive access.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "The log is missing.", reader_knows: "It existed.", characters_know: { Mara: "It is missing." }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  const queue = queueFixture();
  for (const packet of queue.packets) packet.required_research = [];
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
  writeFileSync(join(root, "books", "book-01", "remarkability.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    safe_obvious_version: "A routine archive breach.",
    author_only_advantage: "Institutional pressure rendered through procedure.",
    productive_discomfort: "Mara protects evidence before safety.",
    retellable_hook: "The building edits its own evacuation record.",
    signature_moments: [{ id: "RM-001", description: "The exit sign changes its testimony.", intended_reader_memory: "The building lies.", planned_location: "chapter-01", status: "planned" }],
    productive_disagreements: [{ question: "Was Mara right to stay?", competing_readings: ["She protected truth.", "She valued proof over people."] }],
    recurring_motifs: [],
    lingering_question: "What evidence is worth a life?",
    hand_sell_reason: "A procedural thriller with a building that falsifies its record.",
    accepted_reader_costs: ["Moral discomfort without reassurance."],
  }), "utf8");
  return { parent, root };
}

function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("Missing request metadata.");
  return JSON.parse(line) as Record<string, unknown>;
}

class ScriptedWorker implements QualityWorker {
  calls: QualityWorkerRequest[] = [];
  constructor(readonly root: string, readonly invalidForever = false) {}
  async resolveModelCapacity() { return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 }; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.calls.push(request);
    assert.equal(existsSync(join(this.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
    const meta = metadata(request.prompt);
    const type = String(meta.output_type);
    const common = {
      schema_version: "1.0.0",
      run_id: String(meta.run_id),
      chapter: Number(meta.chapter),
      source_hashes: meta.source_hashes,
      creation_order: Number(meta.creation_order),
    };
    let text: string;
    if (this.invalidForever && type === "scene-plan") text = "not-json";
    else if (type === "scene-plan") text = JSON.stringify({ ...common, artifact_type: "scene-plan", objective: "Force a costly choice.", beats: ["Enter", "Discover", "Choose"], protected_constraints: ["Preserve endpoint."], ending_hook: "The record changes.", evidence_refs: ["CAN-001", "ST-001"] });
    else if (type === "draft-candidate") {
      const id = String(meta.candidate_id);
      text = JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: id, text: `# Chapter 1\n\n${id} makes the archive door lie.\n`, proposed_delta: { canon: [], relationships: [], threads: [] } });
    } else if (type === "candidate-selection") text = JSON.stringify({ ...common, artifact_type: "candidate-selection", candidate_ids: ["CAND-01", "CAND-02"], selected_candidate_id: "CAND-02", rationale: "The second candidate makes the consequence concrete.", evidence: ["It preserves CAN-001."] });
    else if (type === "lane-critique") {
      const lane = String(meta.lane);
      text = JSON.stringify({ ...common, artifact_type: "lane-critique", candidate_id: "CAND-02", lane, findings: [{ severity: "medium", evidence: `${lane.toUpperCase()}-MARKER`, required_change: `Address ${lane}.` }], verdict: "revise" });
    } else if (type === "event-output") text = JSON.stringify({ schema_version: "1.0.0", chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-chapter-1.md", content: "# Chapter 1\n\nCAND-02 makes the archive door lie, and Mara pays for believing it.\n" }], summary: "Applied isolated critique without changing the endpoint." });
    else throw new Error(`Unexpected output type ${type}.`);
    const usage: ModelCallReport = {
      callId: request.callId,
      stage: request.stage,
      ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
      pass: request.pass,
      provider: "fake",
      model: "quality-model",
      inputTokens: 100,
      outputTokens: 50,
      estimated: false,
      costUsd: 0.001,
      elapsedMs: 1,
      finishReason: "stop",
      promptHash: hash(request.prompt),
      contextHash: hash(request.context ?? ""),
      outputHash: hash(text),
    };
    return { text, usage };
  }
}

test("premium drafting isolates passes and ends in one guarded chapter event", async () => {
  const { parent, root } = setup();
  try {
    const worker = new ScriptedWorker(root);
    const result = await runQualityDraft({
      root,
      chapter: 1,
      runtimeProfile: "full",
      qualityConfig: readProject(root).quality!,
      worker,
      provider: "fake",
      model: "quality-model",
      runId: "QDR-001",
      cacheRetention: "delete-on-success",
    });
    assert.equal(result.chapter, 1);
    assert.equal(result.tier, "premium");
    assert.equal(result.calls.length, 8);
    assert.equal(worker.calls.length, 8);
    assert.deepEqual(worker.calls.map((call) => metadata(call.prompt).output_type), [
      "scene-plan", "draft-candidate", "draft-candidate", "candidate-selection",
      "lane-critique", "lane-critique", "lane-critique", "event-output",
    ]);
    const criticCalls = worker.calls.filter((call) => metadata(call.prompt).output_type === "lane-critique");
    for (const call of criticCalls) {
      assert.doesNotMatch(call.context ?? "", /CONTINUITY-MARKER|VOICE-MARKER|CAUSALITY-MARKER/);
      assert.match(call.context ?? "", /CAND-02 makes the archive door lie/);
    }
    const synthesis = worker.calls.at(-1)!;
    assert.match(synthesis.context ?? "", /CONTINUITY-MARKER/);
    assert.match(synthesis.context ?? "", /VOICE-MARKER/);
    assert.match(synthesis.context ?? "", /CAUSALITY-MARKER/);
    assert.equal(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), true);
    assert.match(readFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md"), "utf8"), /Mara pays/);
    assert.equal(readProject(root).current_stage, "drafting");
    assert.equal(existsSync(join(root, ".pi-book", "cache", "generation", "QDR-001")), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("two invalid structured attempts stop before canonical mutation", async () => {
  const { parent, root } = setup();
  try {
    const worker = new ScriptedWorker(root, true);
    await assert.rejects(runQualityDraft({
      root,
      chapter: 1,
      runtimeProfile: "full",
      qualityConfig: readProject(root).quality!,
      worker,
      runId: "QDR-FAIL",
      cacheRetention: "keep-all",
    }), /scene plan/i);
    assert.equal(worker.calls.length, 2);
    assert.match(worker.calls[1]?.prompt ?? "", /rejected output hash/i);
    assert.doesNotMatch(worker.calls[1]?.prompt ?? "", /not-json/);
    assert.equal(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md")), false);
    assert.equal(queueFixture().packets[0]?.status, "ready");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
