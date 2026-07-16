import test from "node:test";
import assert from "node:assert/strict";
import { importReviewObservationCsv, sanitizeReviewObservation } from "../src/application/review-observations.js";

function manual(rating: number | null, sentiment?: "negative" | "mixed" | "positive") {
  return sanitizeReviewObservation("OBS-001", {
    title: "Example Novel",
    sourceLocation: "https://retailer.example/reviews/42",
    observedOn: "2026-07-15",
    rating,
    paraphrase: "Reviewer Jane Doe (@janedoe) found the middle predictable but praised the ending.",
    shortExcerpt: "Jane Doe: predictable middle, strong ending",
    category: "pacing-problem",
    genreRelevance: "high",
    executionRelevance: "high",
    sentiment,
    reviewerName: "Jane Doe",
    reviewerHandle: "@janedoe",
    reviewerProfileUrl: "https://retailer.example/profile/janedoe",
  });
}

test("manual intake strips reviewer identity and profile URLs before storage", () => {
  const observation = manual(2);
  const serialized = JSON.stringify(observation);
  assert.equal(serialized.includes("Jane Doe"), false);
  assert.equal(serialized.includes("janedoe"), false);
  assert.equal(serialized.includes("/profile/"), false);
  assert.equal(observation.source_location, "https://retailer.example/reviews/42");
});

test("rating bands keep three-star evidence distinct", () => {
  assert.equal(manual(1).sentiment, "negative");
  assert.equal(manual(2).sentiment, "negative");
  assert.equal(manual(3).sentiment, "mixed");
  assert.equal(manual(4).sentiment, "positive");
  assert.equal(manual(5).sentiment, "positive");
});

test("unrated observations require an explicit sentiment", () => {
  assert.throws(() => manual(null), /explicit sentiment/i);
  assert.equal(manual(null, "mixed").sentiment, "mixed");
});

test("CSV intake parses quoted commas while discarding identity columns", () => {
  const csv = [
    "title,source_location,observed_on,rating,paraphrase,short_excerpt,category,genre_relevance,execution_relevance,sentiment,reviewer_name,reviewer_handle,reviewer_profile_url",
    '"Book, One",https://retailer.example/reviews/7,2026-07-15,3,"Jane Doe said the opening was slow, but the ending worked.","slow, then strong",pacing-problem,high,high,,Jane Doe,@janedoe,https://retailer.example/profile/janedoe',
  ].join("\n");
  const result = importReviewObservationCsv(csv);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.title, "Book, One");
  assert.equal(result.observations[0]?.sentiment, "mixed");
  assert.equal(JSON.stringify(result.observations).includes("Jane Doe"), false);
  assert.equal(JSON.stringify(result.observations).includes("janedoe"), false);
  assert.equal(result.discardedIdentityFields, 3);
});

test("CSV intake rejects malformed ratings", () => {
  const header = "title,source_location,observed_on,rating,paraphrase,short_excerpt,category,genre_relevance,execution_relevance,sentiment,reviewer_name,reviewer_handle,reviewer_profile_url";
  const row = "Book,source,2026-07-15,8,Note,,execution-problem,high,high,,,,";
  assert.throws(() => importReviewObservationCsv(`${header}\n${row}`), /rating/i);
});
