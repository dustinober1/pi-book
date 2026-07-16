import test from "node:test";
import assert from "node:assert/strict";
import { defaultBookStrategy, type BookStrategy } from "../src/domain/v1-3-schemas.js";
import { buildReviewCluster, maximumClusterConfidence, readerFrictionFindings, sanitizeReviewObservation } from "../src/application/review-observations.js";

type Observation = BookStrategy["reader_friction"]["observations"][number];

function observation(id: string, title: string, rating: number, executionRelevance: "low" | "medium" | "high" = "high"): Observation {
  return sanitizeReviewObservation(id, {
    title,
    sourceLocation: `https://example.test/${id}`,
    observedOn: "2026-07-15",
    rating,
    paraphrase: `${title} observation ${id}`,
    category: "pacing-problem",
    genreRelevance: "high",
    executionRelevance,
  });
}

test("confidence is weak with fewer than three observations or one title", () => {
  assert.equal(maximumClusterConfidence([observation("OBS-001", "A", 2), observation("OBS-002", "A", 2)], []), "weak");
  assert.equal(maximumClusterConfidence([observation("OBS-001", "A", 2), observation("OBS-002", "A", 2), observation("OBS-003", "A", 2)], []), "weak");
});

test("three observations across two titles support moderate confidence", () => {
  const values = [observation("OBS-001", "A", 2), observation("OBS-002", "A", 3), observation("OBS-003", "B", 2)];
  assert.equal(maximumClusterConfidence(values, []), "moderate");
});

test("strong confidence requires six observations, three titles, execution relevance, and a positive counterweight", () => {
  const values = [
    observation("OBS-001", "A", 2), observation("OBS-002", "A", 3),
    observation("OBS-003", "B", 2), observation("OBS-004", "B", 2),
    observation("OBS-005", "C", 2), observation("OBS-006", "C", 3),
  ];
  assert.equal(maximumClusterConfidence(values, []), "moderate");
  assert.equal(maximumClusterConfidence(values, ["OBS-007"]), "strong");
});

test("one-star-only evidence can never become strong", () => {
  const values = ["A", "A", "B", "B", "C", "C"].map((title, index) => observation(`OBS-${String(index + 1).padStart(3, "0")}`, title, 1));
  assert.equal(maximumClusterConfidence(values, ["OBS-007"]), "moderate");
});

test("cluster construction preserves positive counterweights as evidence IDs", () => {
  const observations = [
    observation("OBS-001", "A", 2), observation("OBS-002", "B", 3), observation("OBS-003", "B", 2),
    observation("OBS-004", "A", 5), observation("OBS-005", "B", 4),
  ];
  const cluster = buildReviewCluster({ id: "CLU-001", label: "Middle loses urgency", observationIds: ["OBS-001", "OBS-002", "OBS-003"] }, observations);
  assert.deepEqual(cluster.positive_counterweights, ["OBS-004", "OBS-005"]);
  assert.deepEqual(cluster.titles_affected, ["A", "B"]);
  assert.equal(cluster.confidence, "moderate");
});

test("strategy validation blocks confidence inflation and unlinked accepted tradeoffs", () => {
  const strategy = defaultBookStrategy();
  strategy.reader_friction.observations = [
    observation("OBS-001", "A", 2), observation("OBS-002", "A", 2), observation("OBS-003", "B", 2),
  ];
  strategy.reader_friction.clusters.push({
    id: "CLU-001", label: "Middle loses urgency", observation_ids: ["OBS-001", "OBS-002", "OBS-003"],
    titles_affected: ["A", "B"], confidence: "strong", positive_counterweights: [],
    decision: "accept-as-tradeoff", guardrail: null,
  });
  const findings = readerFrictionFindings(strategy);
  assert.ok(findings.some((item) => item.code === "confidence-inflation"));
  assert.ok(findings.some((item) => item.code === "missing-tradeoff-link"));
});

test("approved review guardrails require prevent or mitigate decisions", () => {
  const strategy = defaultBookStrategy();
  strategy.reader_friction.observations = [observation("OBS-001", "A", 2)];
  strategy.reader_friction.clusters.push({
    id: "CLU-001", label: "Wrong-reader complaint", observation_ids: ["OBS-001"], titles_affected: ["A"],
    confidence: "weak", positive_counterweights: [], decision: "irrelevant-to-project", guardrail: null,
  });
  strategy.review_derived_guardrails.push({ id: "GR-001", rule: "Accelerate every scene", source_cluster_ids: ["CLU-001"], status: "approved" });
  assert.ok(readerFrictionFindings(strategy).some((item) => item.code === "invalid-approved-guardrail"));
});
