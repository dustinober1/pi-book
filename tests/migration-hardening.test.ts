import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanonSchema, RevisionTicketsSchema, StoryThreadsSchema } from "../src/domain/schemas.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { migrateGenesisProject } from "../src/migration/genesis-v0.4.js";

function legacyRoot(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-migrate-hard-"));
  const root = join(parent, "legacy"); mkdirSync(join(root, "artifacts"), { recursive: true }); mkdirSync(join(root, "manuscript", "chapters"), { recursive: true });
  writeFileSync(join(root, "PROJECT_STATE.yaml"), 'project_name: "Legacy"\ncurrent_phase: "Phase 3: Drafting"\n', "utf8");
  writeFileSync(join(root, "ASSUMPTIONS.md"), "# Assumptions\n", "utf8");
  writeFileSync(join(root, "artifacts", "continuity-ledger.md"), "# Continuity\n- Mara is twenty-eight.\n- The silver key remains with Kael.\n", "utf8");
  writeFileSync(join(root, "artifacts", "reader-promise-tracker.md"), "# Promises\n- Reveal who betrayed the eastern ward.\n", "utf8");
  writeFileSync(join(root, "artifacts", "revision-tickets.md"), "# Tickets\n- HIGH: Chapter 3 repeats the same confrontation.\n", "utf8");
  writeFileSync(join(root, "manuscript", "chapters", "01-opening.md"), "# Opening\n\nLegacy text.", "utf8");
  return { parent, root };
}

test("migration dry-run writes nothing and actual migration creates structured candidates with checksums", () => {
  const { parent, root } = legacyRoot();
  try {
    const dry = migrateGenesisProject(root, "romantasy", { dryRun: true });
    assert.equal(existsSync(join(root, "PROJECT.yaml")), false);
    assert.match(dry.report, /canon candidate|story-thread candidate|ticket candidate/i);

    const result = migrateGenesisProject(root, "romantasy");
    const canon = parseYaml(readFileSync(join(root, "series", "canon.yaml"), "utf8"), CanonSchema, "canon");
    const threads = parseYaml(readFileSync(join(root, "series", "story-threads.yaml"), "utf8"), StoryThreadsSchema, "threads");
    const tickets = parseYaml(readFileSync(join(root, "books", "book-01", "revision-tickets.yaml"), "utf8"), RevisionTicketsSchema, "tickets");
    assert.ok(canon.facts.length >= 2);
    assert.ok(threads.threads.length >= 1);
    assert.ok(tickets.tickets.length >= 1);
    assert.match(result.report, /sha256/i);
    assert.throws(() => migrateGenesisProject(root, "romantasy"), /already|idempot/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("migration detects a Genesis series workspace instead of flattening it", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-series-migrate-"));
  try {
    writeFileSync(join(parent, "SERIES_STATE.yaml"), "series: legacy\n", "utf8");
    mkdirSync(join(parent, "books", "book-01"), { recursive: true });
    writeFileSync(join(parent, "books", "book-01", "PROJECT_STATE.yaml"), "project_name: one\n", "utf8");
    assert.throws(() => migrateGenesisProject(parent, "thriller", { dryRun: true }), /series workspace|multiple books/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
