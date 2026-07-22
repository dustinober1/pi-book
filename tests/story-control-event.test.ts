import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function setup(stage: "series-planning" | "drafting") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-story-control-event-"));
  const root = initializeProject(parent, { projectName: "Story Control Event", projectType: "planned-series", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = stage;
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  return { parent, root };
}

function text(root: string, relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

test("series planning may update all canonical story controls in one guarded event", () => {
  const { parent, root } = setup("series-planning");
  try {
    const files = [
      { path: "series/series-bible.md", content: text(root, "series/series-bible.md") },
      { path: "series/series-arc.yaml", content: text(root, "series/series-arc.yaml") },
      { path: "series/canon.yaml", content: text(root, "series/canon.yaml") },
      { path: "series/story-threads.yaml", content: text(root, "series/story-threads.yaml") },
      { path: "series/entity-registry.yaml", content: stringifyYaml({
        schema_version: "1.0.0",
        entities: [{
          id: "CHAR-MARA",
          category: "character",
          display_name: "Mara Vale",
          aliases: ["Mara"],
          status: "current-state",
          source: "author-interview",
          introduced_in: "series-plan",
        }],
      }) },
      { path: "series/state-ledger.yaml", content: stringifyYaml({
        schema_version: "1.0.0",
        records: [{
          id: "STATE-MARA-LOCATION",
          subject_id: "CHAR-MARA",
          field: "location",
          value: "LOC-ARCHIVE",
          status: "current-state",
          source: "author-interview",
          introduced_in: "series-plan",
          updated_in: "series-plan",
          evidence_ids: [],
        }],
      }) },
      { path: "series/knowledge-ledger.yaml", content: stringifyYaml({
        schema_version: "1.0.0",
        records: [{
          id: "KNOW-MARA-ARCHIVE",
          knower_id: "CHAR-MARA",
          fact_id: "FACT-ARCHIVE-EXISTS",
          knowledge: "known",
          status: "current-state",
          source: "author-interview",
          introduced_in: "series-plan",
          evidence_ids: [],
        }],
      }) },
    ];
    const result = applyNovelEvent(root, {
      eventType: "series-plan",
      expectedStage: "series-planning",
      expectedProjectHash: projectStateHash(root),
      files,
    });
    assert.equal(result.stage, "book-planning");
    assert.ok(result.changed.includes("series/entity-registry.yaml"));
    assert.ok(result.changed.includes("series/state-ledger.yaml"));
    assert.ok(result.changed.includes("series/knowledge-ledger.yaml"));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("drafting cannot directly mutate canonical story controls", () => {
  const { parent, root } = setup("drafting");
  try {
    assert.throws(() => applyNovelEvent(root, {
      eventType: "draft-chapter",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      chapter: 1,
      files: [{ path: "series/state-ledger.yaml", content: text(root, "series/state-ledger.yaml") }],
    }), /not allowed/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
