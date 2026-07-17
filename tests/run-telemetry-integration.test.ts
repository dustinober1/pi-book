import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beginPersistentRun } from "../src/application/run.js";
import type { RunReport } from "../src/domain/run-report.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function withProject(callback: (root: string) => void): void {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-telemetry-integration-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Telemetry Integration",
      projectType: "standalone",
      profile: "thriller",
      runtimeProfile: "tiny-local",
    });
    callback(root);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

test("starting a persistent run records a privacy-safe local run report", () => {
  withProject((root) => {
    const decision = beginPersistentRun(root, {
      target: "next-milestone",
      maxChapters: 8,
      runtimeProfile: "tiny-local",
      now: "2026-07-16T21:00:00Z",
    });
    const path = join(root, ".pi-book", "runs", "RUN-001", "run-report.json");
    assert.equal(existsSync(path), true);
    const report = JSON.parse(readFileSync(path, "utf8")) as RunReport;
    assert.equal(report.runId, "RUN-001");
    assert.equal(report.runtimeProfile, "tiny-local");
    assert.equal(report.promptChars, decision.prompt?.length);
    assert.equal(report.contextChars, 0);
    assert.equal(report.changedFileCount, 0);
    assert.equal(report.changedBytes, 0);
    assert.equal(report.repairAttempts, 0);
    assert.deepEqual(report.validationFailures, []);
    assert.equal(JSON.stringify(report).includes(decision.prompt ?? "unreachable"), false);
  });
});

test("project telemetry opt-out prevents persistent run report creation", () => {
  withProject((root) => {
    const path = join(root, "PROJECT.yaml");
    const project = readProject(root);
    project.runtime = { profile: "tiny-local", telemetry: false };
    writeFileSync(path, stringifyYaml(project), "utf8");

    beginPersistentRun(root, {
      target: "next-milestone",
      maxChapters: 8,
      runtimeProfile: "tiny-local",
      now: "2026-07-16T21:00:00Z",
    });
    assert.equal(existsSync(join(root, ".pi-book", "runs")), false);
  });
});

test("run report write failure does not cancel or roll back the authoring run", () => {
  withProject((root) => {
    mkdirSync(join(root, ".pi-book"), { recursive: true });
    writeFileSync(join(root, ".pi-book", "runs"), "not a directory", "utf8");

    const decision = beginPersistentRun(root, {
      target: "next-milestone",
      maxChapters: 8,
      runtimeProfile: "tiny-local",
      now: "2026-07-16T21:00:00Z",
    });
    assert.equal(readProject(root).automation.active_run?.status, "active");
    assert.match(decision.message, /Unable to write the local run report/);
  });
});
