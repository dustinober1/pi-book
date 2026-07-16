import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { defaultTasteProfile, defaultVoiceExperimentIndex, defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { stableContentHash } from "../src/application/voice-experiment.js";
import { createResearchWizardHandler, researchWizardSnapshot } from "../src/application/research/wizard.js";
import { projectStateHash } from "../src/application/project-hash.js";
import { completeStrategy, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function words(count: number, prefix: string): string { return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" "); }

function setup(parent: string) {
  const root = initializeProject(parent, { projectName: "Research Wizard", projectType: "standalone", profile: "thriller" });
  const bookRoot = join(root, "books", "book-01");
  const taste = defaultTasteProfile();
  taste.influences.push({ id: "INF-001", reference: "Private Author — Private Book", influence_type: "voice", admired_for: ["compressed tension"], not_for: ["signature phrasing"], derived_traits: ["tight causal sentences"], status: "approved" });
  writeFileSync(join(root, "series", "taste-profile.yaml"), stringifyYaml(taste), "utf8");
  const base = join(root, "series", "voice-experiments", "VE-001");
  mkdirSync(base, { recursive: true });
  const source = words(650, "source"); const a = words(610, "alpha"); const b = words(620, "bravo"); const c = words(630, "charlie");
  writeFileSync(join(base, "source-scene.md"), source, "utf8");
  writeFileSync(join(base, "variant-a.md"), a, "utf8");
  writeFileSync(join(base, "variant-b.md"), b, "utf8");
  writeFileSync(join(base, "variant-c.md"), c, "utf8");
  writeFileSync(join(base, "experiment.yaml"), stringifyYaml({ schema_version: "1.0.0", id: "VE-001", status: "scoring", source_scene_path: "series/voice-experiments/VE-001/source-scene.md", source_scene_hash: stableContentHash(source), variants: [
    { id: "A", path: "series/voice-experiments/VE-001/variant-a.md", content_hash: stableContentHash(a) },
    { id: "B", path: "series/voice-experiments/VE-001/variant-b.md", content_hash: stableContentHash(b) },
    { id: "C", path: "series/voice-experiments/VE-001/variant-c.md", content_hash: stableContentHash(c) },
  ], scores: [], accepted_traits: [], baseline_path: null, baseline_hash: null }), "utf8");
  const index = defaultVoiceExperimentIndex(); index.experiments.push({ id: "VE-001", path: "series/voice-experiments/VE-001/experiment.yaml", status: "scoring", baseline_hash: null });
  writeFileSync(join(root, "series", "voice-experiments", "index.yaml"), stringifyYaml(index), "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml(defaultVoiceGuardrails()), "utf8");
  const strategy = completeStrategy();
  strategy.reader_friction.observations.push({ id: "OBS-001", title: "Comparable", source_location: "manual", observed_on: "2026-07-15", rating: 2, paraphrase: "The middle loses urgency.", short_excerpt: "middle loses urgency", genre_relevance: "high", execution_relevance: "high", category: "pacing-problem", sentiment: "negative" });
  writeFileSync(join(bookRoot, "book-strategy.yaml"), stringifyYaml({ ...strategy, revision_learning_guardrails: [] }), "utf8");
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml(researchFixture()), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml(sourcesFixture()), "utf8");
  writeFileSync(join(bookRoot, "revision-tickets.yaml"), stringifyYaml({ schema_version: "1.0.0", tickets: [1,2,3].map((chapter, index) => ({ id: `B01-T00${index + 1}`, severity: "medium", category: "scene-diversity", chapter, evidence: "Repeated interview", problem: "Repeated interview", required_change: "Change state", protected_constraints: [], acceptance_tests: ["State changes"], status: "closed", recurrence: { pattern_id: "PAT-interview", milestone_review: null } })) }), "utf8");
  writeFileSync(join(bookRoot, "manuscript", "chapters", "01-secret.md"), "# SECRET MANUSCRIPT MARKER", "utf8");
  writeFileSync(join(bookRoot, "reader-experiments.yaml"), stringifyYaml({ schema_version: "1.0.0", experiments: [{ id: "RE-SECRET", status: "complete", scope: "sample", variant: "", blind: false, target_reader: "target", sample_path: "", minimum_reader_count: 1, immediate_responses: [{ reader_id: "reader-secret", source: "human", segment: "target", recorded_at: "2026-07-15", continued_reading: true, would_buy: true, confusions: ["SECRET RESPONSE BODY"], trust_breaks: [], lines_that_worked: [], remembered_hook: "", remembered_moments: [], friend_description: "", disagreement_question: "", lingering_question: "", recommendation_target: "", recommendation_reason: "", told_someone: false }], delayed_after_hours: 24, delayed_responses: [], metrics: { continuation_rate: 1, purchase_intent_rate: 1, delayed_hook_recall_rate: null, signature_moment_recall_rate: null, specific_recommendation_rate: null, talkability_rate: null }, verdict: "insufficient-signal", next_action: "" }] }), "utf8");
  return root;
}

function envelope(root: string, action: string, payload: unknown) {
  const project = readProject(root);
  return { proposal_id: `proposal-${action}`, workflow: "research" as const, action, expected_stage: project.current_stage, expected_project_hash: projectStateHash(root), payload };
}

test("research snapshot is useful and excludes manuscript and reader-response bodies", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-snapshot-"));
  try {
    const root = setup(parent);
    const value = researchWizardSnapshot(root);
    const serialized = JSON.stringify(value);
    assert.match(serialized, /INF-001/);
    assert.match(serialized, /VE-001/);
    assert.match(serialized, /OBS-001/);
    assert.match(serialized, /RES-001/);
    assert.equal(serialized.includes("SECRET MANUSCRIPT MARKER"), false);
    assert.equal(serialized.includes("SECRET RESPONSE BODY"), false);
    assert.equal(serialized.includes("alpha0"), false);
    assert.ok(value.learning.candidates.some((candidate) => candidate.patternId === "PAT-interview" && candidate.eligible));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("influence preview requires admired, excluded, and neutral traits", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-influence-"));
  try {
    const root = setup(parent); const handler = createResearchWizardHandler(root);
    assert.throws(() => handler.preview("influence", { reference: "Example", influence_type: "voice", admired_for: ["pace"], not_for: [], derived_traits: [] }), /not_for|excluded|derived/i);
    const preview = handler.preview("influence", { reference: "Example Author — Example Book", influence_type: "voice", admired_for: ["compressed tension"], not_for: ["signature metaphors"], derived_traits: ["short causal transitions"] }) as any;
    assert.match(preview.preview_id, /^research-preview-/);
    assert.match(JSON.stringify(preview.candidate), /short causal transitions/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("voice comparison returns anonymous A B C prose without source or influence labels", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-voice-"));
  try {
    const root = setup(parent); const handler = createResearchWizardHandler(root);
    const preview = handler.preview("voice-comparison", { experiment_id: "VE-001" }) as any;
    assert.deepEqual(preview.variants.map((item: any) => item.id), ["A", "B", "C"]);
    const serialized = JSON.stringify(preview);
    assert.match(serialized, /alpha0/);
    assert.equal(serialized.includes("source0"), false);
    assert.equal(serialized.includes("Private Author"), false);
    assert.equal(serialized.includes("variant-a.md"), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("review CSV preview strips identity and preserves rating bands", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-review-"));
  try {
    const root = setup(parent); const handler = createResearchWizardHandler(root);
    const header = "title,source_location,observed_on,rating,paraphrase,short_excerpt,category,genre_relevance,execution_relevance,sentiment,reviewer_name,reviewer_handle,reviewer_profile_url";
    const rows = [
      "One,manual,2026-07-15,1,Jane Doe hated the pace,,pacing-problem,high,high,,Jane Doe,@jane,profile",
      "Two,manual,2026-07-15,3,Mixed pacing,,pacing-problem,high,high,,,,",
      "Three,manual,2026-07-15,5,Loved the pace,,pacing-problem,high,high,,,,",
    ];
    const preview = handler.preview("review-csv", { csv_text: [header, ...rows].join("\n") }) as any;
    assert.deepEqual(preview.observations.map((item: any) => item.sentiment), ["negative", "mixed", "positive"]);
    assert.equal(JSON.stringify(preview).includes("Jane Doe"), false);
    assert.equal(preview.discarded_identity_fields, 3);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("cluster, research, and learning previews reuse deterministic validators", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-previews-"));
  try {
    const root = setup(parent); const handler = createResearchWizardHandler(root);
    const cluster = handler.preview("review-cluster", { label: "Pacing loss", observation_ids: ["OBS-001"] }) as any;
    assert.equal(cluster.cluster.confidence, "weak");
    const planned = handler.preview("research-item", { item: { ...researchFixture().items[0], status: "researching", source_ids: [] } }) as any;
    assert.equal(planned.findings.some((item: any) => item.severity === "blocker"), false);
    const ready = handler.preview("research-item", { item: { ...researchFixture().items[0], source_ids: ["SRC-MISSING"] } }) as any;
    assert.ok(ready.findings.some((item: any) => item.severity === "blocker"));
    const learning = handler.preview("learning-decision", { pattern_id: "PAT-interview", decision: "approved", rule: "Every interview changes story state." }) as any;
    assert.equal(learning.candidate.eligible, true);
    assert.equal(learning.findings.some((item: any) => item.severity === "blocker"), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("confirmed influence and learning decisions apply through research-update without manuscript mutation", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-apply-"));
  try {
    const root = setup(parent); const handler = createResearchWizardHandler(root);
    const manuscriptPath = join(root, "books", "book-01", "manuscript", "chapters", "01-secret.md"); const before = readFileSync(manuscriptPath, "utf8");
    const influence = handler.preview("influence", { reference: "New Reference", influence_type: "atmosphere", admired_for: ["controlled dread"], not_for: ["copied imagery"], derived_traits: ["quiet environmental pressure"] }) as any;
    const first = await handler.apply(envelope(root, "save-influence", { preview_id: influence.preview_id })) as any;
    assert.match(first.gitMessage, /research-update/);
    const learning = handler.preview("learning-decision", { pattern_id: "PAT-interview", decision: "approved", rule: "Every interview changes story state." }) as any;
    await handler.apply(envelope(root, "save-learning-decision", { preview_id: learning.preview_id }));
    assert.match(readFileSync(join(root, "books", "book-01", "book-strategy.yaml"), "utf8"), /Every interview changes story state/);
    assert.equal(readFileSync(manuscriptPath, "utf8"), before);
    await assert.rejects(() => handler.apply({ ...envelope(root, "save-influence", { preview_id: influence.preview_id }), expected_project_hash: "stale" }), /stale|expired|unknown/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
