import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";

test("all seven deterministic scanner entry points execute on a Novel Forge project", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-scanners-"));
  try {
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml({
      schema_version: "1.0.0", project_name: "Scanner", project_type: "standalone", active_book: "book-01",
      default_profile: "thriller", current_stage: "drafting", next_gate: null, gates: {},
      automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [],
    }), "utf8");
    mkdirSync(join(root, "series"), { recursive: true });
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }), "utf8");
    mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThere it was. There it was again. tomorrow the color would change.", "utf8");
    const scripts = [
      "ngram-audit.mjs", "rhetorical-pattern-audit.mjs", "continuity-scan.mjs", "structure-audit.mjs",
      "spelling-consistency-audit.mjs", "temporal-reference-audit.mjs", "copy-mechanics-audit.mjs",
    ];
    for (const script of scripts) {
      const output = execFileSync("node", [resolve("scripts", script), root], { cwd: process.cwd() }).toString();
      assert.match(output, /# Novel Forge/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
