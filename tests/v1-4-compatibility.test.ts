import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getProjectStatus } from "../src/application/status.js";
import { refreshGuidance } from "../src/application/handoff.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";
import { DecisionLedgerSchema, IntakeSchema, type DecisionLedger, type IntakeState } from "../src/domain/v1-4-schemas.js";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-v14-compat-"));
  const root = initializeProject(parent, { projectName: "Intake Compatibility", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

test("new projects seed valid empty intake and decision files", () => {
  const { parent, root } = setup();
  try {
    for (const path of ["series/intake.yaml", "series/decision-ledger.yaml"]) assert.equal(existsSync(join(root, path)), true, path);
    const intake = parseYaml<IntakeState>(readFileSync(join(root, "series", "intake.yaml"), "utf8"), IntakeSchema, "intake.yaml");
    const ledger = parseYaml<DecisionLedger>(readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8"), DecisionLedgerSchema, "decision-ledger.yaml");
    assert.equal(intake.original_idea, "");
    assert.deepEqual(intake.authorized_briefs, []);
    assert.deepEqual(intake.authorized_samples, []);
    assert.deepEqual(intake.unresolved_blockers, []);
    assert.deepEqual(ledger.assumptions, []);
    assert.deepEqual(ledger.decisions, []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing both intake files produces one consolidated optional warning and no blocker", () => {
  const { parent, root } = setup();
  try {
    unlinkSync(join(root, "series", "intake.yaml"));
    unlinkSync(join(root, "series", "decision-ledger.yaml"));
    const status = getProjectStatus(root);
    assert.equal(status.blockers.some((item) => /intake\.yaml|decision-ledger\.yaml/.test(item)), false);
    const warnings = status.warnings.filter((item) => /Optional Novel Forge 1\.4 intake setup/i.test(item));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? "", /series\/intake\.yaml/);
    assert.match(warnings[0] ?? "", /series\/decision-ledger\.yaml/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing one intake file still uses the same consolidated warning", () => {
  const { parent, root } = setup();
  try {
    unlinkSync(join(root, "series", "decision-ledger.yaml"));
    const warnings = getProjectStatus(root).warnings.filter((item) => /Optional Novel Forge 1\.4 intake setup/i.test(item));
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0] ?? "", /series\/intake\.yaml/);
    assert.match(warnings[0] ?? "", /series\/decision-ledger\.yaml/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("guidance does not present inferred intake as a confirmed writer decision", () => {
  const { parent, root } = setup();
  try {
    const ledger: DecisionLedger = {
      schema_version: "1.0.0",
      assumptions: [{
        id: "ASM-001",
        scope: "project",
        subject: "profile",
        value: "romantasy",
        status: "inferred",
        source: { type: "inference", path: "series/intake.yaml" },
        confidence: "moderate",
        affects: ["voice-plan"],
        supersedes: null,
      }],
      decisions: [],
    };
    const { stringifyYaml } = await import("../src/infrastructure/yaml.js");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(root, "series", "decision-ledger.yaml"), stringifyYaml(ledger), "utf8");
    const guidance = refreshGuidance(root).markdown;
    assert.doesNotMatch(guidance, /Confirmed writer decisions[\s\S]*romantasy/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
