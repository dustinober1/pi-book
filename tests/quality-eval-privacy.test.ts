import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQualityEvaluation, requirePaidEvaluationConfiguration, type QualityEvalGenerator } from "../src/evaluation/quality-eval.js";

const fixture = {
  schema_version: "1.0.0" as const,
  id: "privacy-fixture",
  profile: "historical-fiction" as const,
  chapter: 3,
  project_hash: "a".repeat(64),
  packet_hash: "b".repeat(64),
  context_hash: "c".repeat(64),
  rubric: ["factual"],
};

class SentinelGenerator implements QualityEvalGenerator {
  async generate(input: { sampleId: string }) {
    return {
      text: `HUMAN-KIT-PROSE-${input.sampleId}`,
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.0001,
      severeFailures: [],
      diagnosticScores: { factual: 4 },
      privateDiagnostics: "PRIVATE-REASONING-SENTINEL",
    };
  }
}

test("machine report and label seal contain no prose, prompts, reasoning, or credentials", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-privacy-"));
  try {
    const result = await createQualityEvaluation({ fixture, tiers: ["economy", "editorial"], seed: "privacy-seed", provider: "fake-provider", model: "secret-model-name", generator: new SentinelGenerator(), outputRoot: parent });
    const reportText = readFileSync(result.paths.report, "utf8");
    const sealText = readFileSync(result.paths.labelSeal, "utf8");
    for (const forbidden of ["HUMAN-KIT-PROSE", "PRIVATE-REASONING-SENTINEL", "OPENAI_API_KEY", "raw_prompt", "manuscript_text"]) {
      assert.equal(reportText.includes(forbidden), false);
      assert.equal(sealText.includes(forbidden), false);
    }
    assert.equal(reportText.includes("secret-model-name"), true);
    assert.equal(sealText.includes("editorial"), true);
    const kitText = readFileSync(result.paths.reviewMarkdown, "utf8");
    assert.match(kitText, /HUMAN-KIT-PROSE/);
    assert.doesNotMatch(kitText, /editorial|economy|secret-model-name|fake-provider/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("paid evaluation requires explicit opt-in and complete configuration", () => {
  assert.throws(() => requirePaidEvaluationConfiguration({}, { provider: "p", model: "m", tiers: ["economy"], seed: "s" }), /NOVEL_FORGE_RUN_PAID_EVAL=1/);
  assert.throws(() => requirePaidEvaluationConfiguration({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }, { provider: "", model: "m", tiers: ["economy"], seed: "s" }), /provider/i);
  assert.throws(() => requirePaidEvaluationConfiguration({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }, { provider: "p", model: "", tiers: ["economy"], seed: "s" }), /model/i);
  assert.throws(() => requirePaidEvaluationConfiguration({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }, { provider: "p", model: "m", tiers: [], seed: "s" }), /tier/i);
  assert.throws(() => requirePaidEvaluationConfiguration({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }, { provider: "p", model: "m", tiers: ["economy"], seed: "" }), /seed/i);
  assert.doesNotThrow(() => requirePaidEvaluationConfiguration({ NOVEL_FORGE_RUN_PAID_EVAL: "1" }, { provider: "p", model: "m", tiers: ["economy"], seed: "s" }));
});
