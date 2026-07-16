import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeProject } from "../src/project/store.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("audit:voice reports no baseline and does not mutate the project", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-cli-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 5 CLI", projectType: "standalone", profile: "thriller" });
    const projectPath = join(root, "PROJECT.yaml");
    const auditPath = join(root, "books", "book-01", "voice-audits.yaml");
    const beforeProject = readFileSync(projectPath, "utf8");
    const beforeAudits = readFileSync(auditPath, "utf8");
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/voice-audit.ts", root], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout) as { status: string; message: string };
    assert.equal(output.status, "no-baseline");
    assert.match(output.message, /baseline/i);
    assert.equal(readFileSync(projectPath, "utf8"), beforeProject);
    assert.equal(readFileSync(auditPath, "utf8"), beforeAudits);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
