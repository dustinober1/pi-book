import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getProjectStatus } from "../src/application/status.js";
import { upgradeProjectVersion } from "../src/application/version.js";
import { addBook } from "../src/project/add-book.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-v13-compat-")); }

const seriesArtifacts = [
  "series/taste-profile.yaml",
  "series/voice-guardrails.yaml",
  "series/voice-experiments/index.yaml",
];

const bookArtifacts = [
  "research-ledger.yaml",
  "book-strategy.yaml",
  "voice-audits.yaml",
];

const optionalArtifacts = [
  ...seriesArtifacts,
  ...bookArtifacts.map((path) => `books/book-01/${path}`),
];

function removeOptionalArtifacts(root: string): void {
  for (const path of optionalArtifacts) unlinkSync(join(root, path));
}

function recordVersion(root: string, version: string): void {
  const project = readProject(root);
  project.novel_forge_version = version;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
}

test("new projects seed all Novel Forge 1.3 evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Taste Test", projectType: "standalone", profile: "thriller" });
    for (const path of seriesArtifacts) assert.equal(existsSync(join(root, path)), true, path);
    for (const path of bookArtifacts) assert.equal(existsSync(join(root, "books", "book-01", path)), true, path);
    assert.equal(readProject(root).novel_forge_version, "1.7.0");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("newly added books receive the book-level 1.3 evidence artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Series Taste", projectType: "planned-series", profile: "romantasy" });
    assert.equal(addBook(root, 105000, { force: true }), "book-02");
    for (const path of bookArtifacts) assert.equal(existsSync(join(root, "books", "book-02", path)), true, path);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("a 1.2 project without 1.3 artifacts remains unblocked and receives one optional-backfill warning", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Legacy Research", projectType: "standalone", profile: "thriller" });
    removeOptionalArtifacts(root);
    recordVersion(root, "1.2.0");

    const status = getProjectStatus(root);
    for (const path of optionalArtifacts) assert.equal(status.blockers.some((item) => item.includes(path)), false, path);
    const setupWarnings = status.warnings.filter((item) => /Optional Novel Forge 1\.3 research setup/i.test(item));
    assert.equal(setupWarnings.length, 1);
    for (const path of optionalArtifacts) assert.match(setupWarnings[0] ?? "", new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("metadata upgrade does not hide missing optional 1.3 evidence", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Legacy Upgrade", projectType: "standalone", profile: "romantasy" });
    removeOptionalArtifacts(root);
    recordVersion(root, "1.2.0");

    assert.equal(upgradeProjectVersion(root), "1.7.0");
    assert.equal(readProject(root).novel_forge_version, "1.7.0");
    assert.ok(getProjectStatus(root).warnings.some((item) => /Optional Novel Forge 1\.3 research setup/i.test(item)));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
