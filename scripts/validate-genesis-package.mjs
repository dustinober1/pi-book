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
const manifest = parseManifest(readFileSync(manifestPath, "utf8"));
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
  "references/templates/argument-spine.md",
  "references/templates/certification-blueprint-map.md",
  "references/templates/reference-inventory.md",
  "references/templates/evidence-map.md",
  "references/templates/study-guide-objectives.md",
];
for (const templatePath of templatePaths) {
  assert.ok(existsSync(join(root, templatePath)), `missing scaffold template: ${templatePath}`);
}

const readme = readFileSync(join(root, "README.md"), "utf8");
assert.ok(readme.includes("/genesis-plan"), "README should document /genesis-plan");
assert.ok(readme.includes("/bg-plan"), "README should document /bg-plan");

const alias = readFileSync(join(root, "book-genesis-codex.md"), "utf8");
assert.ok(alias.includes("load `./SKILL.md`"), "legacy alias should point to SKILL.md");
assert.ok(alias.includes("/genesis-plan"), "legacy alias should mention /genesis-plan");

const extension = readFileSync(join(root, "extensions", "genesis.ts"), "utf8");
assert.ok(extension.includes("const PHASE_DEFINITIONS = loadPhaseDefinitions();"), "extension should load phase definitions from manifest");
assert.ok(extension.includes("resolve(PACKAGE_ROOT, templatePath)"), "template scaffolding should resolve from package root");
assert.ok(extension.includes("function getModeTemplateEntries(mode)"), "extension should expose mode-template mapping helper");
assert.ok(extension.includes("scaffoldModeArtifacts(root, mode, false)"), "set-mode should offer mode-specific scaffolding");
assert.ok(extension.includes('registerPlanCommand("genesis-plan"'), "extension should register /genesis-plan");
assert.ok(existsSync(join(root, "scripts", "test-genesis-sample-projects.mjs")), "sample-project test script should exist");

console.log("Genesis package validation passed.");
