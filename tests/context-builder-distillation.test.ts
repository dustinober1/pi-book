import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture, researchFixture, sourcesFixture } from "./phase4-fixtures.js";

function setup(parent: string): string {
  const root = initializeProject(parent, { projectName: "Distilled Context", projectType: "standalone", profile: "thriller", runtimeProfile: "tiny-local" });
  const bookRoot = join(root, "books", "book-01");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "fact", subject: "Mara", fact: "Mara has archive access", source: "chapter-01", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "missing log", reader_knows: "little", characters_know: { Mara: "missing" }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(bookRoot, "book-strategy.yaml"), stringifyYaml(completeStrategy()), "utf8");
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml(queueFixture()), "utf8");
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml(researchFixture()), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml(sourcesFixture()), "utf8");
  return root;
}

test("tiny-local chapter context reports distillation and reuses exact cache products", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-distilled-context-"));
  try {
    const root = setup(parent);
    const first = buildChapterContext(root, 2, 12_000, 1, "tiny-local");
    assert.ok(first.text.length <= 12_000);
    assert.ok(first.report.build);
    assert.ok(first.report.cache);
    assert.equal(first.report.build.schemaVersion, "1.0.0");
    assert.equal(first.report.build.profileId, "tiny-local");
    assert.equal(first.report.cache.status, "miss");
    assert.ok(first.report.build.sections.some((section) => section.status === "compacted" || section.status === "omitted"));

    const second = buildChapterContext(root, 2, 12_000, 1, "tiny-local");
    assert.ok(second.report.cache);
    assert.equal(second.report.cache.status, "hit");
    assert.equal(second.text, first.text);

    const canonPath = join(root, "series", "canon.yaml");
    writeFileSync(canonPath, `${readFileSync(canonPath, "utf8")}\n`, "utf8");
    const third = buildChapterContext(root, 2, 12_000, 1, "tiny-local");
    assert.ok(third.report.cache);
    assert.equal(third.report.cache.status, "miss");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
