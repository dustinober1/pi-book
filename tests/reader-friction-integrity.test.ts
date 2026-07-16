import test from "node:test";
import assert from "node:assert/strict";
import { defaultBookStrategy } from "../src/domain/v1-3-schemas.js";
import { readerFrictionFindings } from "../src/application/review-observations.js";

test("direct YAML observations must agree with their rating band", () => {
  const strategy = defaultBookStrategy();
  strategy.reader_friction.observations.push({
    id: "OBS-001", title: "A", source_location: "source", observed_on: "2026-07-15",
    rating: 5, paraphrase: "Positive review.", short_excerpt: "", genre_relevance: "high",
    execution_relevance: "high", category: "pacing-problem", sentiment: "negative",
  });
  assert.ok(readerFrictionFindings(strategy).some((item) => item.code === "rating-band-mismatch"));
});

test("direct YAML clusters cannot mix categories or misstate affected titles", () => {
  const strategy = defaultBookStrategy();
  strategy.reader_friction.observations.push(
    { id: "OBS-001", title: "A", source_location: "s1", observed_on: "2026-07-15", rating: 2, paraphrase: "Slow.", short_excerpt: "", genre_relevance: "high", execution_relevance: "high", category: "pacing-problem", sentiment: "negative" },
    { id: "OBS-002", title: "B", source_location: "s2", observed_on: "2026-07-15", rating: 2, paraphrase: "Flat character.", short_excerpt: "", genre_relevance: "high", execution_relevance: "high", category: "character-friction", sentiment: "negative" },
  );
  strategy.reader_friction.clusters.push({
    id: "CLU-001", label: "Mixed cluster", observation_ids: ["OBS-001", "OBS-002"],
    titles_affected: ["A"], confidence: "weak", positive_counterweights: [], decision: null, guardrail: null,
  });
  const findings = readerFrictionFindings(strategy);
  assert.ok(findings.some((item) => item.code === "mixed-cluster-categories"));
  assert.ok(findings.some((item) => item.code === "cluster-title-mismatch"));
});
