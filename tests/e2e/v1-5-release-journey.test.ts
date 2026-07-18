import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { applyNovelEvent, projectStateHash } from "../../src/application/events.js";
import { buildPackageArtifacts } from "../../src/application/packaging/export.js";
import { bookPlanPrompt, reviewPrompt } from "../../src/application/prompts.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../../src/domain/historical-fiction.js";
import { parseYaml, stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../../src/project/store.js";

test("clean v1.5 historical project preserves evidence through planning research review and packaging", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-v15-journey-"));
  try {
    const root = initializeProject(parent, {
      projectName: "A Republic of Smoke",
      projectType: "planned-series",
      profile: "historical-fiction",
      targetWords: 100000,
    });
    const contextPath = join(root, "books/book-01/historical-context.yaml");
    const ledgerPath = join(root, "books/book-01/invention-ledger.yaml");
    assert.equal(existsSync(contextPath), true);
    assert.equal(existsSync(ledgerPath), true);
    assert.match(bookPlanPrompt(root), /historical-context\.yaml/);
    assert.match(reviewPrompt(root, "manuscript"), /anachronism/i);

    const context = parseYaml<HistoricalContext>(readFileSync(contextPath, "utf8"), HistoricalContextSchema, "historical-context.yaml");
    context.temporal_scope = "Paris, February through June 1848";
    context.geographic_scope = "Paris and the road to Rouen";
    context.calendar = "Gregorian display dates";
    const ledger = parseYaml<InventionLedger>(readFileSync(ledgerPath, "utf8"), InventionLedgerSchema, "invention-ledger.yaml");
    ledger.entries.push({
      id: "INV-001", claim: "A fictional courier crosses a private courtyard.", classification: "invented",
      risk: "low", source_ids: [], research_ids: [], rationale: "The household is fictional.",
      story_necessity: "The route avoids a documented barricade.", affected_chapters: [], portrayal_risks: [],
      continuity_risks: [], disclosure: "historical-note", writer_decision_id: null, major_counterfactual: false,
    });
    const before = projectStateHash(root);
    const updated = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "voice-intake",
      expectedProjectHash: before,
      files: [
        { path: "books/book-01/historical-context.yaml", content: stringifyYaml(context) },
        { path: "books/book-01/invention-ledger.yaml", content: stringifyYaml(ledger) },
      ],
    });
    assert.notEqual(updated.projectHash, before);
    assert.equal(readProject(root).current_stage, "voice-intake");

    writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "# Chapter 1\n\nThe barricade closes the road.\n", "utf8");
    const built = await buildPackageArtifacts(root, { preferPandoc: false });
    const note = built.changes.find((change) => change.path.endsWith("historical-note.md"));
    assert.ok(note && typeof note.content === "string");
    assert.match(note.content, /INV-001/);

    const releasePath = resolve("docs/releases/v1.5.0.md");
    assert.equal(existsSync(releasePath), true);
    const publicDocs = [
      readFileSync(resolve("README.md"), "utf8"),
      readFileSync(resolve("SKILL.md"), "utf8"),
      readFileSync(resolve("agents/openai.yaml"), "utf8"),
      readFileSync(releasePath, "utf8"),
    ].join("\n");
    assert.match(publicDocs, /historical-fiction/);
    assert.match(publicDocs, /Historical scene contract/);
    assert.match(publicDocs, /Historical Note/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
