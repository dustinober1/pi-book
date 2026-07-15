import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addBook } from "../src/project/add-book.js";
import { initializeProject } from "../src/project/store.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { v13SchemaForPath } from "../src/domain/v1-3-schema-registry.js";
import { versionFindings } from "../src/application/version-core.js";
import type { ProjectState } from "../src/domain/schemas.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-v13-compat-")); }

const seriesPaths = [
  "series/taste-profile.yaml",
  "series/voice-guardrails.yaml",
  "series/voice-experiments/index.yaml",
];

function bookPaths(bookId: string): string[] {
  return [
    `books/${bookId}/research-ledger.yaml`,
    `books/${bookId}/book-strategy.yaml`,
    `books/${bookId}/voice-audits.yaml`,
  ];
}

function assertValidArtifact(root: string, path: string): void {
  assert.equal(existsSync(join(root, path)), true, `missing ${path}`);
  const schema = v13SchemaForPath(path);
  assert.ok(schema, `missing schema for ${path}`);
  const text = readFileSync(join(root, path), "utf8");
  assert.doesNotThrow(() => parseYaml(text, schema, path));
}

test("new projects seed all author research foundation artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Foundation", projectType: "planned-series", profile: "thriller" });
    for (const path of [...seriesPaths, ...bookPaths("book-01")]) assertValidArtifact(root, path);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("new books inherit empty valid book-scoped research artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Next Book", projectType: "planned-series", profile: "romantasy" });
    const bookId = addBook(root, 105000, { force: true });
    assert.equal(bookId, "book-02");
    for (const path of bookPaths(bookId)) assertValidArtifact(root, path);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a recorded 1.2 project remains readable with a non-blocking version warning", () => {
  const project: ProjectState = {
    schema_version: "1.0.0",
    novel_forge_version: "1.2.0",
    project_name: "Legacy",
    project_type: "standalone",
    active_book: "book-01",
    default_profile: "thriller",
    current_stage: "drafting",
    next_gate: null,
    gates: {},
    approvals: [],
    automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: true },
    migration_history: [],
  };
  const findings = versionFindings(project);
  assert.ok(findings.some((finding) => finding.severity === "warning" && /older/i.test(finding.message)));
  assert.ok(!findings.some((finding) => finding.severity === "blocker"));
});
