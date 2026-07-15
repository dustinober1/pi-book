import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOVEL_FORGE_VERSION, versionFindings } from "../src/application/version.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-v12-version-")); }

test("new projects use the 1.2 contract and canonical metadata files", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "V12", projectType: "standalone", profile: "thriller" });
    assert.equal(NOVEL_FORGE_VERSION, "1.2.0");
    assert.equal(readProject(root).novel_forge_version, "1.2.0");
    assert.equal(existsSync(join(root, "books/book-01/publishing.yaml")), true);
    assert.equal(existsSync(join(root, "books/book-01/marketing.yaml")), true);
    assert.equal(existsSync(join(root, "books/book-01/reader-kits/index.yaml")), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("1.1 projects warn while newer projects block", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Compatibility", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.novel_forge_version = "1.1.0";
    assert.ok(versionFindings(project).some((finding) => finding.severity === "warning" && /older/i.test(finding.message)));
    project.novel_forge_version = "1.3.0";
    assert.ok(versionFindings(project).some((finding) => finding.severity === "blocker" && /newer/i.test(finding.message)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
