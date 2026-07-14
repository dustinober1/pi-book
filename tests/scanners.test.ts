import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";

test("all eight deterministic scanner entry points execute and integrity flags broken references", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scanners-"));
  try {
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml({ schema_version: "1.0.0", project_name: "Scanner", project_type: "standalone", active_book: "book-01", default_profile: "thriller", current_stage: "drafting", next_gate: null, gates: {}, approvals: [], automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [] }), "utf8");
    mkdirSync(join(root, "series"), { recursive: true });
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({ schema_version: "1.0.0", threads: [] }), "utf8");
    mkdirSync(join(root, "research"), { recursive: true });
    writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({ schema_version: "1.0.0", sources: [] }), "utf8");
    const bookRoot = join(root, "books", "book-01");
    mkdirSync(join(bookRoot, "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml({ schema_version: "1.0.0", active_window: "act-1", packets: [{ chapter: 1, status: "ready", continuity_refs: ["CAN-MISSING"], story_thread_refs: ["ST-MISSING"], required_research: ["SRC-MISSING"] }] }), "utf8");
    writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [{ chapter: 1, setup_ids: ["ST-MISSING"], payoff_ids: [] }] }), "utf8");
    writeFileSync(join(bookRoot, "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThere it was. There it was again. tomorrow the color would change.", "utf8");
    const scripts = ["ngram-audit.mjs", "rhetorical-pattern-audit.mjs", "continuity-scan.mjs", "integrity-audit.mjs", "structure-audit.mjs", "spelling-consistency-audit.mjs", "temporal-reference-audit.mjs", "copy-mechanics-audit.mjs"];
    for (const script of scripts) {
      const output = execFileSync("node", [resolve("scripts", script), root], { cwd: process.cwd() }).toString();
      assert.match(output, /# Novel Forge/);
      if (script === "integrity-audit.mjs") assert.match(output, /CAN-MISSING|ST-MISSING|SRC-MISSING/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
