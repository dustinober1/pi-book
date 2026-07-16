import test from "node:test";
import assert from "node:assert/strict";
import { gateEvidencePaths } from "../src/application/gate-metadata.js";
import type { ProjectState } from "../src/domain/schemas.js";

const project: ProjectState = {
  schema_version: "1.0.0", novel_forge_version: "1.3.0", project_name: "Gate Evidence", project_type: "standalone",
  active_book: "book-01", default_profile: "thriller", current_stage: "act-review", next_gate: "act-1-review",
  gates: { "act-1-review": "pending" }, approvals: [],
  automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: true }, migration_history: [],
};

test("review gates include voice audits as evidence", () => {
  for (const gate of ["act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-approval"]) {
    assert.ok(gateEvidencePaths(project, gate).includes("books/book-01/voice-audits.yaml"));
  }
});
