import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initializeProject } from "../src/project/store.js";
import { defaultResearchLedger, defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";
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
      characters: ["Mara Vale", "Mara Vale"],
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
    threads: [
      { id: "ST-001", type: "mystery", setup: "A vanished file", reader_knows: "It existed", characters_know: {}, status: "open", intended_payoff: null, last_advanced_in: null },
      { id: "ST-CLOSED", type: "mystery", setup: "A solved file", reader_knows: "It was solved", characters_know: {}, status: "paid-off", intended_payoff: "book-01", last_advanced_in: "book-01" },
      { id: "ST-ABANDONED", type: "mystery", setup: "A discarded lead", reader_knows: "It failed", characters_know: {}, status: "abandoned", intended_payoff: null, last_advanced_in: "book-01" },
    ],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    sources: [{ id: "SRC-001", type: "book", title: "Archives", location: "library", verified_on: null, supports: [], notes: "" }],
  }), "utf8");
  const research = defaultResearchLedger();
  research.items.push({
    id: "RES-001",
    lane: "story-world",
    claim: "",
    source_ids: [],
    confidence: "low",
    verified_on: null,
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    risk: [],
    dramatic_uses: [],
    story_use: { chapters: [2], decision_affected: "" },
    notes: "",
    status: "researching",
  });
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml(research), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "act-1",
    packets: [
      {
        chapter: 2,
        title: "Second",
        status: "ready",
        pov: "Mara",
        purpose: "investigate",
        scene_engine: "search",
        pressure_movement: "rises",
        character_movement: "commits",
        relationship_movement: "strains",
        story_thread_refs: ["ST-MISSING", "ST-CLOSED"],
        continuity_refs: ["CAN-MISSING"],
        character_refs: ["Mara Vale"],
        required_research: ["RES-001", "RES-MISSING", "SRC-001", "SRC-MISSING"],
        profile_fields: {},
        ending_hook: "The file is gone",
        milestone_gate: null,
        target_words: 1200,
      },
      {
        chapter: 10,
        title: "Later",
        status: "drafted",
        pov: "Mara",
        purpose: "close",
        scene_engine: "reveal",
        pressure_movement: "falls",
        character_movement: "accepts",
        relationship_movement: "stabilizes",
        story_thread_refs: ["ST-ABANDONED"],
        continuity_refs: [],
        character_refs: ["Mara Vale"],
        required_research: [],
        profile_fields: {},
        ending_hook: "The end",
        milestone_gate: null,
        target_words: 1200,
      },
    ],
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
    assert.deepEqual(input.projectContext?.relationships, [{ id: "REL-001", characters: ["Mara Vale", "Mara Vale"] }]);
    assert.deepEqual(input.projectContext?.threads, [
      { id: "ST-001", status: "open" },
      { id: "ST-CLOSED", status: "paid-off" },
      { id: "ST-ABANDONED", status: "abandoned" },
    ]);
    assert.deepEqual(input.projectContext?.threadIds, ["ST-001", "ST-CLOSED", "ST-ABANDONED"]);
    assert.deepEqual(input.projectContext?.sourceIds, ["SRC-001"]);
    assert.deepEqual(input.projectContext?.researchIds, ["RES-001"]);
    assert.deepEqual(input.projectContext?.packetReferences, [
      { chapter: 2, status: "ready", kind: "canon", id: "CAN-MISSING" },
      { chapter: 2, status: "ready", kind: "thread", id: "ST-MISSING" },
      { chapter: 2, status: "ready", kind: "thread", id: "ST-CLOSED" },
      { chapter: 2, status: "ready", kind: "source", id: "RES-001" },
      { chapter: 2, status: "ready", kind: "source", id: "RES-MISSING" },
      { chapter: 2, status: "ready", kind: "source", id: "SRC-001" },
      { chapter: 2, status: "ready", kind: "source", id: "SRC-MISSING" },
      { chapter: 10, status: "drafted", kind: "thread", id: "ST-ABANDONED" },
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
    for (const id of ["CAN-MISSING", "ST-MISSING", "RES-MISSING", "SRC-MISSING", "ST-PLOT-MISSING"]) {
      assert.ok(findings.some((finding) => finding.ruleId === "consistency/missing-reference" && finding.evidence.id === id && finding.confidence === "high"), id);
    }
    for (const id of ["RES-001", "SRC-001"]) {
      assert.equal(findings.some((finding) => finding.ruleId === "consistency/missing-reference" && finding.evidence.id === id), false, id);
    }
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/relationship-characters" && finding.evidence.relationshipId === "REL-001"));
    assert.ok(findings.some((finding) => finding.ruleId === "consistency/thread-status" && finding.evidence.id === "ST-CLOSED" && finding.evidence.packetStatus === "ready"));
    assert.equal(findings.some((finding) => finding.ruleId === "consistency/thread-status" && finding.evidence.id === "ST-ABANDONED"), false);
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
    assert.throws(() => loadProseLintInput(root, { scope: "act-1" }), /act scope.*project metadata/i);

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

function scopeFixture(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-prose-scope-"));
  const root = initializeProject(parent, {
    projectName: "Scope Fixture",
    projectType: "standalone",
    profile: "thriller",
  });
  const bookRoot = join(root, "books", "book-01");
  const chapterRoot = join(bookRoot, "manuscript", "chapters");
  for (const chapter of [1, 2, 3, 4]) {
    writeFileSync(join(chapterRoot, `${String(chapter).padStart(2, "0")}-chapter.md`), `# Chapter ${chapter}\n\nword${chapter} marker${chapter}.\n`, "utf8");
  }
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [
      { id: "act-1", purpose: "opening", start_chapter: 1, end_chapter: 2, gate: null },
      { id: "ACT-2", purpose: "ending", start_chapter: 3, end_chapter: 4, gate: null },
    ],
    chapters: [],
    decisions: [],
  }), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-2", packets: [] }), "utf8");
  return { parent, root };
}

