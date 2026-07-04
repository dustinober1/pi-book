import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import assert from "node:assert/strict";

async function loadGenesisHelpers() {
  const source = readFileSync(join(process.cwd(), "extensions", "genesis.ts"), "utf8");
  const augmented = `${source}\nexport { detectPhase, findProjectRoot, missingExpectedForPhase, renderValidationReport, renderStatusDashboard, renderResume, renderDoctorReport, detectWorkflowMode, missingModeArtifacts, getModeTemplateEntries, getModeBundleEntries, collectLintFindings, getGitState, migrateProject };`;
  const helperModulePath = join(process.cwd(), "scripts", ".genesis-test-module.mjs");
  writeFileSync(helperModulePath, augmented, "utf8");
  return { module: await import(pathToFileURL(helperModulePath).href), helperModulePath };
}

function makeProject(root, { phase, workflowMode = "unknown" }) {
  mkdirSync(join(root, "artifacts"), { recursive: true });
  writeFileSync(
    join(root, "PROJECT_STATE.yaml"),
    `project_name: "Test"\ncurrent_phase: ${JSON.stringify(phase)}\nworkflow_mode: ${JSON.stringify(workflowMode)}\n`,
    "utf8",
  );
  writeFileSync(join(root, "ASSUMPTIONS.md"), "# Assumptions\n", "utf8");
}

function cleanup(path) {
  rmSync(path, { recursive: true, force: true });
}

const tempRoot = mkdtempSync(join(tmpdir(), "genesis-fixtures-"));
const { module: helpers, helperModulePath } = await loadGenesisHelpers();

try {
  const intake = join(tempRoot, "intake-project");
  makeProject(intake, { phase: "Phase 0: Intake" });
  writeFileSync(join(intake, "artifacts", "00-brief.md"), "# Brief\n", "utf8");

  const intakeMissing = helpers.missingExpectedForPhase(intake, "Phase 0: Intake");
  assert.ok(intakeMissing.includes("artifacts/01-market-map.md"), "intake project should report missing intake outputs");
  assert.ok(!intakeMissing.includes("artifacts/03-characters.md"), "intake project should not report future-phase outputs");

  const cert = join(tempRoot, "cert-project");
  makeProject(cert, { phase: "Phase 1: Foundation", workflowMode: "certification prep" });
  const modeMissing = helpers.missingModeArtifacts(cert, "certification prep");
  assert.deepEqual(modeMissing.sort(), [
    "artifacts/certification-blueprint-map.md",
    "artifacts/evidence-map.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/study-guide-objectives.md",
    "research/reference-inventory.md",
  ]);

  const nested = join(cert, "notes", "deep");
  mkdirSync(nested, { recursive: true });
  assert.equal(helpers.findProjectRoot(nested), cert, "findProjectRoot should climb to PROJECT_STATE.yaml");

  const statusBeforeGit = helpers.renderStatusDashboard(cert);
  assert.ok(statusBeforeGit.includes("Git initialized: no"), "status should report missing git init");
  assert.equal(helpers.detectWorkflowMode(cert), "certification prep");
  assert.equal(helpers.detectPhase(readFileSync(join(cert, "PROJECT_STATE.yaml"), "utf8")), "Phase 1: Foundation");

  execSync("git init", { cwd: cert, stdio: "ignore" });
  const gitStateAfterInit = helpers.getGitState(cert);
  assert.equal(gitStateAfterInit.initialized, true, "git state should detect initialized repository");

  const planTemplates = helpers.getModeTemplateEntries("certification prep").map((item) => item.destination).sort();
  assert.deepEqual(planTemplates, [
    "artifacts/certification-blueprint-map.md",
    "artifacts/evidence-map.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/study-guide-objectives.md",
    "research/reference-inventory.md",
  ]);

  const bundleTemplates = helpers.getModeBundleEntries("certification prep").map((item) => item.destination).sort();
  assert.ok(bundleTemplates.includes("artifacts/drift-loop-alarm.md"), "mode bundle should include drift-loop alarm");
  assert.ok(bundleTemplates.includes("artifacts/reader-promise-tracker.md"), "mode bundle should include reader-promise-tracker");

  const validation = helpers.renderValidationReport(cert);
  assert.ok(validation.includes("Mode-specific missing artifacts: 5"), "validation should count missing mode artifacts");

  writeFileSync(join(cert, "artifacts", "review-personas.md"), "# Review Personas\n\nunknown\n", "utf8");
  const lintFindings = helpers.collectLintFindings(cert, "Phase 1: Foundation");
  assert.ok(lintFindings.some((item) => item.file === "artifacts/review-personas.md"), "lint should catch placeholder-heavy artifacts");

  const resume = helpers.renderResume(cert);
  assert.ok(resume.includes("# Genesis Resume"), "resume report should render");

  const migrated = join(tempRoot, "migrate-me");
  mkdirSync(join(migrated, "artifacts"), { recursive: true });
  writeFileSync(join(migrated, "ASSUMPTIONS.md"), "# Assumptions\n", "utf8");
  const migratedResult = helpers.migrateProject(migrated);
  assert.equal(existsSync(join(migrated, "PROJECT_STATE.yaml")), true, "migrate should create PROJECT_STATE.yaml when missing");
  assert.ok(migratedResult.phase.startsWith("Phase"), "migrate should infer or assign a phase");

  const doctor = helpers.renderDoctorReport(cert);
  assert.ok(doctor.includes("# Genesis Doctor"), "doctor report should render");

  const nonGenesisParent = join(tempRoot, "non-genesis");
  mkdirSync(join(nonGenesisParent, "artifacts"), { recursive: true });
  writeFileSync(join(nonGenesisParent, "ASSUMPTIONS.md"), "# Assumptions\n", "utf8");
  const fallbackNested = join(nonGenesisParent, "child");
  mkdirSync(fallbackNested, { recursive: true });
  assert.equal(helpers.findProjectRoot(fallbackNested), nonGenesisParent, "fallback root detection should still work for partial Genesis trees");

  assert.ok(existsSync(join(process.cwd(), "references", "pipeline", "manifest.yaml")), "manifest should exist for helper loading");

  console.log("Genesis sample-project tests passed.");
} finally {
  cleanup(tempRoot);
  cleanup(helperModulePath);
}
