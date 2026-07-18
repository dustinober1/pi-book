import assert from "node:assert/strict";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reviewPrompt } from "../src/application/prompts.js";
import { RUNTIME_PROFILES, type RuntimeProfileId } from "../src/domain/runtime-profile.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function reviewFixture(): { parent: string; root: string; bookRoot: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-prose-review-"));
  const root = initializeProject(parent, {
    projectName: "Prose Lint Review",
    projectType: "standalone",
    profile: "thriller",
  });
  const bookRoot = join(root, "books", "book-01");
  const chapterRoot = join(bookRoot, "manuscript", "chapters");
  writeFileSync(join(chapterRoot, "01-opening.md"), [
    "# Chapter One",
    "",
    "The lock lock clicked.",
    ...Array.from({ length: 20 }, (_, index) => `Mara heard signal${index} signal${index} again.`),
  ].join("\n"), "utf8");
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [{ id: "I", purpose: "opening", start_chapter: 1, end_chapter: 1, gate: null }],
    chapters: [],
    decisions: [],
  }), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    active_window: "Act I",
    packets: [],
  }), "utf8");
  return { parent, root, bookRoot };
}

function lintEvidence(prompt: string): string {
  const start = prompt.indexOf("## Deterministic prose-lint evidence");
  assert.notEqual(start, -1, "prompt did not contain prose-lint evidence");
  const standardEnd = prompt.indexOf("\n\n## Mandatory requirements", start);
  const compactEnd = prompt.indexOf("\nMUST:", start);
  const end = standardEnd >= 0 ? standardEnd : compactEnd;
  assert.notEqual(end, -1, "prompt did not contain the section after prose-lint evidence");
  return prompt.slice(start, end);
}

test("act and manuscript reviews receive exact bounded deterministic lint evidence", () => {
  const { parent, root } = reviewFixture();
  try {
    for (const scope of ["act", "act-1", "manuscript"]) {
      const prompt = reviewPrompt(root, scope);
      assert.match(prompt, /## Deterministic prose-lint evidence/i, scope);
      assert.match(prompt, /01-opening\.md:3 — mechanics\/doubled-word/i, scope);
      assert.match(prompt, /deterministic patterns do not establish authorship/i, scope);
      assert.match(prompt, /verify .*approved guardrails.*protected exceptions.*before .*ticket/i, scope);
      assert.match(prompt, /no style-pattern finding creates a ticket by itself/i, scope);
      assert.match(prompt, /every lint-derived ticket cites the exact manuscript location and confirmed problem/i, scope);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("chapter reviews do not run automatic prose lint", () => {
  const { parent, root } = reviewFixture();
  try {
    const prompt = reviewPrompt(root, "chapter");
    assert.doesNotMatch(prompt, /## Deterministic prose-lint evidence/i);
    assert.doesNotMatch(prompt, /Deterministic prose lint unavailable:/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("lint preparation failures remain visible and nonblocking", () => {
  const { parent, root, bookRoot } = reviewFixture();
  try {
    renameSync(join(bookRoot, "manuscript"), join(bookRoot, "manuscript-away"));
    const prompt = reviewPrompt(root, "manuscript");
    assert.match(prompt, /Deterministic prose lint unavailable: No Markdown files found for active book book-01/i);
    assert.match(prompt, /Continue normal manuscript and structured-integrity review/i);
    assert.match(prompt, /do not imply that the lint passed/i);
    assert.match(prompt, /review-report\.md/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("review lint evidence uses the resolved runtime budget", () => {
  const { parent, root } = reviewFixture();
  try {
    const caps: Record<RuntimeProfileId, number> = { full: 5_000, local: 1_400, "tiny-local": 700 };
    const lengths: Partial<Record<RuntimeProfileId, number>> = {};
    for (const id of ["full", "local", "tiny-local"] as const) {
      const prompt = reviewPrompt(root, "manuscript", RUNTIME_PROFILES[id]);
      const evidence = lintEvidence(prompt);
      lengths[id] = evidence.length;
      assert.ok(evidence.length <= caps[id], `${id} lint evidence exceeded ${caps[id]} characters`);
      assert.ok(prompt.length <= RUNTIME_PROFILES[id].maxPromptChars, `${id} prompt exceeded its runtime budget`);
      assert.match(prompt, /deterministic patterns do not establish authorship/i);
      assert.match(prompt, /no style-pattern finding creates a ticket by itself/i);
    }
    assert.ok(lengths.full! > lengths.local!, "full lint evidence should exceed local evidence");
    assert.ok(lengths.local! > lengths["tiny-local"]!, "local lint evidence should exceed tiny-local evidence");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
