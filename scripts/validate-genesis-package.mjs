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
  "references/templates/voice-bible.md",
  "references/templates/continuity-ledger.md",
  "references/templates/revision-tickets.md",
  "references/templates/expansion-integrity.md",
  "references/templates/series-bible.md",
  "references/templates/canon-lock.md",
  "references/templates/installment-promise-tracker.md",
  "references/templates/series-verification-matrix.md",
  "references/templates/argument-spine.md",
  "references/templates/certification-blueprint-map.md",
  "references/templates/reference-inventory.md",
  "references/templates/evidence-map.md",
  "references/templates/study-guide-objectives.md",
  "references/templates/author-intent.md",
  "references/templates/taste-profile.md",
  "references/templates/risk-budget.md",
  "references/templates/review-personas.md",
  "references/templates/reader-promise-tracker.md",
  "references/templates/drift-loop-alarm.md",
];
for (const templatePath of templatePaths) {
  assert.ok(existsSync(join(root, templatePath)), `missing scaffold template: ${templatePath}`);
}

const readme = readFileSync(join(root, "README.md"), "utf8");
assert.ok(readme.includes("/genesis-plan"), "README should document /genesis-plan");
assert.ok(readme.includes("/genesis-doctor"), "README should document /genesis-doctor");
assert.ok(readme.includes("/genesis-start"), "README should document /genesis-start");
assert.ok(readme.includes("/genesis-compile"), "README should document /genesis-compile");
assert.ok(readme.includes("/genesis-checkpoint"), "README should document /genesis-checkpoint");
assert.ok(readme.includes("/genesis-ingest"), "README should document /genesis-ingest");
assert.ok(readme.includes("/bg-plan"), "README should document /bg-plan");

const alias = readFileSync(join(root, "book-genesis-codex.md"), "utf8");
assert.ok(alias.includes("load `./SKILL.md`"), "legacy alias should point to SKILL.md");
assert.ok(alias.includes("/genesis-plan"), "legacy alias should mention /genesis-plan");
assert.ok(alias.includes("/genesis-doctor"), "legacy alias should mention /genesis-doctor");

const extension = readFileSync(join(root, "extensions", "genesis.ts"), "utf8");
assert.ok(extension.includes('const GENESIS_SCHEMA_VERSION = "0.2.0";'), "extension should expose current schema version");
assert.ok(extension.includes("const PHASE_DEFINITIONS = loadPhaseDefinitions();"), "extension should load phase definitions from manifest");
assert.ok(extension.includes("resolve(PACKAGE_ROOT, templatePath)"), "template scaffolding should resolve from package root");
assert.ok(extension.includes("function getModeTemplateEntries(mode)"), "extension should expose mode-template mapping helper");
assert.ok(extension.includes("function getModeBundleEntries(mode)"), "extension should expose mode-bundle helper");
assert.ok(extension.includes("function renderDoctorReport(root)"), "extension should expose doctor report helper");
assert.ok(extension.includes("function renderResume(root)"), "extension should expose resume helper");
assert.ok(extension.includes("function collectLintFindings(root, phase)"), "extension should expose lint helper");
assert.ok(extension.includes('registerPlanCommand("genesis-plan"'), "extension should register /genesis-plan");
assert.ok(extension.includes('registerDoctorCommand("genesis-doctor"'), "extension should register /genesis-doctor");
assert.ok(extension.includes('registerStartCommand("genesis-start"'), "extension should register /genesis-start");
assert.ok(extension.includes('registerMigrateCommand("genesis-migrate"'), "extension should register /genesis-migrate");
assert.ok(extension.includes('registerCompileCommand("genesis-compile"'), "extension should register /genesis-compile");
assert.ok(extension.includes('registerCheckpointCommand("genesis-checkpoint"'), "extension should register /genesis-checkpoint");
assert.ok(extension.includes('queuePromptCommand("genesis-ingest"'), "extension should register /genesis-ingest");
assert.ok(existsSync(join(root, "scripts", "test-genesis-sample-projects.mjs")), "sample-project test script should exist");
assert.ok(existsSync(join(root, "docs", "best-practices.md")), "best-practices doc should exist");
assert.ok(existsSync(join(root, "docs", "troubleshooting.md")), "troubleshooting doc should exist");
assert.ok(existsSync(join(root, "docs", "series-repair-service.md")), "series-repair service doc should exist");
assert.ok(existsSync(join(root, "examples", "novel-project", "PROJECT_STATE.yaml")), "novel example project should exist");
assert.ok(existsSync(join(root, "examples", "certification-prep-project", "PROJECT_STATE.yaml")), "certification example project should exist");
assert.ok(existsSync(join(root, "examples", "series-repair-project", "PROJECT_STATE.yaml")), "series-repair example project should exist");
assert.ok(existsSync(join(root, ".github", "workflows", "test.yml")), "GitHub Actions test workflow should exist");

console.log("Genesis package validation passed.");
