import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import assert from "node:assert/strict";

async function loadGenesisHelpers() {
  const source = readFileSync(join(process.cwd(), "extensions", "genesis.ts"), "utf8");
  const augmented = `${source}\nexport { detectPhase, findProjectRoot, missingExpectedForPhase, renderValidationReport, renderStatusDashboard, renderDashboard, renderResume, renderDoctorReport, detectWorkflowMode, missingModeArtifacts, getModeTemplateEntries, getModeBundleEntries, collectLintFindings, getGitState, migrateProject, compileManuscript, createEditorialExport, manuscriptStats, checkpointGenesisFiles, findSeriesRoot, findSeriesWorkspaces, initializeSeriesWorkspace, renderSeriesStatus, buildSeriesNextPrompt, buildSeriesVerifyPrompt, buildSeriesRegressionCheckPrompt, buildSeriesLockBookPrompt, buildSeriesScorePrompt, listSeriesBookProjects, seriesArtifactMissing, addSeriesBookToWorkspace, collectSeriesBlockers, renderSeriesBlockers, renderSeriesRegressionCheck, createSeriesExport, analyzePrdCompleteness, renderWriterQuestions, renderOutlineStressTest, renderRegressionCheck, buildPrdDiffPrompt, buildQuestionsPrompt, buildOutlineStressTestPrompt, buildReviewPersonasPrompt, buildPersonaReviewPrompt, buildRegressionCheckPrompt };`;
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

  const sacredTemplates = helpers.getModeTemplateEntries("biblical fiction").map((item) => item.destination).sort();
  assert.deepEqual(sacredTemplates, [
    "artifacts/anachronism-modernity-audit.md",
    "artifacts/authors-note-source-note.md",
    "artifacts/character-humility-guardrail.md",
    "artifacts/faith-reader-personas.md",
    "artifacts/historical-cultural-plausibility-audit.md",
    "artifacts/invention-boundary-ledger.md",
    "artifacts/miracle-supernatural-policy.md",
    "artifacts/point-of-view-ethics-audit.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/sacred-figure-handling-rules.md",
    "artifacts/sacred-residue-audit.md",
    "artifacts/sacred-retelling-promise.md",
    "artifacts/sacred-scene-packets.md",
    "artifacts/scripture-source-map.md",
    "artifacts/theological-risk-budget.md",
    "artifacts/tradition-lane-selector.md",
    "artifacts/translation-sensitivity-map.md",
    "research/reference-inventory.md",
  ]);
  const sacredBundle = helpers.getModeBundleEntries("sacred retelling").map((item) => item.destination).sort();
  assert.ok(sacredBundle.includes("artifacts/scripture-source-map.md"), "sacred retelling bundle should include scripture source map");
  assert.ok(sacredBundle.includes("artifacts/invention-boundary-ledger.md"), "sacred retelling bundle should include invention boundary ledger");
  assert.ok(sacredBundle.includes("artifacts/sacred-scene-packets.md"), "sacred retelling bundle should include sacred scene packets");
  assert.ok(sacredBundle.includes("artifacts/anachronism-modernity-audit.md"), "sacred retelling bundle should include anachronism audit");
  assert.ok(sacredBundle.includes("artifacts/miracle-supernatural-policy.md"), "sacred retelling bundle should include miracle policy");
  assert.ok(sacredBundle.includes("artifacts/sacred-residue-audit.md"), "sacred retelling bundle should include sacred residue audit");
  assert.ok(sacredBundle.includes("artifacts/authors-note-source-note.md"), "sacred retelling bundle should include author's note source note");

  const seriesRepairTemplates = helpers.getModeTemplateEntries("series repair").map((item) => item.destination).sort();
  assert.deepEqual(seriesRepairTemplates, [
    "artifacts/book-handoff-packet.md",
    "artifacts/canon-lock.md",
    "artifacts/character-state-matrix.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/retcon-log.md",
    "artifacts/reveal-spoiler-matrix.md",
    "artifacts/series-arc-map.md",
    "artifacts/series-bible.md",
    "artifacts/series-payoff-ledger.md",
    "artifacts/series-repetition-radar.md",
    "artifacts/series-timeline.md",
    "artifacts/series-verification-matrix.md",
  ]);

  const seriesRepairBundle = helpers.getModeBundleEntries("series repair").map((item) => item.destination).sort();
  assert.ok(seriesRepairBundle.includes("artifacts/canon-lock.md"), "series repair bundle should include canon-lock");
  assert.ok(seriesRepairBundle.includes("artifacts/series-verification-matrix.md"), "series repair bundle should include verification matrix");
  assert.ok(seriesRepairBundle.includes("artifacts/book-handoff-packet.md"), "series repair bundle should include handoff packet");

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

  mkdirSync(join(cert, "manuscript", "chapters"), { recursive: true });
  writeFileSync(join(cert, "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThe first chapter changes something important.", "utf8");
  writeFileSync(join(cert, "manuscript", "chapters", "02-next.md"), "# Next\n\nThe next chapter escalates the pressure.", "utf8");
  const stats = helpers.manuscriptStats(cert);
  assert.equal(stats.chapters, 2, "manuscript stats should count chapter files");
  const compiled = helpers.compileManuscript(cert);
  assert.equal(existsSync(join(cert, "delivery", "manuscript-full.md")), true, "compile should write manuscript-full.md");
  assert.equal(compiled.chapters, 2, "compile should report chapter count");
  const dashboard = helpers.renderDashboard(cert);
  assert.ok(dashboard.includes("# Genesis Dashboard"), "dashboard report should render");
  assert.ok(dashboard.includes("Manuscript: 2 chapter"), "dashboard should include manuscript stats");
  const exported = helpers.createEditorialExport(cert);
  assert.ok(exported.files.includes("delivery/editorial-handoff.md"), "export should create handoff file");
  assert.equal(existsSync(join(cert, "delivery", "beta-reader-packet.md")), true, "export should write beta packet");

  execSync("git config user.email genesis-test@example.com", { cwd: cert });
  execSync("git config user.name Genesis Test", { cwd: cert });
  const checkpoint = helpers.checkpointGenesisFiles(cert, "manuscript/chapters/01-opening.md");
  assert.equal(checkpoint.attempted, 1, "checkpoint should attempt explicit changed Genesis file");
  assert.equal(checkpoint.results[0].status, "committed", "checkpoint should commit one file");

  const nonGenesisParent = join(tempRoot, "non-genesis");
  mkdirSync(join(nonGenesisParent, "artifacts"), { recursive: true });
  writeFileSync(join(nonGenesisParent, "ASSUMPTIONS.md"), "# Assumptions\n", "utf8");
  const fallbackNested = join(nonGenesisParent, "child");
  mkdirSync(fallbackNested, { recursive: true });
  assert.equal(helpers.findProjectRoot(fallbackNested), nonGenesisParent, "fallback root detection should still work for partial Genesis trees");

  const series = join(tempRoot, "series-project");
  const seriesResult = helpers.initializeSeriesWorkspace(series, "Test Series", "A linked three-book pressure machine.", 3);
  assert.equal(existsSync(join(series, "SERIES_STATE.yaml")), true, "series start should create SERIES_STATE.yaml");
  assert.equal(existsSync(join(series, "artifacts", "series-arc-map.md")), true, "series start should scaffold series arc map");
  assert.equal(existsSync(join(series, "artifacts", "series-timeline.md")), true, "series start should scaffold series timeline");
  assert.equal(existsSync(join(series, "artifacts", "character-state-matrix.md")), true, "series start should scaffold character state matrix");
  assert.equal(existsSync(join(series, "artifacts", "reveal-spoiler-matrix.md")), true, "series start should scaffold reveal spoiler matrix");
  assert.equal(seriesResult.bookRoots.length, 3, "series start should create one project per planned book");
  assert.equal(existsSync(join(series, "books", "book-01", "PROJECT_STATE.yaml")), true, "series book should be a Genesis project");
  assert.equal(helpers.detectWorkflowMode(join(series, "books", "book-01")), "series installment", "series books should use series installment mode");
  assert.deepEqual(helpers.seriesArtifactMissing(series), [], "series workspace should scaffold all series artifacts");
  assert.equal(helpers.findSeriesRoot(join(series, "books", "book-02", "artifacts")), series, "findSeriesRoot should climb from nested book folders");
  assert.ok(helpers.findSeriesWorkspaces(tempRoot, 2).includes(series), "findSeriesWorkspaces should find series roots under cwd");
  const seriesStatus = helpers.renderSeriesStatus(series);
  assert.ok(seriesStatus.includes("# Genesis Series Status"), "series status should render");
  assert.ok(seriesStatus.includes("books/book-01"), "series status should list book projects");
  const seriesNextPrompt = helpers.buildSeriesNextPrompt(series, "continue");
  assert.ok(seriesNextPrompt.includes("whole-series Genesis workspace"), "series next prompt should render");
  assert.ok(seriesNextPrompt.includes("separate locked canon from provisional future plans"), "series next prompt should separate canon from planning");
  assert.ok(seriesNextPrompt.includes("Do not invent definitive book endings prematurely"), "series next prompt should guard against premature endings");
  const seriesVerifyPrompt = helpers.buildSeriesVerifyPrompt(series);
  assert.ok(seriesVerifyPrompt.includes("cross-book series verification"), "series verify prompt should render");
  assert.ok(seriesVerifyPrompt.includes("future-book entries as planned/provisional"), "series verify prompt should separate planned future from canon");
  assert.ok(seriesVerifyPrompt.includes("reveal-spoiler-matrix.md"), "series verify prompt should include reveal-order tracking");
  const seriesRegressionPrompt = helpers.buildSeriesRegressionCheckPrompt(series);
  assert.ok(seriesRegressionPrompt.includes("series regression check"), "series regression prompt should render");
  assert.ok(seriesRegressionPrompt.includes("book-handoff-packet.md"), "series regression prompt should include handoff packets");
  assert.ok(helpers.renderSeriesRegressionCheck(series).includes("# Series Regression Check"), "series regression report should render");
  const seriesLockPrompt = helpers.buildSeriesLockBookPrompt(series, join(series, "books", "book-01"));
  assert.ok(seriesLockPrompt.includes("lock one series installment"), "series lock prompt should render");
  assert.ok(seriesLockPrompt.includes("Only facts evidenced"), "series lock prompt should avoid unsupported canon locking");
  assert.ok(seriesLockPrompt.includes("book-handoff-packet.md"), "series lock prompt should require handoff packet updates");
  assert.ok(helpers.buildSeriesScorePrompt(series).includes("whole-series score"), "series score prompt should render");
  const addedBook = helpers.addSeriesBookToWorkspace(series, "A fourth book changes the final pressure.");
  assert.equal(addedBook.index, 4, "series add book should append the next installment");
  assert.equal(existsSync(join(series, "books", "book-04", "PROJECT_STATE.yaml")), true, "series add book should create a book project");
  assert.equal(helpers.listSeriesBookProjects(series).length, 4, "series book list should include appended book");
  const seriesBlockers = helpers.collectSeriesBlockers(series);
  assert.ok(Array.isArray(seriesBlockers), "series blocker collection should return an array");
  assert.ok(helpers.renderSeriesBlockers(series).includes("["), "series blocker report should render findings");
  mkdirSync(join(series, "books", "book-01", "manuscript", "chapters"), { recursive: true });
  writeFileSync(join(series, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Book One Opening\n\nThe series pressure begins.", "utf8");
  writeFileSync(join(series, "evaluations", "series-regression-check.md"), helpers.renderSeriesRegressionCheck(series), "utf8");
  const seriesExport = helpers.createSeriesExport(series);
  assert.ok(seriesExport.files.includes("delivery/full-series-manuscript.md"), "series export should create full-series manuscript");
  assert.equal(existsSync(join(series, "delivery", "series-editorial-handoff.md")), true, "series export should create editorial handoff");
  assert.ok(readFileSync(join(series, "delivery", "series-bible-export.md"), "utf8").includes("Series Timeline"), "series export should include new series integrity artifacts");

  const prdText = readFileSync(join(process.cwd(), "examples", "prd-first-project", "sample-prd.md"), "utf8");
  const prdAnalysis = helpers.analyzePrdCompleteness(prdText);
  assert.ok(prdAnalysis.score >= 80, "PRD-first example should score as ready with minor gaps");
  assert.equal(existsSync(join(process.cwd(), "examples", "prd-first-project", "artifacts", "writer-questions.md")), true, "PRD-first example should include writer questions");
  assert.equal(existsSync(join(process.cwd(), "examples", "prd-first-project", "evaluations", "outline-stress-test.md")), true, "PRD-first example should include outline stress test");
  assert.equal(existsSync(join(process.cwd(), "examples", "prd-first-project", "evaluations", "persona-review.md")), true, "PRD-first example should include persona review");
  assert.equal(existsSync(join(process.cwd(), "examples", "prd-first-project", "evaluations", "regression-check.md")), true, "PRD-first example should include regression check");
  assert.ok(readFileSync(join(process.cwd(), "examples", "prd-first-project", "artifacts", "review-personas.md"), "utf8").includes("Hostile / Misaligned Reader"), "review personas should include hostile/misaligned reader role");
  assert.ok(helpers.renderWriterQuestions(cert).includes("# Writer Questions"), "writer questions should render");
  assert.ok(helpers.renderOutlineStressTest(cert).includes("# Outline Stress Test"), "outline stress test should render");
  assert.ok(helpers.renderRegressionCheck(cert).includes("# Regression Check"), "regression check should render");
  const ngramFixture = join(tempRoot, "ngram-fixture");
  mkdirSync(ngramFixture, { recursive: true });
  writeFileSync(join(ngramFixture, "01.md"), "# One\n\nThere it was. There it was again. The real problem was not the machine but the room.", "utf8");
  writeFileSync(join(ngramFixture, "02.md"), "# Two\n\nThere it was in the hallway. The real problem was not the machine but the timing.", "utf8");
  const ngramOutput = execSync(`node scripts/ngram-audit.mjs \"${ngramFixture}\" --min-count 2 --top 10`, { cwd: process.cwd() }).toString();
  assert.ok(ngramOutput.includes("# Genesis n-gram audit"), "n-gram audit should render a report header");
  assert.ok(ngramOutput.includes("there it was"), "n-gram audit should catch repeated trigrams");
  assert.ok(ngramOutput.includes("problem was not the machine"), "n-gram audit should catch repeated 5-grams");
  const ngramProject = join(tempRoot, "ngram-project");
  makeProject(ngramProject, { phase: "Phase 3: Drafting", workflowMode: "novel" });
  mkdirSync(join(ngramProject, "manuscript", "chapters"), { recursive: true });
  writeFileSync(join(ngramProject, "manuscript", "chapters", "01.md"), "# One\n\nThere it was. There it was again. The real problem was not the machine but the room.", "utf8");
  writeFileSync(join(ngramProject, "manuscript", "chapters", "02.md"), "# Two\n\nThere it was in the hallway. The real problem was not the machine but the timing.", "utf8");
  const artifactOutput = execSync(`node scripts/ngram-audit.mjs \"${ngramProject}\" --min-count 2 --write-ear-pass --write-ai-tell`, { cwd: process.cwd() }).toString();
  assert.ok(artifactOutput.includes("Updated artifact section(s):"), "n-gram audit should report artifact updates");
  const earPass = readFileSync(join(ngramProject, "artifacts", "ear-pass.md"), "utf8");
  const aiTell = readFileSync(join(ngramProject, "artifacts", "ai-tell-mitigation-audit.md"), "utf8");
  assert.ok(earPass.includes("<!-- ngram-audit:start -->"), "ear-pass should include bounded n-gram section");
  assert.ok(aiTell.includes("<!-- ngram-audit:start -->"), "ai-tell audit should include bounded n-gram section");
  assert.ok(earPass.includes("there it was"), "ear-pass artifact should include repeated phrase evidence");
  assert.ok(helpers.buildPrdDiffPrompt(cert, "candidate-prd.md").includes("PRD diff"), "PRD diff prompt should render");
  assert.ok(helpers.buildQuestionsPrompt(cert).includes("writer-only questions"), "questions prompt should render");
  assert.ok(helpers.buildOutlineStressTestPrompt(cert).includes("outline stress test"), "outline stress prompt should render");
  assert.ok(helpers.buildReviewPersonasPrompt(cert).includes("persona panel"), "review persona prompt should render");
  assert.ok(helpers.buildPersonaReviewPrompt(cert, "outline").includes("persona-based review"), "persona review prompt should render");
  assert.ok(helpers.buildRegressionCheckPrompt(cert).includes("regression check"), "regression prompt should render");

  assert.ok(existsSync(join(process.cwd(), "references", "pipeline", "manifest.yaml")), "manifest should exist for helper loading");

  console.log("Genesis sample-project tests passed.");
} finally {
  cleanup(tempRoot);
  cleanup(helperModulePath);
}
