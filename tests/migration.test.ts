import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateGenesisProject } from "../src/migration/genesis-v0.4.js";
import { readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-migrate-")); }

test("Genesis migration preserves legacy files and manuscript chapters", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "PROJECT_STATE.yaml"), 'project_name: "Legacy Signal"\ncurrent_phase: "Phase 3: Drafting"\n', "utf8");
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(join(root, "artifacts", "voice-bible.md"), "# Voice Bible\n\nCompressed dialogue.", "utf8");
    writeFileSync(join(root, "artifacts", "05-outline.md"), "# Outline\n\nChapter 1 happens.", "utf8");
    mkdirSync(join(root, "manuscript", "chapters"), { recursive: true });
    writeFileSync(join(root, "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThe signal died.", "utf8");
    const result = migrateGenesisProject(root, "thriller");
    assert.equal(readProject(root).default_profile, "thriller");
    assert.ok(existsSync(join(root, "legacy", "genesis-v0.4", "PROJECT_STATE.yaml")));
    assert.ok(existsSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md")));
    assert.match(readFileSync(result.reportPath, "utf8"), /Required human review/);
    assert.match(readFileSync(join(root, "series", "voice-profile.md"), "utf8"), /Compressed dialogue/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Genesis migration accepts historical fiction and creates its guarded artifacts", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "PROJECT_STATE.yaml"), 'project_name: "Legacy Republic"\ncurrent_phase: "Phase 1"\n', "utf8");
    const result = migrateGenesisProject(root, "historical-fiction");
    assert.equal(readProject(root).default_profile, "historical-fiction");
    assert.equal(existsSync(join(result.root, "books/book-01/historical-context.yaml")), true);
    assert.equal(existsSync(join(result.root, "books/book-01/invention-ledger.yaml")), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
