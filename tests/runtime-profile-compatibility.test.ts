import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creativeProjectStateHash } from "../src/application/project-hash.js";
import { resumePersistentRun } from "../src/application/run.js";
import { resolveRuntimeProfile } from "../src/application/runtime-profile-resolver.js";
import { ProjectV14Schema, type ProjectStateV14 } from "../src/domain/v1-4-project-schema.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function withProject(
  callback: (root: string) => void,
  runtimeProfile?: "tiny-local" | "local" | "full",
): void {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-runtime-profile-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Runtime Compatibility",
      projectType: "standalone",
      profile: "thriller",
      ...(runtimeProfile ? { runtimeProfile } : {}),
    });
    callback(root);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

test("new projects record full runtime compatibility defaults", () => {
  withProject((root) => {
    const project = readProject(root);
    assert.deepEqual(project.runtime, { profile: "full", telemetry: true });
    assert.equal(resolveRuntimeProfile({ project: project.runtime?.profile }).id, "full");
  });
});

test("new projects may record a constrained runtime profile", () => {
  withProject((root) => {
    assert.equal(readProject(root).runtime?.profile, "tiny-local");
  }, "tiny-local");
});

test("projects created before runtime configuration remain readable and resolve to full", () => {
  withProject((root) => {
    const path = join(root, "PROJECT.yaml");
    const project = parseYaml<ProjectStateV14>(readFileSync(path, "utf8"), ProjectV14Schema, "PROJECT.yaml");
    delete project.runtime;
    writeFileSync(path, stringifyYaml(project), "utf8");

    const legacy = readProject(root);
    const resolved = resolveRuntimeProfile({ project: legacy.runtime?.profile });
    assert.equal(legacy.runtime, undefined);
    assert.equal(resolved.id, "full");
  });
});

test("invalid stored runtime profile IDs fail schema validation", () => {
  withProject((root) => {
    const path = join(root, "PROJECT.yaml");
    const project = parseYaml<Record<string, unknown>>(readFileSync(path, "utf8"), undefined, "PROJECT.yaml");
    project.runtime = { profile: "small", telemetry: true };
    writeFileSync(path, stringifyYaml(project), "utf8");
    assert.throws(() => readProject(root), /runtime|schema validation/i);
  });
});

test("active runs created before runtimeProfile existed remain readable", () => {
  withProject((root) => {
    const project = readProject(root);
    project.automation.active_run = {
      id: "RUN-001",
      status: "paused",
      target: "midpoint-review",
      startedStage: project.current_stage,
      currentAction: "draft-chapter:1",
      requestedMaxChapters: 3,
      completedEventKeys: [],
      lastProjectHash: "creative-hash",
      refillCount: 0,
      retryCounts: {},
      stopReason: null,
      startedAt: "2026-07-16T12:00:00Z",
      updatedAt: "2026-07-16T12:01:00Z",
    };
    assert.doesNotThrow(() => parseYaml(stringifyYaml(project), ProjectV14Schema, "PROJECT.yaml"));
  });
});

test("invalid runtime profiles inside active runs fail schema validation", () => {
  withProject((root) => {
    const path = join(root, "PROJECT.yaml");
    const project = parseYaml<Record<string, any>>(readFileSync(path, "utf8"), undefined, "PROJECT.yaml");
    project.automation.active_run = {
      id: "RUN-001",
      status: "paused",
      target: "midpoint-review",
      startedStage: project.current_stage,
      currentAction: "draft-chapter:1",
      requestedMaxChapters: 3,
      runtimeProfile: "small",
      completedEventKeys: [],
      lastProjectHash: "creative-hash",
      refillCount: 0,
      retryCounts: {},
      stopReason: null,
      startedAt: "2026-07-16T12:00:00Z",
      updatedAt: "2026-07-16T12:01:00Z",
    };
    writeFileSync(path, stringifyYaml(project), "utf8");
    assert.throws(() => readProject(root), /runtimeProfile|schema validation/i);
  });
});

test("legacy active runs without a stored profile resume with compatibility full", () => {
  withProject((root) => {
    const path = join(root, "PROJECT.yaml");
    const project = readProject(root);
    project.runtime = { profile: "tiny-local", telemetry: true };
    project.automation.active_run = {
      id: "RUN-001",
      status: "paused",
      target: "next-milestone",
      startedStage: project.current_stage,
      currentAction: "voice",
      requestedMaxChapters: 3,
      completedEventKeys: [],
      lastProjectHash: creativeProjectStateHash(root),
      refillCount: 0,
      retryCounts: {},
      stopReason: null,
      startedAt: "2026-07-16T12:00:00Z",
      updatedAt: "2026-07-16T12:01:00Z",
    };
    writeFileSync(path, stringifyYaml(project), "utf8");

    const decision = resumePersistentRun(root, "2026-07-16T12:02:00Z");
    assert.equal(decision.runtimeProfile, "full");
    assert.match(decision.message, /Runtime profile: full/);
  }, "tiny-local");
});
