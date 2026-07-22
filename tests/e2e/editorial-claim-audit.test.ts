import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { claimTextHash } from "../../src/application/claim-audit.js";
import { runQualityDraft } from "../../src/application/quality-orchestrator.js";
import type { ModelCallReport } from "../../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../../src/domain/quality-worker.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { readProject } from "../../src/project/store.js";
import { createDraftableQualityProject } from "../quality-project-fixture.js";

const initialChapter = "# Chapter 1\n\nThe release console required three operators.\n";
const repairedChapter = "# Chapter 1\n\nThe release console required two authorized operators.\n";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function metadata(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((item) => item.startsWith("{"));
  if (!line) throw new Error("missing metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

function plannedOutputTokens(jobType: QualityWorkerRequest["jobType"]): number {
  if (!jobType) return 0;
  const tokens: Partial<Record<NonNullable<QualityWorkerRequest["jobType"]>, number>> = {
    "plan-scene": 1_200,
    "draft-scene": 4_200,
    "candidate-selection": 1_000,
    "critic-continuity": 1_000,
    "critic-causality": 1_000,
    "critic-character-intent": 1_000,
    "critic-style": 1_000,
    "synthesize-event-output": 4_200,
    "extract-factual-claims": 1_000,
    "critic-factuality": 1_000,
    "repair-factuality": 4_200,
    "verify-chapter": 1_200,
  };
  return tokens[jobType] ?? 0;
}

class EditorialClaimWorker implements QualityWorker {
  calls: QualityWorkerRequest[] = [];
  extractionCount = 0;
  auditCount = 0;

  constructor(
    readonly manuscriptPath: string,
    readonly correctEveryCall = false,
  ) {}

  async resolveModelCapacity() {
    return { provider: "fake", model: "quality-model", contextWindowTokens: 128_000, maxOutputTokens: 32_000 };
  }

  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    assert.equal(existsSync(this.manuscriptPath), false, `canonical manuscript changed before ${request.callId}`);
    this.calls.push(request);
    const meta = metadata(request.prompt);
    const common = {
      schema_version: "1.0.0",
      run_id: meta.run_id,
      chapter: meta.chapter,
      source_hashes: meta.source_hashes,
      creation_order: meta.creation_order,
    };
    const outputType = String(meta.output_type);
    let text: string;
    if (this.correctEveryCall && request.attempt === 1) {
      text = "not-json";
    } else if (outputType === "scene-plan") {
      text = JSON.stringify({ ...common, artifact_type: "scene-plan", objective: "Make the release constraint costly.", beats: ["Enter", "Fail", "Choose"], protected_constraints: [], ending_hook: "The second credential arrives.", evidence_refs: ["RES-001"] });
    } else if (outputType === "draft-candidate") {
      text = JSON.stringify({ ...common, artifact_type: "draft-candidate", candidate_id: meta.candidate_id, text: initialChapter, proposed_delta: { canon: [], relationships: [], threads: [] } });
    } else if (outputType === "candidate-selection") {
      text = JSON.stringify({ ...common, artifact_type: "candidate-selection", candidate_ids: meta.candidate_ids, selected_candidate_id: "CAND-01", rationale: "The consequence is explicit.", evidence: ["The operator count controls the scene choice."] });
    } else if (outputType === "lane-critique") {
      text = JSON.stringify({ ...common, artifact_type: "lane-critique", candidate_id: meta.candidate_id, lane: meta.lane, findings: [], verdict: "accept" });
    } else if (outputType === "event-output") {
      text = JSON.stringify({ schema_version: "1.0.0", chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-chapter-1.md", content: initialChapter }], summary: "Prepared editorial draft." });
    } else if (outputType === "claim-extraction") {
      this.extractionCount += 1;
      const chapter = this.extractionCount === 1 ? initialChapter : repairedChapter;
      text = JSON.stringify({
        ...common,
        artifact_type: "claim-extraction",
        claims: [{
          id: "CLM-001",
          line_start: 3,
          line_end: 3,
          text_hash: claimTextHash(chapter, 3, 3),
          claim_type: "procedural",
          risk: this.extractionCount === 1 ? "medium" : "high",
          research_ids: ["RES-001"],
          invention_ids: [],
        }],
      });
    } else if (outputType === "claim-audit") {
      this.auditCount += 1;
      text = JSON.stringify({
        ...common,
        artifact_type: "claim-audit",
        findings: this.auditCount === 1
          ? [{ claim_id: "CLM-001", status: "unsupported", anchor_refs: [], action: "qualify", reason: "The evidence supports two operators, not three." }]
          : [{ claim_id: "CLM-001", status: "supported", anchor_refs: ["RES-001#1"], action: "accept", reason: "The repaired statement matches the direct anchor." }],
      });
    } else if (outputType === "claim-repair") {
      text = JSON.stringify({ schema_version: "1.0.0", chapter: 1, files: [{ path: "books/book-01/manuscript/chapters/01-chapter-1.md", content: repairedChapter }], summary: "Qualified the unsupported operator count." });
    } else if (outputType === "verification") {
      text = JSON.stringify({ schema_version: "1.0.0", chapter: 1, verdict: "accept", findings: [] });
    } else {
      throw new Error(`unexpected output type ${outputType}`);
    }
    const usage: ModelCallReport = {
      callId: request.callId,
      stage: request.stage,
      ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
      pass: request.pass,
      inputTokens: 100,
      outputTokens: this.correctEveryCall ? plannedOutputTokens(request.jobType) : 50,
      estimated: false,
      elapsedMs: 1,
      promptHash: hash(request.prompt),
      contextHash: hash(request.context ?? ""),
      outputHash: hash(text),
    };
    return { text, usage };
  }
}

function setupClaimAuditProject(tier: "premium" | "editorial") {
  const project = createDraftableQualityProject(tier);
  const manuscriptPath = join(project.root, "books", "book-01", "manuscript", "chapters", "01-chapter-1.md");
  const projectState = structuredClone(readProject(project.root));
  projectState.automation.require_first_chapter_approval = false;
  projectState.quality!.fact_checking = "always";
  projectState.quality!.budget.maximum_calls_per_chapter = 30;
  writeFileSync(join(project.root, "PROJECT.yaml"), stringifyYaml(projectState), "utf8");

  const queuePath = join(project.root, "books", "book-01", "chapter-queue.yaml");
  const queue = YAML.parse(readFileSync(queuePath, "utf8"));
  queue.packets[0].required_research = ["RES-001"];
  writeFileSync(queuePath, stringifyYaml(queue), "utf8");
  writeFileSync(join(project.root, "books", "book-01", "research-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    items: [{
      id: "RES-001", lane: "story-world", claim: "Two authorized operators confirm release.", source_ids: ["SRC-001"],
      confidence: "high", verified_on: "2026-07-21", fictionalization: { status: "simplified", reason: "Compress detail." },
      knowledge_scope: { known_by: ["Mara"], incorrectly_believed_by: [], unknown_to: [] }, risk: [],
      dramatic_uses: ["procedural-constraint"], story_use: { chapters: [1], decision_affected: "Mara needs a second operator." }, notes: "",
      accuracy_risk: "high", evidence_anchors: [{ source_id: "SRC-001", locator: "Section 4.2", support_type: "direct", paraphrase: "Two operators confirm release.", excerpt_hash: "a".repeat(64) }], status: "ready",
    }],
  }), "utf8");
  writeFileSync(join(project.root, "research", "source-register.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    sources: [{ id: "SRC-001", type: "primary-document", title: "Operations Manual", location: "research/manual.md", verified_on: "2026-07-21", supports: [], notes: "", reliability: "primary", observed_on: "2026-07-21", supports_research_ids: ["RES-001"] }],
  }), "utf8");
  return { project, projectState, manuscriptPath };
}

