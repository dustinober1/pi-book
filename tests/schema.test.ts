import test from "node:test";
import assert from "node:assert/strict";
import { GenreConfigSchema, ProjectSchema, assertSchema, type GenreConfig, type ProjectState } from "../src/domain/schemas.js";
import { ProjectV14Schema, type ProjectStateV14 } from "../src/domain/v1-4-project-schema.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import {
  HistoricalContextSchema,
  InventionLedgerSchema,
  type HistoricalContext,
  type InventionLedger,
} from "../src/domain/historical-fiction.js";
import { bookTemplateFiles, projectTemplateFiles } from "../src/project/templates.js";

const valid: ProjectState = { schema_version: "1.0.0", project_name: "Test", project_type: "standalone", active_book: "book-01", default_profile: "thriller", current_stage: "voice-intake", next_gate: "voice-approval", gates: { "voice-approval": "open" }, approvals: [], automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [] };

test("project schema accepts the canonical state", () => { assert.doesNotThrow(() => assertSchema(ProjectSchema, valid, "project")); });
test("project schema rejects unknown versions and invalid book ids", () => { assert.throws(() => assertSchema(ProjectSchema, { ...valid, schema_version: "0.4.0", active_book: "one" }, "project"), /schema validation/); });
test("newly created project and genre templates match the current schemas", () => {
  const files = projectTemplateFiles({ projectName: "Test", projectType: "standalone", profile: "thriller" });
  const project = parseYaml<ProjectStateV14>(files["PROJECT.yaml"]!, ProjectV14Schema, "template PROJECT.yaml");
  const genre = parseYaml<GenreConfig>(files["books/book-01/genre.yaml"]!, GenreConfigSchema, "template genre.yaml");
  assert.equal(project.approvals.length, 0);
  assert.equal(project.gates["voice-approval"], "open");
  assert.equal(genre.profile, "thriller");
  assert.equal(genre.settings["thriller_type"], "techno");
});

test("newly created historical-fiction artifacts match the v1.5 schemas", () => {
  const files = bookTemplateFiles("book-01", 1, "historical-fiction");
  const context = parseYaml<HistoricalContext>(files["books/book-01/historical-context.yaml"]!, HistoricalContextSchema, "template historical-context.yaml");
  const ledger = parseYaml<InventionLedger>(files["books/book-01/invention-ledger.yaml"]!, InventionLedgerSchema, "template invention-ledger.yaml");
  assert.equal(context.book_id, "book-01");
  assert.equal(ledger.book_id, "book-01");
});
