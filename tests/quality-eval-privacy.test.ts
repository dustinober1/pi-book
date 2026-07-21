import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { ModelCallReport } from "../src/domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../src/domain/quality-worker.js";
import { runQualityEvaluation, type QualityEvalFixture } from "../src/evaluation/quality-eval.js";
import { buildQualityEvalReport, renderHumanAnswerCsv, renderHumanReviewKit } from "../src/evaluation/quality-eval-report.js";

function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function meta(prompt: string): Record<string, unknown> {
  const line = prompt.split("\n").find((value) => value.trim().startsWith("{"));
  if (!line) throw new Error("missing metadata");
  return JSON.parse(line) as Record<string, unknown>;
}

class PrivacyWorker implements QualityWorker {
  async resolveModelCapacity() { return null; }
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    const value = meta(request.prompt);
    const diagnostic = value.output_type === "quality-eval-diagnostic";
    const text = diagnostic
      ? JSON.stringify({
          schema_version: "1.0.0",
          sample_id: value.sample_id,
          scores: { canon_integrity: 4, consent_integrity: 4, reveal_order: 4, causality: 4, factual_grounding: 4, voice_fidelity: 4 },
          severe_failures: { canon: false, consent: false, reveal_order: false, causal: false, factual: false, voice: false },
          notes: [],
        })
      : "# Chapter\n\nPRIVATE-GENERATED-PROSE-SENTINEL";
    const usage: ModelCallReport = {
      callId: request.callId,
      stage: request.stage,
      pass: request.pass,
      inputTokens: 10,
      outputTokens: 5,
      estimated: false,
      costUsd: 0.001,
      elapsedMs: 1,
      promptHash: hash(request.prompt),
      contextHash: hash(request.context ?? ""),
      outputHash: hash(text),
    };
    return { text, usage };
  }
}

const fixture: QualityEvalFixture = {
  schema_version: "1.0.0",
  id: "QEF-PRIV-001",
  profile: "thriller",
  chapter: 1,
  project_hash: "f".repeat(64),
  packet: {
    chapter: 1, title: "Private", status: "ready", pov: "Mara", purpose: "Choose.", scene_engine: "infiltration",
    pressure_movement: "Pressure.", character_movement: "Choice.", relationship_movement: "Trust.", story_thread_refs: [],
    continuity_refs: [], character_refs: ["Mara"], required_research: [], profile_fields: {}, ending_hook: "End.", milestone_gate: null, target_words: 1000,
  },
  context: "PRIVATE-CONTEXT-SENTINEL API_KEY=PRIVATE-CREDENTIAL-SENTINEL",
  protected_constraints: ["PRIVATE-CONSTRAINT-SENTINEL"],
};

test("reports omit raw content and blinded forms also omit tier and sealed labels", async () => {
  const bundle = await runQualityEvaluation({
    fixtures: [fixture], worker: new PrivacyWorker(), provider: "PRIVATE-PROVIDER", model: "PRIVATE-MODEL",
    tiers: ["economy", "editorial"], seed: "privacy-seed",
  });
  const reportText = JSON.stringify(buildQualityEvalReport(bundle, [], 3));
  const kit = renderHumanReviewKit(bundle);
  const csv = renderHumanAnswerCsv(bundle);

  for (const forbidden of [
    "PRIVATE-CONTEXT-SENTINEL", "PRIVATE-CREDENTIAL-SENTINEL", "PRIVATE-CONSTRAINT-SENTINEL",
    "PRIVATE-PROVIDER", "PRIVATE-MODEL", "QEF-PRIV-001", "PRIVATE-GENERATED-PROSE-SENTINEL",
  ]) {
    assert.equal(reportText.includes(forbidden), false);
  }
  for (const forbidden of [
    "PRIVATE-CONTEXT-SENTINEL", "PRIVATE-CREDENTIAL-SENTINEL", "PRIVATE-CONSTRAINT-SENTINEL",
    "PRIVATE-PROVIDER", "PRIVATE-MODEL", "economy", "editorial", "QEF-PRIV-001",
    assert.equal(reportText.includes(forbidden), false, "reportText should not contain " + forbidden);
    assert.equal(kit.includes(forbidden), false, "kit should not contain " + forbidden);
    assert.equal(csv.includes(forbidden), false, "csv should not contain " + forbidden);
  }
  assert.equal(kit.includes("PRIVATE-GENERATED-PROSE-SENTINEL"), true);
  assert.equal(reportText.includes("economy"), true);
  assert.equal(JSON.stringify(bundle.sealedLabels).includes("editorial"), true);
});
