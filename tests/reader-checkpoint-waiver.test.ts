import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PACKAGE_WITHOUT_READERS_SUBJECT,
  packageReaderCheckpointFindings,
  packageWithoutReadersDecision,
  readerCheckpointFindings,
  readerCheckpointProgress,
} from "../src/application/reader-checkpoint.js";
import { buildPackagingChecklist } from "../src/application/package-checklist.js";
import { applyPackageArtifacts } from "../src/application/packaging/apply.js";
import { buildPackageArtifacts } from "../src/application/packaging/export.js";
import { getProjectStatus } from "../src/application/status.js";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../src/domain/v1-2-schemas.js";
import type { ReaderExperimentsState } from "../src/domain/schemas.js";
import type { WriterDecisionRecord } from "../src/domain/v1-4-schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-reader-waiver-")); }

function decision(overrides: Partial<WriterDecisionRecord> = {}): WriterDecisionRecord {
  return {
    id: "DEC-001",
    scope: "project",
    subject: PACKAGE_WITHOUT_READERS_SUBJECT,
    choice: "accept:no-reader-evidence",
    decidedAt: "2026-08-07T12:00:00Z",
    evidenceRefs: ["writer confirmed no reader is available before launch"],
    replaces: null,
    ...overrides,
  };
}

function writeLedger(root: string, decisions: WriterDecisionRecord[]): void {
  writeFileSync(join(root, "series", "decision-ledger.yaml"), stringifyYaml({
    schema_version: "1.0.0", assumptions: [], decisions,
  }), "utf8");
}

/** Fill in the publishing and marketing metadata packaging requires. */
function preparePackageInputs(root: string): void {
  writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "# Chapter 1\n\nA clean signal becomes a trap.\n", "utf8");
  const publishingPath = join(root, "books/book-01/publishing.yaml");
  const publishing = parseYaml<PublishingMetadata>(readFileSync(publishingPath, "utf8"), PublishingMetadataSchema, "publishing.yaml");
  publishing.title = "The Clean Signal";
  publishing.author.pen_name = "Nessa Keane";
  publishing.language = "en-US";
  publishing.copyright = { holder: "Nessa Keane", year: "2026", notice: "Copyright © 2026 Nessa Keane" };
  publishing.descriptions.short = "A manufactured warning turns an analyst into a fugitive.";
  publishing.descriptions.long = "A geopolitical techno-thriller about a manufactured warning and the analyst who refuses to trust it.";
  publishing.keywords = ["geopolitical thriller"];
  publishing.categories = ["FICTION / Thrillers / Political"];
  writeFileSync(publishingPath, stringifyYaml(publishing), "utf8");
  const marketingPath = join(root, "books/book-01/marketing.yaml");
  const marketing = parseYaml<MarketingMetadata>(readFileSync(marketingPath, "utf8"), MarketingMetadataSchema, "marketing.yaml");
  marketing.launch.items = ["The warning was clean. Too clean."];
  marketing.social.items = ["An analyst discovers the signal designed to start a war."];
  marketing.advertisements.items = ["AI follows orders no human signed."];
  marketing.audiobook_promotion.items = ["Listen to the conspiracy unfold."];
  marketing.series_page.items = ["Book one of the series."];
  writeFileSync(marketingPath, stringifyYaml(marketing), "utf8");
}

function experimentsWithResponse(): ReaderExperimentsState {
  return {
    schema_version: "1.0.0",
    experiments: [{
      id: "RX-001", target_reader: "thriller readers", sample_path: "kits/RX-001", variant: "A",
      blind_protocol: "blind", minimum_reader_count: 3, status: "collecting", verdict: "insufficient-signal",
      immediate_responses: [{ reader_id: "R-01", source: "human", continued: true, purchase_intent: "yes", confusion: "", trust_break: "", lines_that_worked: "the opening" }],
      delayed_responses: [], notes: "",
    }],
  } as unknown as ReaderExperimentsState;
}

// The block itself is unchanged: without a decision, packaging still stops.
test("no reader evidence and no decision still blocks packaging", () => {
  const findings = readerCheckpointFindings(null, null);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "blocker");
  assert.equal(findings[0]?.code, "no-human-reader-evidence");
  // The blocker now names both remedies: collect evidence, or record the choice.
  assert.match(findings[0]?.message ?? "", /reader-kit workflow/);
  assert.match(findings[0]?.message ?? "", new RegExp(PACKAGE_WITHOUT_READERS_SUBJECT));
});

test("a recorded writer decision downgrades the blocker to a warning that survives", () => {
  const findings = readerCheckpointFindings(null, decision());
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, "warning");
  assert.equal(findings[0]?.code, "reader-evidence-waived");
  // The waiver permits packaging; it never claims validation.
  assert.match(findings[0]?.message ?? "", /DEC-001/);
  assert.match(findings[0]?.message ?? "", /Nothing about this book has been validated by a reader/);
  assert.match(findings[0]?.message ?? "", /Do not describe it as reader-tested/);
});

test("real reader evidence outranks the waiver and reports its own limitations", () => {
  const findings = readerCheckpointFindings(experimentsWithResponse(), decision());
  assert.ok(!findings.some((finding) => finding.code === "reader-evidence-waived"), "recorded evidence is used, not the waiver");
  assert.ok(findings.every((finding) => finding.severity === "warning"));
  assert.ok(findings.some((finding) => finding.code === "thin-reader-evidence"));
});

