import test from "node:test";
import assert from "node:assert/strict";
import type { ReaderExperimentsState, RemarkabilityState } from "../src/domain/schemas.js";
import { readerExperimentFindings, remarkabilityFindings } from "../src/application/reader-impact.js";

function emptyRemarkability(): RemarkabilityState {
  return {
    schema_version: "1.0.0",
    safe_obvious_version: "",
    author_only_advantage: "",
    productive_discomfort: "",
    retellable_hook: "",
    signature_moments: [],
    productive_disagreements: [],
    recurring_motifs: [],
    lingering_question: "",
    hand_sell_reason: "",
    accepted_reader_costs: [],
  };
}

test("remarkability validation blocks empty planning contracts and accepts specific ambition", () => {
  const empty = remarkabilityFindings(emptyRemarkability()).filter((finding) => finding.severity === "blocker");
  assert.ok(empty.some((finding) => /retellable hook/i.test(finding.message)));
  assert.ok(empty.some((finding) => /signature moments/i.test(finding.message)));

  const valid: RemarkabilityState = {
    ...emptyRemarkability(),
    safe_obvious_version: "A routine locked-room escape.",
    author_only_advantage: "Institutional shame rendered through physical procedure.",
    productive_discomfort: "Mara may preserve evidence at an unforgivable human cost.",
    retellable_hook: "A security auditor discovers the building is editing its own evacuation record.",
    signature_moments: [
      { id: "RM-1", description: "The exit sign changes its testimony", intended_reader_memory: "The building lies in plain sight", planned_location: "chapter-01", status: "planned" },
      { id: "RM-2", description: "The evacuation log lists a survivor before she escapes", intended_reader_memory: "The record predicts the cost", planned_location: "midpoint", status: "planned" },
    ],
    productive_disagreements: [{ question: "Was Mara right to stay?", competing_readings: ["She protected the truth", "She valued proof over people"] }],
    lingering_question: "What evidence is worth a life?",
    hand_sell_reason: "A procedural thriller with a building that falsifies the record around its occupants.",
    accepted_reader_costs: ["Moral discomfort without immediate reassurance"],
  };
  assert.equal(remarkabilityFindings(valid).filter((finding) => finding.severity === "blocker").length, 0);
});

test("reader evidence cannot claim validation without delayed real-reader recall", () => {
  const state: ReaderExperimentsState = {
    schema_version: "1.0.0",
    experiments: [{
      id: "RE-001",
      status: "complete",
      scope: "first-chapter",
      variant: "A",
      blind: true,
      target_reader: "procedural thriller readers",
      sample_path: "books/book-01/manuscript/chapters/01-opening.md",
      immediate_responses: [],
      delayed_after_hours: 48,
      delayed_responses: [],
      metrics: {
        continuation_rate: null,
        purchase_intent_rate: null,
        delayed_hook_recall_rate: null,
        signature_moment_recall_rate: null,
        specific_recommendation_rate: null,
        talkability_rate: null,
      },
      verdict: "validated",
      next_action: "Publish the claim.",
    }],
  };
  const blockers = readerExperimentFindings(state).filter((finding) => finding.severity === "blocker");
  assert.ok(blockers.some((finding) => /delayed responses/i.test(finding.message)));
  assert.ok(blockers.some((finding) => /validated verdict/i.test(finding.message)));
});
