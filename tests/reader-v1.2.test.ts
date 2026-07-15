import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReaderKit } from "../src/application/readers/kit.js";
import { previewReaderImport } from "../src/application/readers/csv.js";
import { mergeReaderImport } from "../src/application/readers/merge.js";
import { migrateReaderEvidenceV1ToV2 } from "../src/application/readers/migrate.js";
import { readReaderExperiment, readerCsvHeaders } from "../src/application/readers/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-reader-v12-")); }
function legacyResponse(reader: string) {
  return { reader_id: reader, source: "human", segment: "core", recorded_at: "2026-07-14T12:00:00Z", continued_reading: true, would_buy: true, confusions: ["one confusion"], trust_breaks: [], lines_that_worked: ["clean signal"], remembered_hook: "the warning", remembered_moments: ["the cutoff"], friend_description: "institutional conspiracy", disagreement_question: "who authorized it", lingering_question: "will they fire", recommendation_target: "thriller readers", recommendation_reason: "specific pressure", told_someone: true } as const;
}

test("v1.1 reader migration preserves evidence and original files", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Migration", projectType: "standalone", profile: "thriller" });
    const legacy = { schema_version: "1.0.0", experiments: [{ id: "RE-001", status: "complete", scope: "first-chapter", variant: "", blind: false, target_reader: "core", sample_path: "books/book-01/reader-kit/sample.md", minimum_reader_count: 1, immediate_responses: [legacyResponse("R-001")], delayed_after_hours: 48, delayed_responses: [legacyResponse("R-001")], metrics: { continuation_rate: 1, purchase_intent_rate: 1, delayed_hook_recall_rate: 1, signature_moment_recall_rate: 1, specific_recommendation_rate: 1, talkability_rate: 1 }, verdict: "validated", next_action: "review" }] };
    const legacyPath = join(root, "books/book-01/reader-experiments.yaml");
    const text = stringifyYaml(legacy);
    writeFileSync(legacyPath, text, "utf8");
    const originalHash = createHash("sha256").update(readFileSync(legacyPath)).digest("hex");
    const result = migrateReaderEvidenceV1ToV2(root);
    assert.deepEqual(result.migratedIds, ["RE-001"]);
    const migrated = readReaderExperiment(root, "book-01", "RE-001");
    assert.equal(migrated.immediate_responses[0]?.reader_id, "R-001");
    assert.deepEqual(migrated.metrics, legacy.experiments[0]!.metrics);
    assert.equal(migrated.verdict, "validated");
    assert.equal(createHash("sha256").update(readFileSync(legacyPath)).digest("hex"), originalHash);
    assert.deepEqual(migrateReaderEvidenceV1ToV2(root).migratedIds, []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("CSV preview and merge accept paired humans and require explicit conflict decisions", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Reader Merge", projectType: "standalone", profile: "thriller" });
    writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), `# Chapter 1\n\n${"signal ".repeat(1000)}`, "utf8");
    const kit = createReaderKit(root, { scope: "first-page", targetReader: "core", minimumImmediateCount: 1, minimumDelayedCount: 1, delayedAfterHours: 48 });
    const immediate = ["1.0.0", kit.experimentId, "1.0.0", "immediate", "R-001", "human", "core", "2026-07-14T12:00:00Z", "true", "true", "one confusion", "", "line", "", "", "", "", "", "", "", ""].join(",");
    const delayed = ["1.0.0", kit.experimentId, "1.0.0", "delayed", "R-001", "human", "core", "2026-07-16T12:00:00Z", "", "", "", "", "", "clean signal", "cutoff", "institutional conspiracy", "who authorized it", "will they fire", "thriller readers", "specific pressure", "true"].join(",");
    const csv = `${readerCsvHeaders.join(",")}\n${immediate}\n${delayed}\n`;
    const preview = previewReaderImport(root, "book-01", kit.experimentId, csv);
    assert.equal(preview.counts.new, 2);
    const merged = await mergeReaderImport(root, "book-01", preview, { decisions: {} });
    assert.equal(merged.experiment.verdict, "promising");
    assert.equal(merged.experiment.metrics.continuation_rate, 1);
    assert.equal(existsSync(join(root, `books/book-01/reader-kits/${kit.experimentId}/reader-summary.xlsx`)), true);

    const changedImmediate = immediate.replace(",true,true,one confusion,", ",false,true,one confusion,");
    const conflict = previewReaderImport(root, "book-01", kit.experimentId, `${readerCsvHeaders.join(",")}\n${changedImmediate}\n`);
    assert.equal(conflict.counts.conflict, 1);
    await assert.rejects(() => mergeReaderImport(root, "book-01", conflict, { decisions: {} }), /conflict decision is required/i);
    const replaced = await mergeReaderImport(root, "book-01", conflict, { decisions: { "immediate:R-001": "use-imported" } });
    assert.equal(replaced.experiment.immediate_responses[0]?.continued_reading, false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
