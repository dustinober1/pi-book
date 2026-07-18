import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeProject } from "../src/project/store.js";
import { defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  loadProseLintInput,
  projectConsistencyRules,
  runProseLint,
} from "../src/application/prose-lint/index.js";

function projectFixture(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-prose-project-"));
  const root = initializeProject(parent, {
    projectName: "Lint Fixture",
    projectType: "standalone",
    profile: "thriller",
  });
  const bookRoot = join(root, "books", "book-01");
  const chapterRoot = join(bookRoot, "manuscript", "chapters");

  writeFileSync(join(chapterRoot, "10-late.md"), [
    "# Chapter Ten",
    "",
    "Mara Vale preferred the colour gray.",
    "Tomorrow she would inspect the archive.",
  ].join("\n"), "utf8");
  writeFileSync(join(chapterRoot, "02-first.md"), [
    "# Chapter Two",
    "",
    "mara vale was 42 when she chose the color grey.",
  ].join("\n"), "utf8");
  writeFileSync(join(chapterRoot, "02-second.md"), "# Chapter Two B\n\nJonah waited.\n", "utf8");

  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    ...defaultVoiceGuardrails(),
    baseline: {
      path: "series/voice-experiments/VE-001/accepted.md",
      content_hash: "a".repeat(64),
      metrics: { not_x_but_y_rate_per_1000: 4, fragment_ratio: 0.08 },
    },
  }), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [
      { id: "CAN-AGE", category: "character", subject: "Mara Vale", fact: "Mara Vale is 41.", source: "book-01", status: "locked", introduced_in: "book-01" },
      { id: "CAN-AGE", category: "character", subject: "Jonah Pike", fact: "Jonah Pike is 37.", source: "book-01", status: "provisional", introduced_in: "book-01" },
    ],
    relationships: [{
      id: "REL-001",
      characters: ["Mara Vale", "Jonah Pike"],
      state: "allies",
      trust: "guarded",
      public_status: "colleagues",
      private_status: "uneasy allies",
      unresolved: [],
      status: "locked",
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "A vanished file", reader_knows: "It existed", characters_know: {}, status: "open", intended_payoff: null, last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    sources: [{ id: "SRC-001", type: "book", title: "Archives", location: "library", verified_on: null, supports: [], notes: "" }],
  }), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "act-1",
    packets: [{
      chapter: 2,
      title: "Second",
      status: "ready",
      pov: "Mara",
      purpose: "investigate",
      scene_engine: "search",
      pressure_movement: "rises",
      character_movement: "commits",
      relationship_movement: "strains",
      story_thread_refs: ["ST-MISSING"],
      continuity_refs: ["CAN-MISSING"],
      character_refs: ["Mara Vale"],
      required_research: ["SRC-MISSING"],
      profile_fields: {},
      ending_hook: "The file is gone",
      milestone_gate: null,
      target_words: 1200,
    }],
  }), "utf8");
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [],
    chapters: [{ chapter: 2, act: "act-1", causality: "therefore", state_change: "the archive closes", setup_ids: ["ST-PLOT-MISSING"], payoff_ids: [], profile_obligations: [] }],
    decisions: [],
  }), "utf8");

  return { parent, root };
}

test("project loading is active-book-only, numeric, manuscript-relative, contextual, and read-only", () => {
  const { parent, root } = projectFixture();
  try {
    const canonPath = join(root, "series", "canon.yaml");
    const before = readFileSync(canonPath, "utf8");
    const input = loadProseLintInput(root);

    assert.deepEqual(input.documents.map((document) => document.path), ["02-first.md", "02-second.md", "10-late.md"]);
    assert.deepEqual(input.documents.map((document) => document.order), [1, 2, 3]);
    assert.deepEqual(input.baselineMetrics, { not_x_but_y_rate_per_1000: 4, fragment_ratio: 0.08 });
    assert.equal(input.projectContext?.bookId, "book-01");
    assert.deepEqual(input.projectContext?.chapterFiles.map((chapter) => chapter.number), [2, 2, 10]);
    assert.deepEqual(input.projectContext?.canonIds, ["CAN-AGE", "CAN-AGE", "REL-001"]);
    assert.ok(input.projectContext?.canonNames.includes("Mara Vale"));
    assert.deepEqual(input.projectContext?.threadIds, ["ST-001"]);
    assert.deepEqual(input.projectContext?.sourceIds, ["SRC-001"]);
    assert.deepEqual(input.projectContext?.packetReferences, [
      { chapter: 2, kind: "canon", id: "CAN-MISSING" },
      { chapter: 2, kind: "thread", id: "ST-MISSING" },
      { chapter: 2, kind: "source", id: "SRC-MISSING" },
    ]);
    assert.deepEqual(input.projectContext?.plotThreadReferences, [{ chapter: 2, id: "ST-PLOT-MISSING" }]);
    assert.equal(readFileSync(canonPath, "utf8"), before);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("pure consistency rules classify structure, canon, references, spelling, and chronology", () => {
  const { parent, root } = projectFixture();
  try {
    const input = loadProseLintInput(root);
    const contextBefore = structuredClone(input.projectContext);
    const result = runProseLint({ ...input, rules: projectConsistencyRules });
    const findings = result.findings;

    assert.ok(findings.some((finding) => finding.ruleId === "consistency/chapter-sequence" && /Missing manuscript Chapter 1/.test(finding.message)));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/chapter-sequence" && /Duplicate manuscript Chapter 2/.test(finding.message) && finding.confidence === "high"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/spelling" && finding.evidence.pair === "color/colour"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/spelling" && finding.evidence.pair === "gray/grey"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/canon-name-case" && finding.location.path === "02-first.md"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/canon-number" && finding.evidence.canonId === "CAN-AGE" && finding.confidence === "medium"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/duplicate-id" && finding.evidence.id === "CAN-AGE"));
    for (const id of ["CAN-MISSING", "ST-MISSING", "SRC-MISSING", "ST-PLOT-MISSING"]) {
      assert.ok(findings.some((finding) => finding.ruleId === "consistency/missing-reference" && finding.evidence.id === id && finding.confidence === "high"), id);
    }
    const temporal = findings.find((finding) => finding.ruleId === "consistency/temporal-reference");
    assert.ok(temporal);
    assert.equal(temporal.confidence, "review");
    assert.match(temporal.reviewAction, /chronology/i);
    assert.deepEqual(input.projectContext, contextBefore);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("plain-directory loading recurses with repository exclusions and rejects empty or unreadable targets", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-prose-directory-"));
  try {
    mkdirSync(join(root, "nested"), { recursive: true });
    mkdirSync(join(root, "node_modules"), { recursive: true });
    mkdirSync(join(root, "legacy"), { recursive: true });
    writeFileSync(join(root, "10-last.md"), "Last.", "utf8");
    writeFileSync(join(root, "nested", "02-first.md"), "First.", "utf8");
    writeFileSync(join(root, "node_modules", "ignored.md"), "Ignored.", "utf8");
    writeFileSync(join(root, "legacy", "ignored.md"), "Ignored.", "utf8");

    const input = loadProseLintInput(root);
    assert.deepEqual(input.documents.map((document) => document.path), ["nested/02-first.md", "10-last.md"]);
    assert.equal(input.projectContext, undefined);
    assert.equal(input.baselineMetrics, undefined);

    const empty = mkdtempSync(join(tmpdir(), "novel-forge-prose-empty-"));
    try {
      assert.throws(() => loadProseLintInput(empty), /No Markdown files found/i);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
    assert.throws(() => loadProseLintInput(join(root, "missing")), /Cannot read prose-lint target/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
