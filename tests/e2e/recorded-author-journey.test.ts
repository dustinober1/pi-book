import test from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateAuthorJourney, type AuthorJourneyFixture } from "../../src/evaluation/author-journey.js";
import { summarizeJourneyVelocity } from "../../src/application/journey-trace.js";
import { applyNovelEvent } from "../../src/application/events.js";
import { approveProjectGate, decideNextRun } from "../../src/application/run.js";
import { projectStateHash } from "../../src/application/project-hash.js";
import { assertPrivacySafe, journeyTracePath, readJourneyTrace } from "../../src/infrastructure/journey-trace-store.js";
import { defaultTasteProfile, defaultVoiceExperimentIndex, defaultVoiceGuardrails } from "../../src/domain/v1-3-schemas.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-recorded-journey-")); }

function voiceFiles() {
  return [
    { path: "series/voice-profile.md", content: "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n" },
    { path: "series/taste-profile.yaml", content: stringifyYaml(defaultTasteProfile()) },
    { path: "series/voice-guardrails.yaml", content: stringifyYaml(defaultVoiceGuardrails()) },
    { path: "series/voice-experiments/index.yaml", content: stringifyYaml(defaultVoiceExperimentIndex()) },
  ];
}

// The whole point of Phase 5: the baseline evaluated four hand-authored YAML
// fixtures, so it measured whether a counter reproduced numbers a person had
// typed. This drives the real workflow and evaluates what it actually emitted.
test("a real workflow emits a trace the existing evaluator can score", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Recorded", projectType: "standalone", profile: "thriller" });
    assert.deepEqual(readJourneyTrace(root), [], "a new project starts with an empty trace");

    // One host turn: the workflow decides what to do next.
    const first = decideNextRun(root);
    assert.equal(first.action, "voice");

    // One guarded event, rejected: an incomplete required set.
    assert.throws(() => applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [voiceFiles()[0]!],
    }));

    // The corrected resubmission, accepted.
    applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: voiceFiles(),
    });

    // One writer approval.
    approveProjectGate(root, "voice-approval", "Voice reads as intended.");

    const events = readJourneyTrace(root);
    for (const event of events) assertPrivacySafe(event);

    // The evaluator that previously only ever saw hand-authored fixtures now
    // scores a trace the workflow produced.
    const fixture = { schema_version: "1.0.0", id: "recorded", description: "", limitations: ["x"], trace: { events }, expected: {} as never, limits: {} as never } as unknown as AuthorJourneyFixture;
    const metrics = evaluateAuthorJourney(fixture, { events });

    assert.equal(metrics.guardedEvents, 2, "one rejection and one acceptance");
    assert.equal(metrics.rejectedEvents, 1);
    assert.equal(metrics.retries, 1, "the resubmission is linked to the rejection it corrects");
    assert.equal(metrics.writerApprovals, 1);
    assert.ok(metrics.modelPrompts >= 1, "the host turn that produced the voice prompt is counted");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a retry is linked only to an unretried rejection of the same action and chapter", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Retry Link", projectType: "standalone", profile: "thriller" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.throws(() => applyNovelEvent(root, {
        eventType: "voice-profile",
        expectedStage: "voice-intake",
        expectedProjectHash: projectStateHash(root),
        files: [voiceFiles()[0]!],
      }));
    }
    applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: voiceFiles(),
    });
    const events = readJourneyTrace(root);
    const guarded = events.filter((event): event is Extract<typeof event, { type: "guarded-event" }> => event.type === "guarded-event");
    assert.equal(guarded.length, 3);
    // Each retry links to exactly one earlier rejection, and no rejection is
    // claimed twice — otherwise the evaluator would double-count.
    const linked = guarded.map((event) => event.retry_of).filter(Boolean);
    assert.equal(new Set(linked).size, linked.length, "no rejection is retried twice");
    const metrics = evaluateAuthorJourney({ trace: { events } } as never, { events });
    assert.equal(metrics.rejectedEvents, 2);
    assert.equal(metrics.retries, 2);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the velocity summary reports author actions and host turns per completed chapter", () => {
  const events = [
    { type: "author-question", id: "Q-001" },
    { type: "model-prompt", id: "P-001" },
    { type: "guarded-event", id: "E-001", action: "draft-chapter", outcome: "accepted", chapter: 1 },
    { type: "model-prompt", id: "P-002" },
    { type: "guarded-event", id: "E-002", action: "draft-chapter", outcome: "accepted", chapter: 2 },
    { type: "writer-approval", gate: "first-chapter-approval" },
  ] as const;
  const velocity = summarizeJourneyVelocity(events as never);
  assert.equal(velocity.chaptersCompleted, 2);
  assert.equal(velocity.authorActions, 2, "one question plus one approval");
  assert.equal(velocity.hostPrompts, 2);
  assert.equal(velocity.authorActionsPerChapter, 1);
  assert.equal(velocity.hostPromptsPerChapter, 1);
});

test("an empty trace reports no rate rather than dividing by zero", () => {
  const velocity = summarizeJourneyVelocity([]);
  assert.equal(velocity.chaptersCompleted, 0);
  assert.equal(velocity.authorActionsPerChapter, null);
  assert.equal(velocity.hostPromptsPerChapter, null);
});

test("traces are operational: disabled telemetry records nothing, and no event carries content", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Telemetry Off", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.runtime = { ...project.runtime, telemetry: false };
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    decideNextRun(root);
    assert.throws(() => applyNovelEvent(root, {
      eventType: "voice-profile", expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root), files: [voiceFiles()[0]!],
    }));
    assert.deepEqual(readJourneyTrace(root), [], "an opted-out project records nothing");

    // The privacy shape is enforced, not merely intended.
    assert.throws(
      () => assertPrivacySafe({ type: "guarded-event", id: "E-001", action: "draft-chapter", outcome: "accepted", prose: "the chapter text" } as never),
      /outside its privacy-safe shape/,
    );
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the trace lives in the ignored operational tree and never dirties the writer's repository", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Clean Tree", projectType: "standalone", profile: "thriller" });
    decideNextRun(root);
    assert.match(journeyTracePath(root), /\.pi-book[/\\]journey[/\\]trace\.jsonl$/);
    assert.ok(readJourneyTrace(root).length > 0, "the trace was written");
    const porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
    assert.equal(porcelain, "", "operational state is ignored by the generated project's .gitignore");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
