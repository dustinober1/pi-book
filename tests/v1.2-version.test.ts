import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOVEL_FORGE_VERSION, versionFindings } from "../src/application/version.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-v14-version-")); }

test("new projects use the 1.5 contract and retain canonical 1.2 metadata files", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "V14", projectType: "standalone", profile: "thriller" });
    assert.equal(NOVEL_FORGE_VERSION, "1.5.0");
    assert.equal(readProject(root).novel_forge_version, "1.5.0");
    assert.equal(existsSync(join(root, "books/book-01/publishing.yaml")), true);
    assert.equal(existsSync(join(root, "books/book-01/marketing.yaml")), true);
    assert.equal(existsSync(join(root, "books/book-01/reader-kits/index.yaml")), true);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("1.2 projects warn while newer projects block", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Compatibility", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    const project12 = { ...project, novel_forge_version: "1.2.0" };
    assert.ok(versionFindings(project12).some((finding) => finding.severity === "warning" && /older/i.test(finding.message)));
    const project16 = { ...project, novel_forge_version: "1.6.0" };
    assert.ok(versionFindings(project16).some((finding) => finding.severity === "blocker" && /newer/i.test(finding.message)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
