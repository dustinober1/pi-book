import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStateHash } from "../src/application/project-hash.js";
import { createResearchWizardHandler } from "../src/application/research/wizard.js";
import { buildChapterContext } from "../src/context/context-builder.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, completeStrategy, queueFixture } from "./phase4-fixtures.js";

function readyItem(id: string, claim: string, chapter: number, anchorMarker: string) {
  return {
    id,
    lane: "story-world",
    claim,
    source_ids: ["SRC-001"],
    confidence: "high",
    verified_on: "2026-07-21",
    fictionalization: { status: "simplified", reason: "Compress implementation detail." },
    knowledge_scope: { known_by: ["Mara"], incorrectly_believed_by: [], unknown_to: [] },
    risk: ["procedure varies"],
    dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [chapter], decision_affected: `Chapter ${chapter} decision.` },
    notes: "",
    accuracy_risk: "high",
    evidence_anchors: [{
      source_id: "SRC-001",
      locator: `Section ${chapter}.1`,
      support_type: "direct",
      paraphrase: anchorMarker,
      excerpt_hash: "a".repeat(64),
    }],
    status: "ready",
  } as const;
}

function setup(parent: string): string {
  const root = initializeProject(parent, { projectName: "Grounded Context", projectType: "standalone", profile: "thriller" });
  const bookRoot = join(root, "books", "book-01");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "access", subject: "Mara", fact: "Mara has archive access.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "The log is missing.", reader_knows: "It existed.", characters_know: { Mara: "It is missing." }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(bookRoot, "book-strategy.yaml"), stringifyYaml(completeStrategy()), "utf8");
  writeFileSync(join(bookRoot, "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  const queue = queueFixture();
  queue.packets[1]!.required_research = ["RES-001"];
  writeFileSync(join(bookRoot, "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
  writeFileSync(join(bookRoot, "research-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    items: [
      readyItem("RES-001", "Required chapter claim.", 2, "REQUIRED ANCHOR MARKER"),
      readyItem("RES-002", "Unrelated later claim.", 4, "UNRELATED ANCHOR MARKER"),
    ],
  }), "utf8");
  writeFileSync(join(root, "research", "source-register.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    sources: [{
      id: "SRC-001", type: "primary-document", title: "Operations Manual", location: "research/manual.md",
      verified_on: "2026-07-21", supports: [], notes: "", reliability: "primary", observed_on: "2026-07-21",
      supports_research_ids: ["RES-001", "RES-002", "RES-003"],
    }],
  }), "utf8");
  return root;
}

test("drafting context includes only packet-relevant evidence anchors", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-anchor-context-"));
  try {
    const root = setup(parent);
    const context = buildChapterContext(root, 2);
    assert.match(context.text, /REQUIRED ANCHOR MARKER/);
    assert.doesNotMatch(context.text, /UNRELATED ANCHOR MARKER/);
    assert.ok(context.report.included.includes("research RES-001"));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("research wizard previews and applies a grounded high-risk item through research-update", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-anchor-wizard-"));
  try {
    const root = setup(parent);
    const handler = createResearchWizardHandler(root);
    const item = readyItem("RES-003", "A third grounded procedure.", 3, "WIZARD ANCHOR MARKER");
    const preview = handler.preview("research-item", { item }) as {
      preview_id: string;
      findings: Array<{ severity: string }>;
    };
    assert.equal(preview.findings.some((finding) => finding.severity === "blocker"), false);
    const project = readProject(root);
    const result = await handler.apply({
      proposal_id: "proposal-grounded-research",
      workflow: "research",
      action: "save-research-item",
      expected_stage: project.current_stage,
      expected_project_hash: projectStateHash(root),
      payload: { preview_id: preview.preview_id },
    }) as { gitMessage: string };
    assert.match(result.gitMessage, /research-update/);
    const saved = readFileSync(join(root, "books", "book-01", "research-ledger.yaml"), "utf8");
    assert.match(saved, /RES-003/);
    assert.match(saved, /WIZARD ANCHOR MARKER/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
