import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readStoryRecordIndex,
  rebuildStoryRecordIndex,
} from "../src/application/rebuild-story-index.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-story-index-"));
  const root = initializeProject(parent, {
    projectName: "Story Index",
    projectType: "standalone",
    profile: "thriller",
  });
  writeFileSync(join(root, "series", "entity-registry.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    entities: [{
      id: "CHAR-MARA",
      category: "character",
      display_name: "Mara Vale",
      aliases: ["Mara"],
      status: "locked-canon",
      source: "series-bible",
      introduced_in: "book-01",
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "state-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    records: [{
      id: "STATE-MARA-LOCATION",
      subject_id: "CHAR-MARA",
      field: "location",
      value: "LOC-ARCHIVE",
      status: "current-state",
      source: "chapter-01",
      introduced_in: "chapter-01",
      updated_in: "chapter-01",
      evidence_ids: ["C01-P004"],
    }],
  }), "utf8");
  writeFileSync(join(root, "series", "knowledge-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    records: [{
      id: "KNOW-MARA-ACCESS",
      knower_id: "CHAR-MARA",
      fact_id: "FACT-ACCESS",
      knowledge: "known",
      status: "accepted-manuscript-fact",
      source: "chapter-01",
      introduced_in: "chapter-01",
      evidence_ids: ["C01-P004"],
    }],
  }), "utf8");
  return { parent, root };
}

test("deleting and rebuilding the story index produces byte-identical output", () => {
  const { parent, root } = setup();
  try {
    const first = rebuildStoryRecordIndex(root);
    const firstIndex = readFileSync(first.indexPath, "utf8");
    const firstManifest = readFileSync(first.manifestPath, "utf8");
    rmSync(join(root, ".pi-book", "index"), { recursive: true, force: true });
    const second = rebuildStoryRecordIndex(root);
    assert.equal(readFileSync(second.indexPath, "utf8"), firstIndex);
    assert.equal(readFileSync(second.manifestPath, "utf8"), firstManifest);
    assert.match(firstIndex, /CHAR-MARA/);
    assert.match(firstIndex, /STATE-MARA-LOCATION/);
    assert.match(firstIndex, /KNOW-MARA-ACCESS/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a source change makes the stored story index stale", () => {
  const { parent, root } = setup();
  try {
    rebuildStoryRecordIndex(root);
    const path = join(root, "series", "state-ledger.yaml");
    const current = readFileSync(path, "utf8");
    writeFileSync(path, current.replace("LOC-ARCHIVE", "LOC-ROOF"), "utf8");
    assert.throws(() => readStoryRecordIndex(root), /story record index is stale/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
