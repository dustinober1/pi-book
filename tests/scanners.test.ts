import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

test("all eight legacy scanner entry points retain their titles and rule-family findings", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scanners-"));
  try {
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml({ schema_version: "1.0.0", project_name: "Scanner", project_type: "standalone", active_book: "book-01", default_profile: "thriller", current_stage: "drafting", next_gate: null, gates: {}, approvals: [], automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [] }), "utf8");
    mkdirSync(join(root, "series"), { recursive: true });
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [{ id: "CAN-AGE", category: "character", subject: "Mara", fact: "Mara is 41.", source: "book-01", status: "locked", introduced_in: "book-01" }], relationships: [] }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
    mkdirSync(join(root, "research"), { recursive: true });
    writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({ schema_version: "1.0.0", sources: [] }), "utf8");
    const bookRoot = join(root, "books", "book-01");
    mkdirSync(join(bookRoot, "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(bookRoot, "BOOK.yaml"), stringifyYaml({ schema_version: "1.0.0", book_id: "book-01", title: "Scanner", profile: "thriller", status: "drafting", current_chapter: 1, target_words: 1000, actual_words: 0, act_checkpoint: null, canon_locked: false }), "utf8");
    writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-1", packets: [{ chapter: 1, title: "Opening", status: "ready", pov: "Mara", purpose: "investigate", scene_engine: "search", pressure_movement: "rises", character_movement: "commits", relationship_movement: "strains", continuity_refs: ["CAN-MISSING"], story_thread_refs: ["ST-MISSING"], character_refs: ["Mara"], required_research: ["SRC-MISSING"], profile_fields: {}, ending_hook: "A clue appears", milestone_gate: null, target_words: 1000 }] }), "utf8");
    writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, act: "act-1", causality: "therefore", state_change: "Mara finds a clue", setup_ids: ["ST-MISSING"], payoff_ids: [], profile_obligations: [] }], decisions: [] }), "utf8");
    writeFileSync(join(bookRoot, "manuscript", "chapters", "01-opening.md"), [
      "# Opening",
      "",
      "The the lantern left Mara at 42, tomorrow the color and colour would change.",
      "The copper moon rose above the station.",
      "The copper moon rose above the station.",
      "The copper moon rose above the station.",
      "The copper moon rose above the station.",
      ...Array.from({ length: 4 }, () => "It was not fear but focus."),
    ].join("\n\n"), "utf8");
    writeFileSync(join(bookRoot, "manuscript", "chapters", "02-filler.md"), `${Array.from({ length: 2_000 }, (_, index) => `word${index}`).join(" ")}.\n`, "utf8");
    const scripts: Array<[string, string, RegExp, string[], RegExp]> = [
      ["ngram-audit.mjs", "Novel Forge n-gram audit", /repetition\/ngram/, ["Repeated phrases for review"], /- “.+” — \d+ uses across \d+ file\(s\)/],
      ["rhetorical-pattern-audit.mjs", "Novel Forge rhetorical-pattern audit", /style-pattern\/not-x-but-y/, ["Pattern counts"], /- .+: not X but Y × \d+/],
      ["continuity-scan.mjs", "Novel Forge continuity scan", /consistency\/canon-number/, ["Potential conflicts"], /- .+ \/ CAN-AGE: possible numeric divergence near “.+”/],
      ["integrity-audit.mjs", "Novel Forge structured-integrity audit", /consistency\/missing-reference/, ["Integrity findings"], /- Chapter 1 references missing canon CAN-MISSING\./],
      ["structure-audit.mjs", "Novel Forge structure audit", /consistency\/chapter-structure/, ["Manuscript summary", "Structural review flags"], /- 2 chapter file\(s\), \d+ words/],
      ["spelling-consistency-audit.mjs", "Novel Forge spelling-consistency audit", /consistency\/spelling/, ["Mixed-system findings"], /- color\/colour mixed — US in .+; UK in .+/],
      ["temporal-reference-audit.mjs", "Novel Forge temporal-reference audit", /consistency\/temporal-reference/, ["References requiring chronology review"], /- .+:\d+ — tomorrow — .+/],
      ["copy-mechanics-audit.mjs", "Novel Forge copy-mechanics audit", /mechanics\/doubled-word/, ["Mechanical findings"], /- .+:\d+ — doubled word — .+/],
    ];
    for (const [script, title, finding, sections, summary] of scripts) {
      const output = execFileSync("node", [resolve("scripts", script), root], { cwd: process.cwd() }).toString();
      assert.match(output, new RegExp(`^# ${title}$`, "m"));
      assert.match(output, finding);
      assert.deepEqual([...output.matchAll(/^## (.+)$/gm)].map((match) => match[1]), sections, script);
      assert.match(output, summary, script);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the direct n-gram scanner accepts --min-count and applies the legacy threshold", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-ngram-threshold-"));
  try {
    writeFileSync(join(root, "01.md"), "Copper moon rising.\n\nCopper moon falling.\n", "utf8");
    const script = resolve("scripts/ngram-audit.mjs");
    const two = execFileSync("node", [script, root, "--min-count", "2"], { cwd: process.cwd(), encoding: "utf8" });
    const three = execFileSync("node", [script, root, "--min-count", "3"], { cwd: process.cwd(), encoding: "utf8" });

    assert.match(two, /“copper moon” — 2 uses across 1 file\(s\)/);
    assert.match(three, /^## Repeated phrases for review\n\n- none$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an absolute legacy scanner path runs from an unrelated working directory", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scanner-absolute-"));
  const unrelated = mkdtempSync(join(tmpdir(), "novel-forge-unrelated-cwd-"));
  try {
    const project = initializeProject(parent, { projectName: "Absolute Scanner", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(project, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThe copper moon rose.\n", "utf8");
    const result = spawnSync("node", [resolve("scripts/ngram-audit.mjs"), project], {
      cwd: unrelated,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Novel Forge n-gram audit$/m);
  } finally {
    rmSync(parent, { recursive: true, force: true });
    rmSync(unrelated, { recursive: true, force: true });
  }
});

test("a mechanics-only legacy scanner ignores malformed unrelated canonical artifacts", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-scanner-filtered-"));
  try {
    const project = initializeProject(parent, { projectName: "Filtered Scanner", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(project, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThe the lantern failed.\n", "utf8");
    writeFileSync(join(project, "series", "canon.yaml"), "facts: [this is not valid", "utf8");

    const result = spawnSync("node", [resolve("scripts/copy-mechanics-audit.mjs"), project], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /mechanics\/doubled-word/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