test("project scope selects manuscript, explicit acts, and the active act without leaking unrelated chapters into metrics", () => {
  const { parent, root } = scopeFixture();
  try {
    const manuscript = loadProseLintInput(root, { scope: "manuscript" });
    assert.deepEqual(manuscript.documents.map((document) => document.path), ["01-chapter.md", "02-chapter.md", "03-chapter.md", "04-chapter.md"]);

    const firstAct = loadProseLintInput(root, { scope: "AcT-1" });
    assert.deepEqual(firstAct.documents.map((document) => document.path), ["01-chapter.md", "02-chapter.md"]);
    assert.equal(firstAct.documents.some((document) => document.text.includes("marker3") || document.text.includes("marker4")), false);
    assert.equal(runProseLint(firstAct).wordCount, firstAct.documents.reduce((total, document) => total + document.wordCount, 0));
    assert.ok(runProseLint(firstAct).wordCount < runProseLint(manuscript).wordCount);

    const activeAct = loadProseLintInput(root, { scope: "act" });
    assert.deepEqual(activeAct.documents.map((document) => document.path), ["03-chapter.md", "04-chapter.md"]);
    assert.throws(() => loadProseLintInput(root, { scope: "act-99" }), /Cannot resolve prose-lint act scope.*act-99/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("baseline metrics require accepted path, hash, and a nonempty metric set", () => {
  const { parent, root } = scopeFixture();
  try {
    writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
      ...defaultVoiceGuardrails(),
      baseline: { path: null, content_hash: null, metrics: { fragment_ratio: 0.5 } },
    }), "utf8");
    assert.equal(loadProseLintInput(root).baselineMetrics, undefined);

    writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
      ...defaultVoiceGuardrails(),
      baseline: { path: "accepted.md", content_hash: "b".repeat(64), metrics: {} },
    }), "utf8");
    assert.equal(loadProseLintInput(root).baselineMetrics, undefined);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
