import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildProjectRepetitionMemory,
  repetitionMemoryIsStale,
} from "../src/application/repetition-memory.js";
import { compileProjectStyleCard } from "../src/application/style-card-compiler.js";
import {
  readRepetitionMemory,
  repetitionMemoryPath,
  writeRepetitionMemory,
} from "../src/infrastructure/repetition-memory-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-repetition-memory-"));
  const root = initializeProject(parent, {
    projectName: "Repetition Memory",
    projectType: "standalone",
    profile: "thriller",
  });
  writeFileSync(join(root, "series", "voice-profile.md"), `# Voice Profile

## POV distance

Close third-person.

## Narrative tense

Past tense.

## Sentence and paragraph behavior

Vary sentence length naturally.

## Dialogue behavior

Keep dialogue compressed.

## Positive voice evidence

Evidence changes interpretation.
`, "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    must: ["Keep cause and effect legible."],
    prefer: ["Use concrete detail."],
    avoid: ["Avoid repeated gestures."],
    monitor: ["Monitor repeated sentence openings."],
    baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{ id: "POV-MARA", pov: "CHAR-MARA", must: ["Keep Mara analytical."], prefer: [], avoid: [] }],
  }), "utf8");
  const chapterRoot = join(root, "books", "book-01", "manuscript", "chapters");
  writeFileSync(join(chapterRoot, "01-old.md"), "Old material old material old material. This chapter is outside the recent window.\n", "utf8");
  writeFileSync(join(chapterRoot, "02-recent.md"), `# Chapter 2

Mara checked the door before she checked the clock. Her jaw tightened when the panel stayed dark. "We move now," she said.

A moment later, silence stretched across the corridor. Mara checked the door again.
`, "utf8");
  writeFileSync(join(chapterRoot, "03-recent.md"), `# Chapter 3

Mara checked the door before she checked the camera. Her jaw tightened when the light changed. "We move now," she said.

A moment later, silence stretched between them. Mara checked the door again.
`, "utf8");
  writeFileSync(join(chapterRoot, "04-recent.md"), `# Chapter 4

Mara checked the door before she checked the feed. Her jaw tightened when the lock cycled. "We move now," she said.

A moment later, silence stretched in the stairwell. Mara checked the door again.
`, "utf8");
  return { parent, root };
}

test("recent repetition memory extracts compact patterns without retaining paragraphs", () => {
  const { parent, root } = setup();
  try {
    const memory = buildProjectRepetitionMemory(root, { recentChapterCount: 3 });
    assert.deepEqual(memory.recent_chapters, [2, 3, 4]);
    assert.ok(memory.patterns.some((pattern) => pattern.category === "sentence-opening" && /mara checked the/i.test(pattern.text)));
    assert.ok(memory.patterns.some((pattern) => pattern.category === "gesture" && /jaw tightened/i.test(pattern.text)));
    assert.ok(memory.patterns.some((pattern) => pattern.category === "transition" && /a moment later/i.test(pattern.text)));
    assert.ok(memory.patterns.some((pattern) => pattern.category === "verbal-tic" && /we move now/i.test(pattern.text)));
    assert.ok(memory.patterns.every((pattern) => pattern.snippets.length <= 2));
    assert.ok(memory.patterns.flatMap((pattern) => pattern.snippets).every((snippet) => snippet.length <= 80));
    assert.ok(memory.avoid_list.length <= 8);
    assert.doesNotMatch(JSON.stringify(memory), /outside the recent window/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("repetition memory persists non-canonically and detects recent manuscript changes", () => {
  const { parent, root } = setup();
  try {
    const memory = buildProjectRepetitionMemory(root, { recentChapterCount: 3 });
    const path = writeRepetitionMemory(root, memory);
    assert.equal(path, repetitionMemoryPath(root, memory.memory_id));
    assert.deepEqual(readRepetitionMemory(root, memory.memory_id), memory);
    assert.equal(repetitionMemoryIsStale(root, memory), false);

    const chapterPath = join(root, "books", "book-01", "manuscript", "chapters", "04-recent.md");
    writeFileSync(chapterPath, `${readFileSync(chapterPath, "utf8")}\nMara checked the door once more.\n`, "utf8");
    assert.equal(repetitionMemoryIsStale(root, memory), true);
    assert.notEqual(buildProjectRepetitionMemory(root, { recentChapterCount: 3 }).memory_id, memory.memory_id);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("project style cards automatically include recent repetition warnings", () => {
  const { parent, root } = setup();
  try {
    const card = compileProjectStyleCard(root, "CHAR-MARA", { repetitionChapterLimit: 3 });
    assert.ok(card.recent_patterns_to_avoid.some((pattern) => /mara checked the/i.test(pattern)));
    assert.ok(card.recent_patterns_to_avoid.some((pattern) => /jaw tightened/i.test(pattern)));
    assert.ok(card.source_hashes.some((source) => /04-recent\.md$/.test(source.path)));
    assert.ok(card.recent_patterns_to_avoid.length <= 8);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
