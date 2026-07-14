import test from "node:test";
import assert from "node:assert/strict";
import { ProjectSchema, assertSchema, type ProjectState } from "../src/domain/schemas.js";
const valid: ProjectState = { schema_version: "1.0.0", project_name: "Test", project_type: "standalone", active_book: "book-01", default_profile: "thriller", current_stage: "voice-intake", next_gate: "voice-approval", gates: { "voice-approval": "open" }, approvals: [], automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: false }, migration_history: [] };
test("project schema accepts the canonical state", () => { assert.doesNotThrow(() => assertSchema(ProjectSchema, valid, "project")); });
test("project schema rejects unknown versions and invalid book ids", () => { assert.throws(() => assertSchema(ProjectSchema, { ...valid, schema_version: "0.4.0", active_book: "one" }, "project"), /schema validation/); });
