import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { VoiceExperimentFileSchema, defaultTasteProfile, defaultVoiceExperimentIndex, defaultVoiceGuardrails, type VoiceExperimentFile } from "../src/domain/v1-3-schemas.js";
import { stableContentHash, summarizeVoiceScores, voiceExperimentFindings, type VoiceExperimentAssetMap } from "../src/application/voice-experiment.js";
import { initializeProject } from "../src/project/store.js";

const base = "series/voice-experiments/VE-001";
type AcceptedVoiceExperiment = Extract<VoiceExperimentFile, { status: "accepted" }>;

function words(count: number, prefix = "word"): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
}

function validAssets(): VoiceExperimentAssetMap {
  return {
    [`${base}/source-scene.md`]: words(700, "source"),
    [`${base}/variant-a.md`]: words(600, "alpha"),
    [`${base}/variant-b.md`]: words(650, "bravo"),
    [`${base}/variant-c.md`]: words(700, "charlie"),
    [`${base}/baseline.md`]: words(675, "baseline"),
  };
}

function acceptedExperiment(assets = validAssets()): AcceptedVoiceExperiment {
  return {
    schema_version: "1.0.0",
    id: "VE-001",
    status: "accepted",
    source_scene_path: `${base}/source-scene.md`,
    source_scene_hash: stableContentHash(assets[`${base}/source-scene.md`] ?? ""),
    variants: [
      { id: "A", path: `${base}/variant-a.md`, content_hash: stableContentHash(assets[`${base}/variant-a.md`] ?? "") },
      { id: "B", path: `${base}/variant-b.md`, content_hash: stableContentHash(assets[`${base}/variant-b.md`] ?? "") },
      { id: "C", path: `${base}/variant-c.md`, content_hash: stableContentHash(assets[`${base}/variant-c.md`] ?? "") },
    ],
    scores: [
      { evaluator_id: "writer", variant_id: "A", feels_like_book: 4, desire_to_continue: 4, character_intimacy: 4, prose_naturalness: 4, distinctiveness: 4, density: 0, note: "" },
      { evaluator_id: "writer", variant_id: "B", feels_like_book: 5, desire_to_continue: 5, character_intimacy: 5, prose_naturalness: 5, distinctiveness: 5, density: 1, note: "" },
      { evaluator_id: "writer", variant_id: "C", feels_like_book: 3, desire_to_continue: 3, character_intimacy: 3, prose_naturalness: 3, distinctiveness: 3, density: -1, note: "" },
    ],
    accepted_traits: ["compressed interiority"],
    baseline_path: `${base}/baseline.md`,
    baseline_hash: stableContentHash(assets[`${base}/baseline.md`] ?? ""),
  };
}

function experimentFiles(experiment: AcceptedVoiceExperiment, assets: VoiceExperimentAssetMap) {
  return [
    { path: `${base}/experiment.yaml`, content: stringifyYaml(experiment) },
    ...Object.entries(assets).map(([path, content]) => ({ path, content })),
  ];
}

test("stable content hashes normalize line endings but not prose changes", () => {
  assert.equal(stableContentHash("one\r\ntwo\r\n"), stableContentHash("one\ntwo\n"));
  assert.notEqual(stableContentHash("one two"), stableContentHash("one three"));
});

test("accepted experiments require distinct ordered A B and C variants", () => {
  const experiment = acceptedExperiment() as any;
  experiment.variants = [experiment.variants[0], { ...experiment.variants[1], id: "A" }, experiment.variants[2]];
  assert.throws(() => parseYaml(stringifyYaml(experiment), VoiceExperimentFileSchema, "experiment.yaml"), /schema validation/i);
});

