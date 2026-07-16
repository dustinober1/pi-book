import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceAuditRecord,
  compareVoiceMetrics,
  extractVoiceMetrics,
  isVoiceAuditMilestone,
} from "../src/application/voice-audit.js";

const sample = `Mara watched the door. She thought it would open.\n\n"Not yet," Jonah said.\n\nWhy had the room gone quiet? Her hand tightened on the file.`;

test("voice metric extraction is deterministic and rounded", () => {
  const first = extractVoiceMetrics(sample);
  const second = extractVoiceMetrics(sample);
  assert.deepEqual(second, first);
  assert.equal(Number.isInteger(first.word_count), true);
  assert.equal(first.dialogue_ratio >= 0 && first.dialogue_ratio <= 1, true);
  assert.equal(String(first.average_sentence_words).split(".")[1]?.length ?? 0 <= 4, true);
});

test("metric changes produce evidence-only deltas without severity", () => {
  const current = extractVoiceMetrics(sample + `\n\n"Move," Mara said.`);
  const baseline = extractVoiceMetrics(sample);
  const audit = buildVoiceAuditRecord({
    id: "VA-001", currentText: sample + `\n\n"Move," Mara said.`, baselineMetrics: baseline,
    baselineHash: "b".repeat(64), scope: "chapter-3", pov: "Mara", chapters: [3], protectedExceptions: [], runAt: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(audit.assessment, "evidence-only");
  assert.deepEqual(audit.deltas, compareVoiceMetrics(current, baseline));
  assert.equal(JSON.stringify(audit).includes("severity"), false);
});

test("intentional exceptions are protected without deleting metric evidence", () => {
  const baseline = extractVoiceMetrics(sample);
  const audit = buildVoiceAuditRecord({
    id: "VA-002", currentText: sample + `\n\nWhy now? Why here?`, baselineMetrics: baseline,
    baselineHash: "c".repeat(64), scope: "act-1", pov: "Mara", chapters: [1, 2, 3],
    protectedExceptions: ["Interrogation chapter intentionally uses more questions"], runAt: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(audit.verdict, "accepted-variation");
  assert.ok(Object.keys(audit.deltas).length > 0);
});

test("voice audit milestones are Chapter 1, Chapter 3, act, manuscript, or explicit recalibration", () => {
  assert.equal(isVoiceAuditMilestone({ chapter: 1 }), true);
  assert.equal(isVoiceAuditMilestone({ chapter: 3 }), true);
  assert.equal(isVoiceAuditMilestone({ chapter: 2 }), false);
  assert.equal(isVoiceAuditMilestone({ scope: "act" }), true);
  assert.equal(isVoiceAuditMilestone({ scope: "manuscript" }), true);
  assert.equal(isVoiceAuditMilestone({ explicit: true }), true);
});