test("only an active, accepting, in-scope decision counts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Waiver Scope", projectType: "standalone", profile: "thriller" });

    // A superseded decision is not a waiver.
    writeLedger(root, [decision(), decision({ id: "DEC-002", replaces: "DEC-001", choice: "reject:no-reader-evidence" })]);
    assert.equal(packageWithoutReadersDecision(root, "book-01"), null);

    // A decision on another subject is not a waiver.
    writeLedger(root, [decision({ subject: "premise-selection" })]);
    assert.equal(packageWithoutReadersDecision(root, "book-01"), null);

    // A decision that does not accept is not a waiver.
    writeLedger(root, [decision({ choice: "defer:no-reader-evidence" })]);
    assert.equal(packageWithoutReadersDecision(root, "book-01"), null);

    // A decision scoped to a different book is not a waiver for this one.
    writeLedger(root, [decision({ scope: "book-02" })]);
    assert.equal(packageWithoutReadersDecision(root, "book-01"), null);

    // Project scope and matching book scope both count.
    writeLedger(root, [decision()]);
    assert.equal(packageWithoutReadersDecision(root, "book-01")?.id, "DEC-001");
    writeLedger(root, [decision({ scope: "book-01" })]);
    assert.equal(packageWithoutReadersDecision(root, "book-01")?.id, "DEC-001");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the waiver never writes reader evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "No Contamination", projectType: "standalone", profile: "thriller" });
    const experimentsPath = join(root, "books/book-01/reader-experiments.yaml");
    const before = readFileSync(experimentsPath, "utf8");
    writeLedger(root, [decision()]);
    packageReaderCheckpointFindings(root, "book-01");
    readerCheckpointProgress(root, "book-01");
    assert.equal(readFileSync(experimentsPath, "utf8"), before, "reader-experiments.yaml is untouched by the waiver path");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the checkpoint reports its remaining distance from drafting onward", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Early Warning", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");

    const pending = readerCheckpointProgress(root, "book-01");
    assert.equal(pending.satisfied, false);
    assert.match(pending.summary, /no reader experiment exists yet/);
    // It reaches the writer at drafting, not at the packaging gate.
    const status = getProjectStatus(root);
    assert.ok(status.warnings.some((warning) => /Packaging will require at least one recorded human reader response/.test(warning)));
    assert.match(status.markdown, /Reader checkpoint: not yet satisfied/);

    writeLedger(root, [decision()]);
    const waived = readerCheckpointProgress(root, "book-01");
    assert.equal(waived.satisfied, true);
    assert.equal(waived.waived, true);
    const waivedStatus = getProjectStatus(root);
    assert.ok(!waivedStatus.warnings.some((warning) => /Packaging will require/.test(warning)));
    assert.match(waivedStatus.markdown, /Reader checkpoint: waived by writer decision/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("planning stages do not raise the checkpoint yet", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Too Early", projectType: "standalone", profile: "thriller" });
    const status = getProjectStatus(root);
    assert.ok(!status.warnings.some((warning) => /Packaging will require/.test(warning)));
    assert.doesNotMatch(status.markdown, /Reader checkpoint:/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// The end-to-end claim of Phase 3: a book can be packaged headlessly, and a
// waived book packages while carrying the absence in its own artifacts.
test("the waiver lets packaging produce artifacts that record the absence", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Waived Package", projectType: "standalone", profile: "thriller" });
    preparePackageInputs(root);

    // Without the decision, packaging is blocked by the checklist item.
    const blocked = buildPackagingChecklist(root);
    assert.ok(blocked.items.some((item) => item.id === "reader-checkpoint" && item.blocking && !item.complete));
    await assert.rejects(() => applyPackageArtifacts(root, { preferPandoc: false }), /Packaging is blocked/);

    writeLedger(root, [decision()]);
    const ready = buildPackagingChecklist(root);
    assert.ok(ready.items.some((item) => item.id === "reader-checkpoint" && item.complete && !item.blocking));

    const built = await buildPackageArtifacts(root, { preferPandoc: false });
    const manifest = built.changes.find((change) => change.path.endsWith("package-manifest.yaml"));
    const report = built.changes.find((change) => change.path.endsWith("package-report.md"));
    assert.ok(manifest && typeof manifest.content === "string");
    assert.match(manifest.content as string, /No human reader has read this book/);
    assert.match(manifest.content as string, /DEC-001/);
    assert.match(manifest.content as string, /do not describe it as reader-tested/i);
    // The packaging report surfaces the same fact under its claim limits.
    assert.ok(report && typeof report.content === "string");
    assert.match(report.content as string, /No human reader has read this book/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a package built with real reader evidence carries no waiver warning", async () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Read Package", projectType: "standalone", profile: "thriller" });
    preparePackageInputs(root);
    writeFileSync(join(root, "books/book-01/reader-experiments.yaml"), stringifyYaml(experimentsWithResponse()), "utf8");
    const built = await buildPackageArtifacts(root, { preferPandoc: false });
    const manifest = built.changes.find((change) => change.path.endsWith("package-manifest.yaml"));
    assert.doesNotMatch(manifest!.content as string, /No human reader has read this book/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
