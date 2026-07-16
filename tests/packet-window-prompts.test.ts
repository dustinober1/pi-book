import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queuePrompt } from "../src/application/prompts.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-packet-prompt-"));
  const root = initializeProject(parent, { projectName: "Packet Prompt", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "chapter-queue";
  project.next_gate = null;
  project.gates["book-plan-approval"] = "approved";
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const book = join(root, "books", "book-01");
  writeFileSync(join(book, "plot-grid.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    acts: [{ id: "I", purpose: "build", start_chapter: 1, end_chapter: 10, gate: null }],
    chapters: Array.from({ length: 10 }, (_, index) => ({ chapter: index + 1, act: "I", causality: "therefore", state_change: `state-${index + 1}`, setup_ids: [], payoff_ids: [], profile_obligations: [] })),
    decisions: [],
  }), "utf8");
  writeFileSync(join(book, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "rolling", packets: [{
    chapter: 6, title: "Six", status: "ready", pov: "Mara", purpose: "advance", scene_engine: "pursuit", pressure_movement: "rises", character_movement: "chooses", relationship_movement: "shifts", story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"], required_research: [], profile_fields: {}, ending_hook: "turn", milestone_gate: null, target_words: 1800,
  }] }), "utf8");
  for (let chapter = 1; chapter <= 5; chapter += 1) writeFileSync(join(book, "manuscript", "chapters", `${String(chapter).padStart(2, "0")}.md`), `# Chapter ${chapter}\n`, "utf8");
  return { parent, root };
}

test("queue prompt names only the bounded refill chapters and preserves the active packet", () => {
  const { parent, root } = setup();
  try {
    const prompt = queuePrompt(root);
    assert.match(prompt, /rolling|active window/i);
    assert.match(prompt, /chapters? 7, 8, 9, 10/i);
    assert.match(prompt, /preserve.*chapter 6/i);
    assert.doesNotMatch(prompt, /chapter 1|chapter 2|chapter 3|chapter 4|chapter 5/i);
    assert.doesNotMatch(prompt, /rebuild the entire|all chapter packets/i);
    assert.ok(prompt.length < 12000, `refill prompt grew unexpectedly: ${prompt.length}`);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("queue prompt performs no refill when two ready packets remain", () => {
  const { parent, root } = setup();
  try {
    const path = join(root, "books", "book-01", "chapter-queue.yaml");
    writeFileSync(path, stringifyYaml({ schema_version: "1.0.0", active_window: "rolling", packets: [6, 7].map((chapter) => ({
      chapter, title: String(chapter), status: "ready", pov: "Mara", purpose: "advance", scene_engine: `engine-${chapter}`, pressure_movement: "rises", character_movement: "chooses", relationship_movement: "shifts", story_thread_refs: [], continuity_refs: [], character_refs: ["Mara"], required_research: [], profile_fields: {}, ending_hook: "turn", milestone_gate: null, target_words: 1800,
    })) }), "utf8");
    const prompt = queuePrompt(root);
    assert.match(prompt, /no refill is required|two ready packets remain/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