test("editorial drafting performs one targeted claim repair and re-audit before the guarded event", async () => {
  const { project, projectState, manuscriptPath } = setupClaimAuditProject("editorial");
  try {
    const worker = new EditorialClaimWorker(manuscriptPath);
    const result = await runQualityDraft({
      root: project.root,
      chapter: 1,
      runtimeProfile: "full",
      qualityConfig: projectState.quality!,
      worker,
      runId: "QDR-CLAIM-AUDIT",
      cacheRetention: "keep-all",
    });
    assert.equal(result.chapter, 1);
    assert.equal(worker.extractionCount, 2);
    assert.equal(worker.auditCount, 2);
    assert.equal(worker.calls.filter((call) => metadata(call.prompt).output_type === "claim-repair").length, 1);
    assert.equal(readFileSync(manuscriptPath, "utf8"), repairedChapter);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});

test("premium factual repair stays within the declared graph when every primary needs one correction", async () => {
  const { project, projectState, manuscriptPath } = setupClaimAuditProject("premium");
  try {
    const worker = new EditorialClaimWorker(manuscriptPath, true);
    const result = await runQualityDraft({
      root: project.root,
      chapter: 1,
      runtimeProfile: "full",
      qualityConfig: projectState.quality!,
      worker,
      runId: "QDR-PREMIUM-WORST-CASE",
      cacheRetention: "keep-all",
    });

    assert.equal(worker.extractionCount, 2);
    assert.equal(worker.auditCount, 2);
    assert.equal(result.calls.length, 28);
    assert.deepEqual(worker.calls.map((call) => call.attempt), Array.from({ length: 28 }, (_, index) => index % 2 + 1));
    assert.ok(worker.calls.every((call) => call.jobType !== undefined));
    assert.deepEqual(result.jobPlan.limits, { maximum_model_calls: 28, maximum_generated_tokens: 54_000 });
    assert.equal(result.jobPlanUsage.model_calls, result.jobPlan.limits.maximum_model_calls);
    assert.equal(result.jobPlanUsage.generated_tokens, result.jobPlan.limits.maximum_generated_tokens);
    assert.deepEqual(result.jobPlanUsage.job_calls["extract-factual-claims"], { primary: 2, corrections: 2 });
    assert.deepEqual(result.jobPlanUsage.job_calls["critic-factuality"], { primary: 2, corrections: 2 });
    assert.deepEqual(result.jobPlanUsage.job_calls["repair-factuality"], { primary: 1, corrections: 1 });
    assert.equal(readFileSync(manuscriptPath, "utf8"), repairedChapter);
  } finally {
    rmSync(project.parent, { recursive: true, force: true });
  }
});
