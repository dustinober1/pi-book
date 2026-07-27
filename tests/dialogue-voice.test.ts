import test from "node:test";
import assert from "node:assert/strict";
import {
  MINIMUM_SPEAKER_WORDS,
  dialogueVoiceFindings,
  extractSpeakerSamples,
  speakerMetrics,
} from "../src/application/dialogue-voice.js";
import { dialogueVoiceRule, normalizeDocument, runProseLint } from "../src/application/prose-lint/index.js";

/** Two speakers written in one register: same cadence, no contractions, formal. */
function uniformDialogue(): string {
  const lines: string[] = [];
  for (let index = 0; index < 14; index += 1) {
    lines.push(`“The arrangement requires consideration before we proceed any further today ${index}.” said Mara.`);
    lines.push(`“The arrangement requires attention before we continue any further tonight ${index}.” said Elias.`);
  }
  return lines.join("\n\n");
}

/** Two speakers deliberately written apart: clipped and contracted vs formal. */
function differentiatedDialogue(): string {
  const lines: string[] = [];
  for (let index = 0; index < 14; index += 1) {
    lines.push(`“Can't. Won't. Don't ask me again, ${index}.” said Mara.`);
    lines.push(`“I would prefer to examine the documentation thoroughly before rendering any judgement whatsoever on the matter ${index}.” said Elias.`);
  }
  return lines.join("\n\n");
}

test("speech is attributed across the three common tag orders", () => {
  const samples = extractSpeakerSamples([
    `“The gate was open.” said Mara.`,
    `“The gate was locked,” Elias said.`,
    `Rhone asked, “Who closed it?”`,
  ].join("\n\n"));

  const speakers = samples.map((item) => item.speaker);
  assert.deepEqual(speakers, ["Elias", "Mara", "Rhone"]);
  assert.equal(samples.find((item) => item.speaker === "Rhone")?.lines[0], "Who closed it?");
});

test("pronouns and sentence openers are never mistaken for speaker names", () => {
  const samples = extractSpeakerSamples([
    `“No.” said She.`,
    `“Nor I,” They said.`,
    `“Enough.” said Mara.`,
  ].join("\n\n"));
  assert.deepEqual(samples.map((item) => item.speaker), ["Mara"]);
});

test("speaker metrics separate cadence, contractions, questions and vocabulary", () => {
  const [sample] = extractSpeakerSamples(`Mara said, “I can't. I won't. Don't ask.”`);
  assert.ok(sample);
  const metrics = speakerMetrics(sample);
  assert.equal(metrics.speaker, "Mara");
  assert.ok(metrics.contractionsPer100Words > 0);
  assert.ok(metrics.wordsPerSentence > 0);
  assert.ok(metrics.typeTokenRatio > 0 && metrics.typeTokenRatio <= 1);
});

test("two characters written in one register are reported as indistinguishable", () => {
  const findings = dialogueVoiceFindings(uniformDialogue());
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.ok(finding);
  assert.deepEqual(finding.speakers.slice().sort(), ["Elias", "Mara"]);
  assert.match(finding.message, /not distinguishable by their dialogue/);
  assert.match(finding.message, /A deliberate pairing is legitimate/);
  assert.doesNotMatch(finding.message, /AI[- ]written|machine[- ]generated/i);
});

test("deliberately differentiated characters produce no finding", () => {
  assert.deepEqual(dialogueVoiceFindings(differentiatedDialogue()), []);
});

test("a speaker below the sample floor is never characterised", () => {
  const thin = `“Yes.” said Mara.\n\n“No.” said Elias.`;
  assert.ok(thin.split(/\s+/).length < MINIMUM_SPEAKER_WORDS);
  assert.deepEqual(dialogueVoiceFindings(thin), []);
});

test("prose with no attributed dialogue produces no finding and never throws", () => {
  assert.deepEqual(dialogueVoiceFindings("The corridor stayed empty for a long time."), []);
  assert.deepEqual(dialogueVoiceFindings(""), []);
});

test("the lint rule reports uniformity as review evidence with a usable location", () => {
  const result = runProseLint({
    documents: [normalizeDocument("06-chapter.md", uniformDialogue(), 1)],
    rules: [dialogueVoiceRule],
  });

  assert.equal(result.findings.length, 1);
  const finding = result.findings[0];
  assert.ok(finding);
  assert.equal(finding.ruleId, "style-pattern/character-voice-uniformity");
  assert.equal(finding.class, "style-pattern");
  assert.equal(finding.confidence, "review");
  assert.equal(finding.location.path, "06-chapter.md");
  assert.ok((finding.location.line ?? 0) >= 1);
  assert.equal(finding.evidence.speakers, "Elias / Mara");
  assert.match(finding.reviewAction, /side by side/);
});

test("dialogue voice findings are deterministic", () => {
  const documents = [normalizeDocument("06-chapter.md", uniformDialogue(), 1)];
  assert.deepEqual(
    runProseLint({ documents, rules: [dialogueVoiceRule] }),
    runProseLint({ documents, rules: [dialogueVoiceRule] }),
  );
});
