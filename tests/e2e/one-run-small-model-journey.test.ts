import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chapterExecutionReadiness, runChapterExecution } from "../../src/application/chapter-execution-run.js";
import { applyNovelEvent, projectStateHash } from "../../src/application/events.js";
import { summarizeJourneyVelocity } from "../../src/application/journey-trace.js";
import { buildPackagingChecklist } from "../../src/application/package-checklist.js";
import { applyPackageArtifacts } from "../../src/application/packaging/apply.js";
import { PACKAGE_WITHOUT_READERS_SUBJECT } from "../../src/application/reader-checkpoint.js";
import { approveProjectGate, decideNextRun } from "../../src/application/run.js";
import { chapterContractPath } from "../../src/domain/chapter-contract.js";
import type { QualityWorker, QualityWorkerRequest, QualityWorkerResult } from "../../src/domain/quality-worker.js";
import type { ReaderExperimentsState } from "../../src/domain/schemas.js";
import { defaultTasteProfile, defaultVoiceExperimentIndex, defaultVoiceGuardrails } from "../../src/domain/v1-3-schemas.js";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../../src/domain/v1-2-schemas.js";
import type { WriterDecisionRecord } from "../../src/domain/v1-4-schemas.js";
import { assertPrivacySafe, readJourneyTrace } from "../../src/infrastructure/journey-trace-store.js";
import { parseYaml, stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../../src/project/store.js";
import { completeStrategy, researchFixture, sourcesFixture } from "../phase4-fixtures.js";

/**
 * The one-run definition of done: a writer on a constrained runtime profile
 * reaches a packaged book through writer gates and budget stops only — never
 * through a missing driver, an unreachable setting, or an arbitrary counter.
 *
 * Runtime/model choice: `runtimeProfile: "local"` is the constrained-context
 * profile the small-model program exists to serve. `modelExecutionProfile:
 * "host-default"` is deliberate, not an oversight — the Gemma exact-model
 * profile additionally requires fingerprint qualification (a worker-supplied
 * capacity match against a pinned context window, backend, and quantization),
 * which is exercised in isolation by model-fingerprint.test.ts and
 * gemma-qualification.test.ts. Compounding that machinery into this already
 * multi-stage journey would test the fingerprint mock, not the one-run claim.
 */

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-one-run-")); }

function voiceFiles() {
  return [
    { path: "series/voice-profile.md", content: "# Voice Profile\n\n## POV distance\n\nClose third-person.\n\n## Narrative tense\n\nPast tense.\n\n## Positive voice evidence\n\nEvidence changes interpretation.\n" },
    { path: "series/taste-profile.yaml", content: stringifyYaml(defaultTasteProfile()) },
    { path: "series/voice-guardrails.yaml", content: stringifyYaml(defaultVoiceGuardrails()) },
    { path: "series/voice-experiments/index.yaml", content: stringifyYaml(defaultVoiceExperimentIndex()) },
  ];
}

function seriesFiles(root: string) {
  return [
    { path: "series/series-bible.md", content: "# Series Bible\n\nA standalone technothriller about manufactured evidence and institutional trust.\n" },
    { path: "series/series-arc.yaml", content: readFileSync(join(root, "series/series-arc.yaml"), "utf8") },
    { path: "series/canon.yaml", content: stringifyYaml({
      schema_version: "1.0.0",
      facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
      relationships: [],
    }) },
    { path: "series/story-threads.yaml", content: stringifyYaml({
      schema_version: "1.0.0",
      threads: [{ id: "ST-001", type: "mystery", setup: "a missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
    }) },
  ];
}

function packet(chapter: number, milestoneGate: string | null) {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready" as const, pov: "CHAR-MARA",
    purpose: `advance the case, chapter ${chapter}`, scene_engine: `engine-${chapter}`,
    pressure_movement: "pressure rises", character_movement: "Mara chooses", relationship_movement: "trust changes",
    story_thread_refs: ["ST-001"], continuity_refs: ["CAN-001"], character_refs: ["CHAR-MARA"], required_research: [],
    profile_fields: { threat_delta: "+1", evidence_delta: `EV-${chapter}`, reader_forecast_change: "a new possibility opens", protagonist_choice: "continues" },
    ending_hook: `hook-${chapter}`, milestone_gate: milestoneGate, target_words: 900 + chapter * 40,
  };
}

function queueFixture() {
  return { schema_version: "1.0.0", active_window: "act-1", packets: [packet(1, null), packet(2, "act-1-review"), packet(3, null), packet(4, null)] };
}

// Two acts, so the run must cross a milestone gate (act-1-review) mid-book,
// not only the first-chapter and manuscript gates every guarded-execution
// test already covers.
function plotFixture() {
  return {
    schema_version: "1.0.0",
    acts: [
      { id: "I", purpose: "entry", start_chapter: 1, end_chapter: 2, gate: "act-1-review" },
      { id: "II", purpose: "reversal", start_chapter: 3, end_chapter: 4, gate: null },
    ],
    chapters: [
      { chapter: 1, act: "I", causality: "because the threat appears", state_change: "Mara commits", setup_ids: ["ST-001"], payoff_ids: [], profile_obligations: ["genre promise"] },
      { chapter: 2, act: "I", causality: "therefore she investigates", state_change: "evidence changes", setup_ids: [], payoff_ids: [], profile_obligations: ["pressure"] },
      { chapter: 3, act: "II", causality: "because the evidence fails", state_change: "trust breaks", setup_ids: [], payoff_ids: [], profile_obligations: ["reversal"] },
      { chapter: 4, act: "II", causality: "therefore she acts", state_change: "thread advances", setup_ids: [], payoff_ids: ["ST-001"], profile_obligations: ["payoff"] },
    ],
    decisions: [{
      id: "DEC-001", chapter: 2, choice: "Mara enters the restricted archive.",
      immediate_gain: "She obtains the missing log.", deferred_cost: "Security now tracks her.",
      irreversible_effect: "Her official access is revoked.",
      payoff_window: { start_chapter: 3, end_chapter: 4 }, status: "planned",
    }],
  };
}

function validRemarkability() {
  return {
    schema_version: "1.0.0", safe_obvious_version: "A routine archive mystery", author_only_advantage: "Institutional intimacy",
    productive_discomfort: "The right choice has a cost", retellable_hook: "The archive records choices before they occur",
    signature_moments: [
      { id: "SIG-001", description: "Mara opens the predictive ledger", intended_reader_memory: "the impossible entry", planned_location: "chapter-2", status: "planned" },
      { id: "SIG-002", description: "Mara burns her own clearance", intended_reader_memory: "the costly choice", planned_location: "chapter-4", status: "planned" },
    ],
    productive_disagreements: [{ question: "Was the breach justified?", competing_readings: ["yes", "no"] }],
    recurring_motifs: [], lingering_question: "Who wrote the first entry?",
    hand_sell_reason: "A fair-play institutional mystery", accepted_reader_costs: ["procedural density"],
  };
}

function bookPlanFiles(root: string) {
  const bookRoot = join(root, "books", "book-01");
  return [
    { path: "books/book-01/book-bible.md", content: readFileSync(join(bookRoot, "book-bible.md"), "utf8") },
    { path: "books/book-01/genre.yaml", content: readFileSync(join(bookRoot, "genre.yaml"), "utf8") },
    { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(plotFixture()) },
    { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
    { path: "books/book-01/continuity-delta.yaml", content: readFileSync(join(bookRoot, "continuity-delta.yaml"), "utf8") },
    { path: "books/book-01/remarkability.yaml", content: stringifyYaml(validRemarkability()) },
    { path: "books/book-01/research-ledger.yaml", content: stringifyYaml(researchFixture()) },
    { path: "books/book-01/book-strategy.yaml", content: stringifyYaml(completeStrategy()) },
    { path: "research/source-register.yaml", content: stringifyYaml(sourcesFixture()) },
    { path: "series/story-threads.yaml", content: readFileSync(join(root, "series", "story-threads.yaml"), "utf8") },
  ];
}

function contractFor(chapter: number) {
  return {
    schema_version: "2.0.0", contract_id: `CH-${String(chapter).padStart(3, "0")}`, version: 1, chapter, title: `Chapter ${chapter}`,
    source_kind: "approved-contract" as const, source_packet_hash: "a".repeat(64), pov: "CHAR-MARA",
    purpose: `advance the case, chapter ${chapter}`,
    required_beats: ["Enter the archive", "Discover revoked access"],
    active_thread_ids: ["ST-001"], required_record_ids: ["CAN-001"], start_state_ids: [],
    // Empty, not because a real contract should promise nothing, but because
    // ScriptedWorker's extract-state-delta always returns no mutations; a
    // non-empty required_end_state is checked against what the scene actually
    // delivers, and a promise this fixture can't keep would trip repair.
    required_end_state: [] as { record_id: string; field: string; operation: "set" | "add" | "remove"; value: unknown }[],
    forbidden_changes: ["Do not resolve the mystery before the final chapter."],
    knowledge_boundary_ids: [],
    target_words: { minimum: 300, maximum: 380 },
    ending_hook: `hook-${chapter}`,
    small_model_ready: true, missing_small_model_fields: [] as string[],
  };
}

const planOutput = {
  schema_version: "1.0.0",
  steps: [
    { required_beat: "Enter the archive", execution: "Mara enters through the maintenance threshold.", pressure: "A patrol cycle narrows the window." },
    { required_beat: "Discover revoked access", execution: "The terminal rejects her credential.", pressure: "The failure may log her presence." },
  ],
  turn_execution: "She notices a conduit beneath the reader.", ending_execution: "She reaches the terminal unseen.",
  evidence_record_ids: ["CAN-001"],
};
const sceneDraft = Array.from({ length: 320 }, (_, index) => index % 16 === 15 ? `checkpoint${index + 1}.` : `word${index + 1}`).join(" ");

function usage(request: QualityWorkerRequest): QualityWorkerResult["usage"] {
  return {
    callId: request.callId, stage: request.stage,
    ...(request.chapter !== undefined ? { chapter: request.chapter } : {}),
    ...(request.sceneId !== undefined ? { sceneId: request.sceneId } : {}),
    ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
    pass: request.pass, ...(request.jobType !== undefined ? { jobType: request.jobType } : {}),
    estimated: true, elapsedMs: 5, promptHash: "1".repeat(64), contextHash: "2".repeat(64), outputHash: "3".repeat(64),
  };
}

// A deterministic scripted worker — never a real model call, matching how
// ordinary tests and CI exercise guarded scene execution end to end.
class ScriptedWorker implements QualityWorker {
  requests: QualityWorkerRequest[] = [];
  async run(request: QualityWorkerRequest): Promise<QualityWorkerResult> {
    this.requests.push(request);
    if (request.jobType === "plan-scene") return { text: JSON.stringify(planOutput), usage: usage(request) };
    if (request.jobType === "draft-scene") return { text: sceneDraft, usage: usage(request) };
    if (request.jobType === "critic-continuity" || request.jobType === "critic-style") {
      return { text: JSON.stringify({ schema_version: "1.0.0", verdict: "pass", findings: [] }), usage: usage(request) };
    }
    if (request.jobType === "extract-state-delta") return { text: JSON.stringify({ schema_version: "1.0.0", mutations: [] }), usage: usage(request) };
    throw new Error(`Unexpected model job ${request.jobType} for chapter ${request.chapter} scene ${request.sceneId}.`);
  }
  async resolveModelCapacity() { return null; }
}

const critics = ["critic-continuity", "critic-style"] as const;

function readerResponse(readerId: string) {
  return {
    reader_id: readerId, source: "human" as const, segment: "target", recorded_at: "2026-01-01T00:00:00Z",
    continued_reading: true, would_buy: true, confusions: [], trust_breaks: [], lines_that_worked: ["the hatch"],
    remembered_hook: "the hatch", remembered_moments: ["the hatch"], friend_description: "tense",
    disagreement_question: "was she right", lingering_question: "who opened it",
    recommendation_target: "thriller readers", recommendation_reason: "pace", told_someone: true,
  };
}

function readerExperiment() {
  return {
    id: "RE-001", status: "immediate-complete", scope: "first-chapter", variant: "", blind: true,
    target_reader: "thriller readers", sample_path: "books/book-01/reader-kit/sample.md",
    minimum_reader_count: 3, immediate_responses: [readerResponse("R-1"), readerResponse("R-2"), readerResponse("R-3")],
    delayed_after_hours: 48, delayed_responses: [],
    metrics: {
      continuation_rate: null, purchase_intent_rate: null, delayed_hook_recall_rate: null,
      signature_moment_recall_rate: null, specific_recommendation_rate: null, talkability_rate: null,
    },
    verdict: "insufficient-signal", next_action: "collect more responses",
  };
}

function fillPackagingMetadata(root: string): void {
  const publishingPath = join(root, "books/book-01/publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.title = "The Clean Signal";
  publishing.author.pen_name = "Nessa Keane";
  publishing.language = "en-US";
  publishing.copyright = { holder: "Nessa Keane", year: "2026", notice: "Copyright © 2026 Nessa Keane" };
  publishing.descriptions.short = "A manufactured warning turns an analyst into a fugitive.";
  publishing.descriptions.long = "A geopolitical techno-thriller about a manufactured warning and the analyst who refuses to trust it.";
  publishing.keywords = ["geopolitical thriller"];
  publishing.categories = ["FICTION / Thrillers / Political"];
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");

  const marketingPath = join(root, "books/book-01/marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  marketing.positioning.items = ["A technothriller about a warning that was too clean to be real."];
  marketing.audiences.items = ["Readers of institutional and procedural thrillers."];
  marketing.hooks.items = ["The warning was engineered before the war was."];
  marketing.retailer_copy.items = ["An analyst discovers the signal designed to start a war."];
  marketing.launch.items = ["The warning was clean. Too clean."];
  marketing.social.items = ["An analyst discovers the signal designed to start a war."];
  marketing.advertisements.items = ["AI follows orders no human signed."];
  marketing.audiobook_promotion.items = ["Listen to the conspiracy unfold."];
  marketing.series_page.items = ["Book one of the series."];
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

/** Voice intake through an executable contract for every chapter — the planning half of one run. */
function driveToDrafting(root: string): void {
  // series/entity-registry.yaml is not part of any guarded event's allowed
  // paths — like state-ledger.yaml and knowledge-ledger.yaml, it is written
  // directly, matching how chapter-execution-run.test.ts's own fixture does it.
  writeFileSync(join(root, "series/entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [{ id: "CHAR-MARA", category: "character", display_name: "Mara", aliases: [], status: "locked-canon", source: "series-bible", introduced_in: "book-01" }],
  }), "utf8");

  decideNextRun(root);
  applyNovelEvent(root, { eventType: "voice-profile", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root), files: voiceFiles() });
  assert.equal(readProject(root).next_gate, "voice-approval", "the run stops at the voice gate rather than crossing it");
  approveProjectGate(root, "voice-approval", "Voice reads as intended.");

  decideNextRun(root);
  applyNovelEvent(root, { eventType: "series-plan", expectedStage: "series-planning", expectedProjectHash: projectStateHash(root), files: seriesFiles(root) });
  assert.equal(readProject(root).current_stage, "book-planning");

  decideNextRun(root);
  applyNovelEvent(root, { eventType: "book-plan", expectedStage: "book-planning", expectedProjectHash: projectStateHash(root), files: bookPlanFiles(root) });
  assert.equal(readProject(root).next_gate, "book-plan-approval", "the run stops at the book-plan gate rather than crossing it");
  approveProjectGate(root, "book-plan-approval", "Plan holds up.");

  decideNextRun(root);
  applyNovelEvent(root, {
    eventType: "chapter-queue", expectedStage: "chapter-queue", expectedProjectHash: projectStateHash(root),
    files: [
      { path: "books/book-01/chapter-queue.yaml", content: stringifyYaml(queueFixture()) },
      { path: "books/book-01/plot-grid.yaml", content: stringifyYaml(plotFixture()) },
    ],
  });
  assert.equal(readProject(root).current_stage, "drafting");

  mkdirSync(join(root, "books/book-01/contracts/chapters"), { recursive: true });
  for (const chapter of [1, 2, 3, 4]) {
    writeFileSync(join(root, chapterContractPath("book-01", chapter)), stringifyYaml(contractFor(chapter)), "utf8");
    assert.equal(chapterExecutionReadiness(root, "book-01", chapter).ready, true, `chapter ${chapter} contract should be executable`);
  }
}

/** Drafts all four chapters through the guarded scene path, crossing both mid-book gates. */
async function draftAllChapters(root: string): Promise<void> {
  for (const chapter of [1, 2, 3, 4]) {
    const worker = new ScriptedWorker();
    const run = await runChapterExecution({
      root, chapter, runId: `RUN-BOOK01-${String(chapter).padStart(3, "0")}`, worker, requiredCriticJobTypes: critics,
    });
    assert.equal(run.stopReason, "complete", `chapter ${chapter} should reach a guarded commit`);
    assert.equal(run.committed, true, `chapter ${chapter} should take the guarded scene path, not fall back`);
    assert.ok(run.actions.includes("critic-completed"), `chapter ${chapter} should have run its critics`);

    if (chapter === 1) {
      assert.equal(readProject(root).next_gate, "first-chapter-approval", "the run stops at the first-chapter gate");
      approveProjectGate(root, "first-chapter-approval", "Opening lands.");
    } else if (chapter === 2) {
      assert.equal(readProject(root).next_gate, "act-1-review", "the run stops at the act boundary rather than crossing it");
      approveProjectGate(root, "act-1-review", "Act one holds together.");
    }
  }
  assert.equal(readProject(root).current_stage, "manuscript-review", "all four planned chapters are drafted");
}

/** Manuscript review through canon lock — the run is now sitting in "packaging". */
function reachPackagingStage(root: string): void {
  decideNextRun(root);
  applyNovelEvent(root, {
    eventType: "review", expectedStage: "manuscript-review", expectedProjectHash: projectStateHash(root),
    scope: "manuscript",
    files: [
      { path: "books/book-01/review-report.md", content: "# Manuscript Review\n\nNo blocking findings.\n" },
      { path: "books/book-01/revision-tickets.yaml", content: stringifyYaml({ schema_version: "1.0.0", tickets: [] }) },
    ],
  });
  assert.equal(readProject(root).next_gate, "manuscript-approval", "the run stops at the manuscript gate rather than crossing it");
  approveProjectGate(root, "manuscript-approval", "Manuscript holds together.");

  applyNovelEvent(root, {
    eventType: "canon-lock", expectedStage: "canon-lock", expectedProjectHash: projectStateHash(root),
    files: [
      { path: "series/canon.yaml", content: readFileSync(join(root, "series/canon.yaml"), "utf8") },
      { path: "series/story-threads.yaml", content: readFileSync(join(root, "series/story-threads.yaml"), "utf8") },
      { path: "series/series-arc.yaml", content: readFileSync(join(root, "series/series-arc.yaml"), "utf8") },
    ],
  });
  assert.equal(readProject(root).current_stage, "packaging");
  fillPackagingMetadata(root);
}

test("one run reaches a packaged book on a constrained runtime through gates and budget stops only", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, {
      projectName: "One Run", projectType: "standalone", profile: "thriller",
      runtimeProfile: "local", modelExecutionProfile: "host-default",
    });
    assert.equal(readProject(root).runtime?.profile, "local");
    assert.deepEqual(readJourneyTrace(root), []);

    driveToDrafting(root);
    await draftAllChapters(root);
    reachPackagingStage(root);

    // Real human reader evidence — no waiver in this run.
    applyNovelEvent(root, {
      eventType: "reader-test", expectedStage: "packaging", expectedProjectHash: projectStateHash(root), scope: "first-chapter",
      files: [{ path: "books/book-01/reader-experiments.yaml", content: stringifyYaml({ schema_version: "1.0.0", experiments: [readerExperiment()] } as unknown as ReaderExperimentsState) }],
    });

    const checklist = buildPackagingChecklist(root);
    const blockers = checklist.items.filter((item) => item.blocking && !item.complete);
    assert.deepEqual(blockers, [], `packaging should be unblocked: ${blockers.map((item) => item.id).join(", ")}`);

    // Headless packaging, checklist-gated — the same path /novel-package --apply takes.
    const packaged = await applyPackageArtifacts(root, { preferPandoc: false });
    assert.ok(packaged.changed.length > 0);
    assert.equal(readProject(root).gates["package-approval"], "pending", "the run stops at the final gate rather than crossing it");

    const manifestChange = packaged.changed.find((path) => path.endsWith("package-manifest.yaml"));
    assert.ok(manifestChange, "packaging should produce a manifest");
    const manifestContent = readFileSync(join(root, "books/book-01/exports/package-manifest.yaml"), "utf8");
    assert.doesNotMatch(manifestContent, /No human reader has read this book/, "real reader evidence was recorded — no waiver language should appear");

    // What the whole small-model program set out to measure.
    const trace = readJourneyTrace(root);
    for (const event of trace) assertPrivacySafe(event);
    const velocity = summarizeJourneyVelocity(trace);
    assert.equal(velocity.chaptersCompleted, 4, "every guarded-path chapter commit is counted");
    assert.ok(velocity.authorActions <= 10, `author actions should stay bounded: ${velocity.authorActions}`);
    assert.ok(velocity.hostPrompts <= 10, `host prompts should stay bounded: ${velocity.hostPrompts}`);
    assert.ok(velocity.guardedEvents >= 8, "planning, drafting, and review events should all be counted");
    assert.equal(velocity.rejectedEvents, 0, "a clean run rejects nothing");
    assert.ok(velocity.authorActionsPerChapter !== null && velocity.authorActionsPerChapter <= 3, "author actions per chapter should stay low");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("the recorded reader-evidence waiver reaches the same packaged book without a human reader", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, {
      projectName: "One Run Waived", projectType: "standalone", profile: "thriller",
      runtimeProfile: "local", modelExecutionProfile: "host-default",
    });

    // The waiver is a decision-ledger entry, and intake-update only accepts
    // decision-ledger writes during voice-intake, series-planning, or
    // book-planning — so it has to be recorded now, not at the packaging gate
    // where the need becomes visible.
    const decision: WriterDecisionRecord = {
      id: "DEC-001", scope: "project", subject: PACKAGE_WITHOUT_READERS_SUBJECT,
      choice: "accept:no-reader-evidence", decidedAt: "2026-01-01T00:00:00Z",
      evidenceRefs: ["writer confirmed no reader is available before launch"], replaces: null,
    };
    applyNovelEvent(root, {
      eventType: "intake-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "series/decision-ledger.yaml", content: stringifyYaml({ schema_version: "1.0.0", assumptions: [], decisions: [decision] }) }],
    });

    driveToDrafting(root);
    await draftAllChapters(root);
    reachPackagingStage(root);

    // No reader-test event at all — packaging must rely on the recorded waiver.
    const checklist = buildPackagingChecklist(root);
    const readerItem = checklist.items.find((item) => item.id === "reader-checkpoint");
    assert.equal(readerItem?.complete, true);
    assert.equal(readerItem?.blocking, false, "a waived checkpoint is a warning, not a blocker");

    await applyPackageArtifacts(root, { preferPandoc: false });
    const manifestContent = readFileSync(join(root, "books/book-01/exports/package-manifest.yaml"), "utf8");
    assert.match(manifestContent, /No human reader has read this book/);
    assert.match(manifestContent, /DEC-001/);

    // The waiver never becomes evidence: the file it would have populated stays untouched.
    const readerEvidence = readFileSync(join(root, "books/book-01/reader-experiments.yaml"), "utf8");
    assert.doesNotMatch(readerEvidence, /RE-\d{3}/);

    const trace = readJourneyTrace(root);
    for (const event of trace) assertPrivacySafe(event);
    assert.equal(summarizeJourneyVelocity(trace).chaptersCompleted, 4);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
