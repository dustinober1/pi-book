import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookPlanPrompt, voicePlanPrompt } from "../src/application/prompts.js";
import { defaultDecisionLedger, defaultIntake } from "../src/domain/v1-4-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-intake-prompts-"));
  const root = initializeProject(parent, { projectName: "Intake Prompts", projectType: "standalone", profile: "thriller" });
  return { parent, root };
}

test("voice and book prompts consume decisions while keeping inference unresolved", () => {
  const { parent, root } = setup();
  try {
    const intake = defaultIntake();
    intake.original_idea = "An auditor finds a pattern no one signed.";
    intake.inferred.audience = { value: "adult procedural readers", assumption_id: "ASM-002" };
    const ledger = defaultDecisionLedger();
    ledger.assumptions.push(
      {
        id: "ASM-001",
        scope: "project",
        subject: "profile",
        value: "thriller",
        status: "confirmed",
        source: { type: "inference", path: "series/intake.yaml" },
        confidence: "moderate",
        affects: ["voice-plan", "book-plan"],
        supersedes: null,
      },
      {
        id: "ASM-002",
        scope: "project",
        subject: "audience",
        value: "adult procedural readers",
        status: "inferred",
        source: { type: "inference", path: "series/intake.yaml" },
        confidence: "low",
        affects: ["voice-plan"],
        supersedes: null,
      },
      {
        id: "ASM-003",
        scope: "project",
        subject: "language",
        value: "French",
        status: "rejected",
        source: { type: "inference", path: "series/intake.yaml" },
        confidence: "low",
        affects: ["voice-plan"],
        supersedes: null,
      },
    );
    ledger.decisions.push({
      id: "DEC-001",
      scope: "project",
      subject: "profile",
      choice: "thriller",
      decidedAt: "2026-07-16T10:00:00Z",
      evidenceRefs: ["author confirmation"],
      replaces: null,
    });
    writeFileSync(join(root, "series", "intake.yaml"), stringifyYaml(intake), "utf8");
    writeFileSync(join(root, "series", "decision-ledger.yaml"), stringifyYaml(ledger), "utf8");

    for (const prompt of [voicePlanPrompt(root), bookPlanPrompt(root)]) {
      assert.match(prompt, /Confirmed writer decisions/);
      assert.match(prompt, /profile: thriller/);
      assert.match(prompt, /Unresolved inferred assumptions/);
      assert.match(prompt, /audience: adult procedural readers/);
      assert.match(prompt, /not confirmed facts/i);
      assert.doesNotMatch(prompt, /language: French/);
      assert.match(prompt, /intake-update/);
      assert.match(prompt, /never silently rewrite assumption history/i);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("missing intake files do not fabricate prompt context", () => {
  const { parent, root } = setup();
  try {
    unlinkSync(join(root, "series", "intake.yaml"));
    unlinkSync(join(root, "series", "decision-ledger.yaml"));
    for (const prompt of [voicePlanPrompt(root), bookPlanPrompt(root)]) {
      assert.doesNotMatch(prompt, /Confirmed writer decisions/);
      assert.doesNotMatch(prompt, /Unresolved inferred assumptions/);
      assert.doesNotMatch(prompt, /adult procedural readers|profile: thriller/);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
