import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draftPrompt, reviewPrompt } from "../src/application/prompts.js";
import type { ChapterContext } from "../src/context/context-builder.js";
import { initializeProject } from "../src/project/store.js";

test("review prompt treats voice metrics as evidence and requires writer approval for learning rules", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-prompts-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 5 Prompts", projectType: "standalone", profile: "thriller" });
    const prompt = reviewPrompt(root, "act");
    assert.match(prompt, /voice metrics are evidence/i);
    assert.match(prompt, /scene engine/i);
    assert.match(prompt, /three distinct chapters|two milestone reviews/i);
    assert.match(prompt, /explicitly approve|writer approval/i);
    assert.match(prompt, /do not rewrite|no retroactive/i);
    assert.match(prompt, /deterministic patterns do not establish authorship/i);
    assert.match(prompt, /no style-pattern finding creates a ticket by itself/i);
    assert.match(prompt, /exact manuscript location and confirmed problem/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("draft prompt does not turn audit metrics into prescriptive prose targets", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-draft-prompt-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 5 Draft Prompt", projectType: "standalone", profile: "thriller" });
    const context: ChapterContext = {
      root,
      bookId: "book-01",
      packet: {
        chapter: 2, title: "Two", status: "ready", pov: "Mara", purpose: "advance", scene_engine: "search",
        pressure_movement: "rises", character_movement: "commits", relationship_movement: "shifts", story_thread_refs: [],
        continuity_refs: [], character_refs: ["Mara"], required_research: [], profile_fields: {}, ending_hook: "hook", milestone_gate: null, target_words: 1500,
      },
      text: "# Drafting Context",
      report: {
        estimatedTokens: 10,
        included: [],
        excluded: [],
        allocation: { characters: 0, includedRecordIds: [], omittedRecordIds: [], sections: [] },
        graph: { maxDepth: 2, selections: [], blocked: [] },
      },
    };
    const prompt = draftPrompt(context);
    assert.doesNotMatch(prompt, /hit (?:a )?dialogue ratio|target (?:a )?sentence average|must achieve (?:a )?dialogue ratio/i);
    assert.match(prompt, /do not .*metrics.*quotas/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
