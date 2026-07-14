import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GenreConfigSchema, ProjectSchema, assertSchema, type GenreConfig, type ProjectState } from "../src/domain/schemas.js";
import { parseYaml } from "../src/infrastructure/yaml.js";

const valid: ProjectState = { schema_version: "1.0.0", project_name: "Test", project_type: "standalone", active_book: "book-01", default_profile: "thriller", current_stage: "voice-intake", next_gate: "voice-approval", gates: { "voice-approval": "open" }, approvals: [], automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [] };

test("project schema accepts the canonical state", () => { assert.doesNotThrow(() => assertSchema(ProjectSchema, valid, "project")); });
test("project schema rejects unknown versions and invalid book ids", () => { assert.throws(() => assertSchema(ProjectSchema, { ...valid, schema_version: "0.4.0", active_book: "one" }, "project"), /schema validation/); });
test("packaged project and genre templates match the current schemas", () => {
  const projectText = readFileSync(resolve("references/templates/novel/PROJECT.yaml"), "utf8");
  const genreText = readFileSync(resolve("references/templates/novel/genre.yaml"), "utf8");
  const project = parseYaml<ProjectState>(projectText, ProjectSchema, "template PROJECT.yaml");
  const genre = parseYaml<GenreConfig>(genreText, GenreConfigSchema, "template genre.yaml");
  assert.equal(project.approvals.length, 0);
  assert.equal(project.gates["voice-approval"], "open");
  assert.equal(genre.profile, "thriller");
  assert.equal(genre.settings["thriller_type"], "techno");
});
