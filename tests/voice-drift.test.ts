import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceDriftEvidence,
  compareVoiceMetrics,
  extractVoiceMetrics,
} from "../src/application/voice-drift.js";

const baseline = `Mara crossed the room. She heard the lock click.

"Not yet," Jonah said. "Wait."

Why had the archive gone quiet? Mara wondered whether the silence was deliberate.`;

const observed = `Mara crossed the room in three careful steps, watching the door and listening for the lock. She noticed Jonah's shoulders tighten.

"Not yet," Jonah said. "Wait until the second light."

Why had the archive gone quiet? She wondered whether the silence was deliberate, and she felt her pulse quicken.`;

test("voice metric extraction is deterministic and bounded", () => {
  const first = extractVoiceMetrics(baseline);
  const second = extractVoiceMetrics(baseline);
  assert.deepEqual(second, first);
  assert.ok(first.sample_words > 0);
  assert.ok(first.sentence_count > 0);
  for (const key of ["dialogue_ratio", "fragment_ratio", "rhetorical_question_rate", "filter_word_rate", "body_language_repetition_rate", "interiority_density"] as const) {
    assert.ok(first[key] >= 0 && first[key] <= 1, `${key} must be bounded`);
  }
});

test("metric comparison returns evidence rather than an automatic severity conclusion", () => {
  const evidence = compareVoiceMetrics({ baseline: extractVoiceMetrics(baseline), observed: extractVoiceMetrics(observed) });
  assert.equal(evidence.interpretation, "evidence-only");
  assert.ok(Object.keys(evidence.deltas).length > 0);
  assert.equal("severity" in evidence, false);
  assert.equal("verdict" in evidence, false);
});

test("protected signals remain identified without erasing the measured delta", () => {
  const evidence = compareVoiceMetrics({
    baseline: extractVoiceMetrics(baseline),
    observed: extractVoiceMetrics(observed),
    protectedSignals: ["filter_word_rate"],
  });
  assert.deepEqual(evidence.protected_signals, ["filter_word_rate"]);
  assert.ok("filter_word_rate" in evidence.deltas);
});

test("a supplied POV baseline is selected for a POV-aware report", () => {
  const report = buildVoiceDriftEvidence({
    baselineText: baseline,
    povBaselineText: `Mara stopped. Listened. Waited.\n\n"Now," she said.`,
    observedText: observed,
    pov: "Mara",
  });
  assert.equal(report.baseline_scope, "pov");
  assert.equal(report.pov, "Mara");
  assert.equal(report.interpretation, "evidence-only");
});
