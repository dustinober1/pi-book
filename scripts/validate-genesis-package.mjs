import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, "");
}

function parseManifest(text) {
  const phases = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  let inOutputs = false;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const topLevelMatch = line.match(/^([a-z0-9_]+):\s*$/i);
    if (topLevelMatch) {
      current = { key: topLevelMatch[1], label: "", prompt: "", gate: "", outputs: [], next: "" };
      phases.push(current);
      inOutputs = false;
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^\s{2}([a-z_]+):\s*(.*)$/i);
    if (fieldMatch) {
      const [, key, rawValue] = fieldMatch;
      const value = unquote(rawValue.trim());
      inOutputs = key === "outputs";
      if (key === "label" || key === "prompt" || key === "gate" || key === "next") current[key] = value;
      continue;
    }

    const outputMatch = line.match(/^\s{4}-\s*(.*)$/);
    if (outputMatch && inOutputs) current.outputs.push(unquote(outputMatch[1].trim()));
  }

  return phases.filter((phase) => phase.label);
}

const manifestPath = join(root, "references", "pipeline", "manifest.yaml");
const manifestText = readFileSync(manifestPath, "utf8");
assert.ok(/^schema_version:\s*["']?0\.2\.0["']?/m.test(manifestText), "manifest should declare schema_version 0.2.0");
const manifest = parseManifest(manifestText);
assert.equal(manifest.length, 7, "manifest should define 7 phases");

for (const phase of manifest) {
  assert.ok(phase.label.startsWith("Phase "), `phase label should be normalized: ${phase.label}`);
  assert.ok(Array.isArray(phase.outputs) && phase.outputs.length > 0, `phase should have outputs: ${phase.label}`);
  assert.ok(existsSync(join(root, phase.prompt)), `missing prompt file for ${phase.label}: ${phase.prompt}`);
}

const templatePaths = [
  "references/templates/00-brief.md",
  "references/templates/01-market-map.md",
  "references/templates/05-outline.md",
  "references/templates/causality-chain.md",
  "references/templates/08-adversarial-audit.md",
  "references/templates/09-genesis-score.md",
  "references/templates/commercial-proof.md",
  "references/templates/category-competition-map.md",
  "references/templates/title-subtitle-options.md",
  "references/templates/blurb-test-results.md",
  "references/templates/cover-conversion-notes.md",
  "references/templates/sample-reader-feedback.md",
  "references/templates/launch-channel-plan.md",
  "references/templates/review-risk-log.md",
  "references/templates/ai-use-and-publishing-compliance.md",
  "references/templates/independent-review-matrix.md",
  "references/templates/claim-risk-ledger.md",
  "references/templates/voice-bible.md",
  "references/templates/continuity-ledger.md",
  "references/templates/revision-tickets.md",
  "references/templates/expansion-integrity.md",
  "references/templates/series-bible.md",
  "references/templates/series-arc-map.md",
  "references/templates/series-timeline.md",
  "references/templates/character-state-matrix.md",
  "references/templates/reveal-spoiler-matrix.md",
  "references/templates/canon-lock.md",
  "references/templates/installment-promise-tracker.md",
  "references/templates/series-payoff-ledger.md",
  "references/templates/series-verification-matrix.md",
  "references/templates/retcon-log.md",
  "references/templates/series-repetition-radar.md",
  "references/templates/book-handoff-packet.md",
  "references/templates/series-regression-check.md",
  "references/templates/argument-spine.md",
  "references/templates/certification-blueprint-map.md",
  "references/templates/reference-inventory.md",
  "references/templates/evidence-map.md",
  "references/templates/study-guide-objectives.md",
  "references/templates/sacred-retelling-promise.md",
  "references/templates/scripture-source-map.md",
  "references/templates/invention-boundary-ledger.md",
  "references/templates/theological-risk-budget.md",
  "references/templates/historical-cultural-plausibility-audit.md",
  "references/templates/point-of-view-ethics-audit.md",
  "references/templates/authors-note-source-note.md",
  "references/templates/sacred-scene-packets.md",
  "references/templates/translation-sensitivity-map.md",
  "references/templates/tradition-lane-selector.md",
  "references/templates/sacred-figure-handling-rules.md",
  "references/templates/anachronism-modernity-audit.md",
  "references/templates/faith-reader-personas.md",
  "references/templates/miracle-supernatural-policy.md",
  "references/templates/character-humility-guardrail.md",
  "references/templates/sacred-residue-audit.md",
  "references/templates/author-intent.md",
  "references/templates/taste-profile.md",
  "references/templates/risk-budget.md",
  "references/templates/review-personas.md",
  "references/templates/reader-promise-tracker.md",
  "references/templates/drift-loop-alarm.md",
  "references/templates/publication-shape.md",
  "references/templates/technical-seed-map.md",
  "references/templates/system-rule-sheet.md",
  "references/templates/authority-chain-map.md",
  "references/templates/opposition-case.md",
  "references/templates/domain-plausibility-audit.md",
  "references/templates/cover-generation-prompt.md",
  "references/templates/book-prd.md",
  "references/templates/prd-gap-report.md",
  "references/templates/prd-traceability-map.md",
  "references/templates/prd-completeness-score.md",
  "references/templates/quality-gates.md",
  "references/templates/writer-cockpit.md",
  "references/templates/chapter-production-queue.md",
  "references/templates/taste-lock.md",
  "references/templates/decision-ledger.md",
  "references/templates/prd-change-log.md",
  "references/templates/decision-impact-report.md",
  "references/templates/writer-questions.md",
  "references/templates/outline-stress-test.md",
  "references/templates/persona-review.md",
  "references/templates/regression-check.md",
];
for (const templatePath of templatePaths) {
  assert.ok(existsSync(join(root, templatePath)), `missing scaffold template: ${templatePath}`);
}

const readme = readFileSync(join(root, "README.md"), "utf8");
assert.ok(readme.includes("/genesis-plan"), "README should document /genesis-plan");
assert.ok(readme.includes("/genesis-doctor"), "README should document /genesis-doctor");
assert.ok(readme.includes("/genesis-start"), "README should document /genesis-start");
assert.ok(readme.includes("/genesis-prd-start"), "README should document /genesis-prd-start");
assert.ok(readme.includes("/genesis-prd-ingest"), "README should document /genesis-prd-ingest");
assert.ok(readme.includes("/genesis-cockpit"), "README should document /genesis-cockpit");
assert.ok(readme.includes("/genesis-autopilot"), "README should document /genesis-autopilot");
assert.ok(readme.includes("/genesis-chapter-queue"), "README should document /genesis-chapter-queue");
assert.ok(readme.includes("/genesis-post-chapter-update"), "README should document /genesis-post-chapter-update");
assert.ok(readme.includes("/genesis-taste-lock"), "README should document /genesis-taste-lock");
assert.ok(readme.includes("/genesis-prd-diff"), "README should document /genesis-prd-diff");
assert.ok(readme.includes("/genesis-questions"), "README should document /genesis-questions");
assert.ok(readme.includes("/genesis-outline-stress-test"), "README should document /genesis-outline-stress-test");
assert.ok(readme.includes("/genesis-review-personas"), "README should document /genesis-review-personas");
assert.ok(readme.includes("/genesis-persona-review"), "README should document /genesis-persona-review");
assert.ok(readme.includes("/genesis-regression-check"), "README should document /genesis-regression-check");
assert.ok(readme.includes("/genesis-series-start"), "README should document /genesis-series-start");
assert.ok(readme.includes("/genesis-series-open"), "README should document /genesis-series-open");
assert.ok(readme.includes("/genesis-series-add-book"), "README should document /genesis-series-add-book");
assert.ok(readme.includes("/genesis-series-blockers"), "README should document /genesis-series-blockers");
assert.ok(readme.includes("/genesis-series-verify"), "README should document /genesis-series-verify");
assert.ok(readme.includes("/genesis-series-regression-check"), "README should document /genesis-series-regression-check");
assert.ok(readme.includes("/genesis-series-score"), "README should document /genesis-series-score");
assert.ok(readme.includes("/genesis-series-export"), "README should document /genesis-series-export");
assert.ok(readme.includes("/genesis-compile"), "README should document /genesis-compile");
assert.ok(readme.includes("/genesis-checkpoint"), "README should document /genesis-checkpoint");
assert.ok(readme.includes("lean-novel"), "README should document lean modes");
assert.ok(readme.includes("commercial-proof.md"), "README should document commercial proof artifacts");
assert.ok(readme.includes("ai-use-and-publishing-compliance.md"), "README should document compliance artifacts");
assert.ok(readme.includes("audit:ngrams"), "README should document audit:ngrams");
assert.ok(readme.includes("audit:structure"), "README should document audit:structure");
assert.ok(readme.includes("audit:continuity"), "README should document audit:continuity");
assert.ok(readme.includes("audit:rhetoric"), "README should document audit:rhetoric");
assert.ok(readme.includes("audit:spelling"), "README should document audit:spelling");
assert.ok(readme.includes("audit:temporal"), "README should document audit:temporal");
assert.ok(readme.includes("audit:mechanics"), "README should document audit:mechanics");
assert.ok(!readme.includes("/bg-"), "README should not document legacy /bg-* aliases");
assert.ok(!readme.includes("book-genesis-codex"), "README should not document the removed legacy skill alias");

const extension = readFileSync(join(root, "extensions", "genesis.ts"), "utf8");
assert.ok(extension.includes('const GENESIS_SCHEMA_VERSION = "0.2.0";'), "extension should expose current schema version");
assert.ok(extension.includes("const PHASE_DEFINITIONS = loadPhaseDefinitions();"), "extension should load phase definitions from manifest");
assert.ok(extension.includes("resolve(PACKAGE_ROOT, templatePath)"), "template scaffolding should resolve from package root");
assert.ok(extension.includes("function getModeTemplateEntries(mode)"), "extension should expose mode-template mapping helper");
assert.ok(extension.includes("function getModeBundleEntries(mode)"), "extension should expose mode-bundle helper");
assert.ok(extension.includes('"lean-novel"'), "extension should support lean-novel mode");
assert.ok(extension.includes('"market-test"'), "extension should support market-test mode");
assert.ok(extension.includes("commercial-proof.md"), "extension should scaffold commercial proof artifacts");
assert.ok(extension.includes("function renderDoctorReport(root)"), "extension should expose doctor report helper");
assert.ok(extension.includes("function renderResume(root)"), "extension should expose resume helper");
assert.ok(extension.includes("function collectLintFindings(root, phase)"), "extension should expose lint helper");
assert.ok(extension.includes('registerPlanCommand("genesis-plan"'), "extension should register /genesis-plan");
assert.ok(extension.includes('registerDoctorCommand("genesis-doctor"'), "extension should register /genesis-doctor");
assert.ok(extension.includes('registerStartCommand("genesis-start"'), "extension should register /genesis-start");
assert.ok(extension.includes('registerPrdStartCommand("genesis-prd-start"'), "extension should register /genesis-prd-start");
assert.ok(extension.includes('registerPrdIngestCommand("genesis-prd-ingest"'), "extension should register /genesis-prd-ingest");
assert.ok(extension.includes('registerWriterCockpitCommand("genesis-cockpit"'), "extension should register /genesis-cockpit");
assert.ok(extension.includes('registerAutopilotCommand("genesis-autopilot"'), "extension should register /genesis-autopilot");
assert.ok(extension.includes('registerChapterQueueCommand("genesis-chapter-queue"'), "extension should register /genesis-chapter-queue");
assert.ok(extension.includes('registerPostChapterUpdateCommand("genesis-post-chapter-update"'), "extension should register /genesis-post-chapter-update");
assert.ok(extension.includes('registerTasteLockCommand("genesis-taste-lock"'), "extension should register /genesis-taste-lock");
assert.ok(extension.includes('registerPrdDiffCommand("genesis-prd-diff"'), "extension should register /genesis-prd-diff");
assert.ok(extension.includes('registerQuestionsCommand("genesis-questions"'), "extension should register /genesis-questions");
assert.ok(extension.includes('registerOutlineStressTestCommand("genesis-outline-stress-test"'), "extension should register /genesis-outline-stress-test");
assert.ok(extension.includes('registerReviewPersonasCommand("genesis-review-personas"'), "extension should register /genesis-review-personas");
assert.ok(extension.includes('registerPersonaReviewCommand("genesis-persona-review"'), "extension should register /genesis-persona-review");
assert.ok(extension.includes('registerRegressionCheckCommand("genesis-regression-check"'), "extension should register /genesis-regression-check");
assert.ok(extension.includes('registerSeriesStartCommand("genesis-series-start"'), "extension should register /genesis-series-start");
assert.ok(extension.includes('registerSeriesOpenCommand("genesis-series-open"'), "extension should register /genesis-series-open");
assert.ok(extension.includes('registerSeriesAddBookCommand("genesis-series-add-book"'), "extension should register /genesis-series-add-book");
assert.ok(extension.includes('registerSeriesBlockersCommand("genesis-series-blockers"'), "extension should register /genesis-series-blockers");
assert.ok(extension.includes('registerSeriesVerifyCommand("genesis-series-verify"'), "extension should register /genesis-series-verify");
assert.ok(extension.includes('registerSeriesRegressionCheckCommand("genesis-series-regression-check"'), "extension should register /genesis-series-regression-check");
assert.ok(extension.includes('registerSeriesScoreCommand("genesis-series-score"'), "extension should register /genesis-series-score");
assert.ok(extension.includes('registerSeriesExportCommand("genesis-series-export"'), "extension should register /genesis-series-export");
assert.ok(extension.includes('registerSeriesLockBookCommand("genesis-series-lock-book"'), "extension should register /genesis-series-lock-book");
assert.ok(extension.includes('registerMigrateCommand("genesis-migrate"'), "extension should register /genesis-migrate");
assert.ok(extension.includes('registerCompileCommand("genesis-compile"'), "extension should register /genesis-compile");
assert.ok(extension.includes('registerCheckpointCommand("genesis-checkpoint"'), "extension should register /genesis-checkpoint");
assert.ok(extension.includes('queuePromptCommand("genesis-ingest"'), "extension should register /genesis-ingest");
assert.ok(!extension.includes('"bg-'), "extension should not register legacy /bg-* aliases");
assert.ok(!existsSync(join(root, "book-genesis-codex.md")), "legacy skill alias should be removed");
assert.ok(!existsSync(join(root, "prompts", "bg-next-prompt.md")), "legacy prompt alias should be removed");
assert.ok(!existsSync(join(root, "references", "legacy-v4-book-genesis.md")), "legacy V4 reference should be removed");
assert.ok(existsSync(join(root, "references", "scoring", "genesis-score.md")), "Genesis Score contract should exist");
assert.ok(existsSync(join(root, "scripts", "test-genesis-sample-projects.mjs")), "sample-project test script should exist");
assert.ok(existsSync(join(root, "scripts", "ngram-audit.mjs")), "n-gram audit script should exist");
assert.ok(existsSync(join(root, "scripts", "rhetorical-pattern-audit.mjs")), "rhetorical-pattern audit script should exist");
assert.ok(existsSync(join(root, "scripts", "continuity-scan.mjs")), "continuity scan script should exist");
assert.ok(existsSync(join(root, "scripts", "structure-audit.mjs")), "structure audit script should exist");
assert.ok(existsSync(join(root, "scripts", "spelling-consistency-audit.mjs")), "spelling-consistency audit script should exist");
assert.ok(existsSync(join(root, "scripts", "temporal-reference-audit.mjs")), "temporal-reference audit script should exist");
assert.ok(existsSync(join(root, "scripts", "copy-mechanics-audit.mjs")), "copy-mechanics audit script should exist");
assert.ok(existsSync(join(root, "references", "templates", "scene-inventory.md")), "scene-inventory template should exist");
assert.ok(existsSync(join(root, "references", "templates", "chronology-rebuild.md")), "chronology-rebuild template should exist");
assert.ok(existsSync(join(root, "references", "templates", "act-design-audit.md")), "act-design-audit template should exist");
assert.ok(existsSync(join(root, "docs", "best-practices.md")), "best-practices doc should exist");
assert.ok(existsSync(join(root, "docs", "troubleshooting.md")), "troubleshooting doc should exist");
assert.ok(existsSync(join(root, "docs", "series-repair-service.md")), "series-repair service doc should exist");
assert.ok(existsSync(join(root, "examples", "prd-first-project", "PROJECT_STATE.yaml")), "PRD-first example project should exist");
assert.ok(existsSync(join(root, "examples", "prd-first-project", "sample-prd.md")), "PRD-first sample PRD should exist");
assert.ok(existsSync(join(root, "examples", "prd-first-project", "artifacts", "writer-questions.md")), "PRD-first example writer questions should exist");
assert.ok(existsSync(join(root, "examples", "prd-first-project", "evaluations", "regression-check.md")), "PRD-first example regression check should exist");
assert.ok(existsSync(join(root, "examples", "novel-project", "PROJECT_STATE.yaml")), "novel example project should exist");
assert.ok(existsSync(join(root, "examples", "certification-prep-project", "PROJECT_STATE.yaml")), "certification example project should exist");
assert.ok(existsSync(join(root, "examples", "series-repair-project", "PROJECT_STATE.yaml")), "series-repair example project should exist");
assert.ok(existsSync(join(root, ".github", "workflows", "test.yml")), "GitHub Actions test workflow should exist");

console.log("Genesis package validation passed.");
