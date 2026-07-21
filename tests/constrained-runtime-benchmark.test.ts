import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  benchmarkReportJson,
  deterministicBenchmarkView,
  runConstrainedRuntimeBenchmark,
  runContextBoundaryBenchmark,
} from "../src/evaluation/constrained-runtime.js";

const expectedScenarios = [
  "thriller-standalone-planning",
  "thriller-series-planning",
  "romantasy-standalone-planning",
  "romantasy-series-planning",
  "drafting-context",
  "revision-ticket",
];

const expectedProfiles = ["tiny-local", "local", "full"];

test("constrained runtime benchmark covers the six required synthetic baselines", () => {
  const results = runConstrainedRuntimeBenchmark(join(process.cwd(), "evals"));
  assert.deepEqual(results.map((result) => result.scenario), expectedScenarios);
  for (const result of results) {
    assert.equal(result.runtimeProfile, "full");
    assert.equal(result.stageSuccess, true);
    assert.equal(result.validationResult, "pass");
    assert.ok(result.promptChars > 0);
    assert.ok(result.contextChars > 0);
    assert.equal(result.estimatedInputTokens, Math.ceil((result.promptChars + result.contextChars) / 4));
    assert.ok(result.changedFileCount >= 1);
    assert.ok(result.changedBytes > 0);
    assert.ok(result.elapsedMs >= 0);
    assert.ok(result.rssBytes > 0);
  }
});

test("boundary benchmark covers every runtime profile", () => {
  const boundaries = runContextBoundaryBenchmark();
  assert.deepEqual(boundaries.map((result) => result.profile), expectedProfiles);
  for (const result of boundaries) {
    assert.equal(result.passed, true);
    assert.equal(result.requiredRecords, result.includedRecords);
    assert.equal(result.omittedOptionalRecords, 1);
  }
});

test("deterministic benchmark fields are stable across identical runs", () => {
  const first = deterministicBenchmarkView(runConstrainedRuntimeBenchmark(join(process.cwd(), "evals")));
  const second = deterministicBenchmarkView(runConstrainedRuntimeBenchmark(join(process.cwd(), "evals")));
  assert.deepEqual(second, first);
  assert.deepEqual(runContextBoundaryBenchmark(), runContextBoundaryBenchmark());
});

test("benchmark JSON never includes synthetic manuscript prose or raw prompts", () => {
  const json = benchmarkReportJson(runConstrainedRuntimeBenchmark(join(process.cwd(), "evals")), runContextBoundaryBenchmark());
  assert.equal(json.includes("The alarm did not sound."), false);
  assert.equal(json.includes("Use the novel-forge-for-pi skill."), false);
  assert.equal(json.includes("sample_chapter"), false);
  assert.equal(json.includes("Preserve this boundary instruction exactly"), false);
  assert.match(json, /"scenario": "drafting-context"/);
  assert.match(json, /"profile": "tiny-local"/);
});

test("CI retains a parseable benchmark JSON artifact without npm banners", () => {
  const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "test.yml"), "utf8");
  assert.match(workflow, /npm run --silent benchmark:constrained-runtime > constrained-runtime-benchmark\.json/);

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", "--silent", "benchmark:constrained-runtime"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as { schemaVersion?: string; results?: unknown[]; boundaries?: unknown[] };
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.results?.length, expectedScenarios.length);
  assert.equal(report.boundaries?.length, expectedProfiles.length);
});