test("variants remain within 600 to 900 words and contain no influence labels", () => {
  const assets = validAssets();
  assets[`${base}/variant-a.md`] = words(599, "short");
  assets[`${base}/variant-c.md`] = `Example Author ${words(600, "named")}`;
  const experiment = acceptedExperiment(assets);
  const taste = defaultTasteProfile();
  taste.influences.push({
    id: "INF-001",
    reference: "Example Author — Example Book",
    influence_type: "voice",
    admired_for: ["compression"],
    not_for: ["signature phrasing"],
    derived_traits: ["compressed interiority"],
    status: "approved",
  });

  const findings = voiceExperimentFindings(experiment, assets, taste);
  assert.ok(findings.some((item) => item.code === "variant-word-count" && item.variantId === "A"));
  assert.ok(findings.some((item) => item.code === "variant-reference" && item.variantId === "C"));
});

test("stored hashes and accepted baseline hash must match exact normalized content", () => {
  const assets = validAssets();
  const experiment = acceptedExperiment(assets);
  assert.deepEqual(voiceExperimentFindings(experiment, assets, defaultTasteProfile()), []);
  assert.ok(voiceExperimentFindings({ ...experiment, baseline_hash: "0".repeat(64) }, assets, defaultTasteProfile()).some((item) => item.code === "hash-mismatch"));
});

test("voice score summaries are deterministic and ordered by score", () => {
  assert.deepEqual(summarizeVoiceScores(acceptedExperiment()).map((item) => [item.variantId, item.average, item.densityAverage]), [
    ["B", 5, 1],
    ["A", 4, 0],
    ["C", 3, -1],
  ]);
});

test("research-update rejects a syntactically valid experiment with false content hashes", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-voice-event-"));
  try {
    const root = initializeProject(parent, { projectName: "Voice Evidence", projectType: "standalone", profile: "thriller" });
    const assets = validAssets();
    const experiment = { ...acceptedExperiment(assets), baseline_hash: "0".repeat(64) };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: experimentFiles(experiment, assets),
    }), /voice experiment|hash/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("voice experiments cannot reference assets outside their own directory", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-voice-path-"));
  try {
    const root = initializeProject(parent, { projectName: "Voice Paths", projectType: "standalone", profile: "thriller" });
    const assets = validAssets();
    const borrowedPath = "series/borrowed-source.md";
    const borrowed = words(700, "borrowed");
    writeFileSync(join(root, borrowedPath), borrowed, "utf8");
    const experiment = { ...acceptedExperiment(assets), source_scene_path: borrowedPath, source_scene_hash: stableContentHash(borrowed) };
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: experimentFiles(experiment, assets),
    }), /directory|path|asset/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("final voice evidence must select one internally consistent accepted baseline", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-voice-baseline-"));
  try {
    const root = initializeProject(parent, { projectName: "Voice Baseline", projectType: "standalone", profile: "thriller" });
    const assets = validAssets();
    const experiment = acceptedExperiment(assets);
    applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: experimentFiles(experiment, assets),
    });

    const taste = defaultTasteProfile();
    taste.opening_experiment = { status: "accepted", experiment_id: "VE-001", baseline_path: experiment.baseline_path };
    const guardrails = { ...defaultVoiceGuardrails(), prefer: ["compressed interiority"], baseline: { path: experiment.baseline_path, content_hash: experiment.baseline_hash, metrics: {} } };
    const index = defaultVoiceExperimentIndex();
    index.experiments.push({ id: "VE-001", path: `${base}/experiment.yaml`, status: "accepted", baseline_hash: "f".repeat(64) });

    const bundle = [
      { path: "series/voice-profile.md", content: "# Voice Profile\n\nUse compressed interiority.\n" },
      { path: "series/taste-profile.yaml", content: stringifyYaml(taste) },
      { path: "series/voice-guardrails.yaml", content: stringifyYaml(guardrails) },
      { path: "series/voice-experiments/index.yaml", content: stringifyYaml(index) },
    ];
    assert.throws(() => applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: bundle,
    }), /baseline|index|hash/i);

    index.experiments[0] = { id: "VE-001", path: `${base}/experiment.yaml`, status: "accepted", baseline_hash: experiment.baseline_hash };
    const result = applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: bundle.map((file) => file.path.endsWith("index.yaml") ? { ...file, content: stringifyYaml(index) } : file),
    });
    assert.equal(result.stage, "voice-intake");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
