import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyRepositoryOrganization } from "../src/application/organizer/apply.js";
import { renderOrganizationPreview, scanWritingRepository } from "../src/application/organizer/scan.js";
import { readBook, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-organizer-")); }
function sha(bytes: Uint8Array | string): string { return createHash("sha256").update(bytes).digest("hex"); }

function apply(root: string, now = new Date("2026-07-17T12:34:56.789Z")) {
  const preview = scanWritingRepository(root);
  return applyRepositoryOrganization(root, preview, {
    project: { projectName: "Recovered Draft", projectType: "standalone", profile: "thriller", targetWords: 90_000 },
    confirmApply: true,
    confirmArchive: true,
    confirmProvisional: true,
    now,
  });
}

test("scans mixed writing repositories read-only and protects ignored, config, generated, and symlink paths", () => {
  const root = temp();
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    writeFileSync(join(root, ".gitignore"), "ignored-note.md\n", "utf8");
    writeFileSync(join(root, "ignored-note.md"), "private ignored material", "utf8");
    writeFileSync(join(root, "package.json"), "{}\n", "utf8");
    writeFileSync(join(root, "README.md"), "# Repository\n", "utf8");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "generated.md"), "generated", "utf8");
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nThe signal arrived before dawn.\n", "utf8");
    writeFileSync(join(root, "story-outline.md"), "# Story Outline\n\nAct one breaks the alibi.\n", "utf8");
    symlinkSync(join(root, "01-opening.md"), join(root, "linked-chapter.md"));

    const before = readFileSync(join(root, "01-opening.md"));
    const preview = scanWritingRepository(root);
    assert.equal(readFileSync(join(root, "01-opening.md")).equals(before), true);
    assert.equal(existsSync(join(root, "PROJECT.yaml")), false);
    assert.equal(preview.candidates.find((item) => item.originalPath === "01-opening.md")?.category, "chapter");
    assert.equal(preview.candidates.find((item) => item.originalPath === "story-outline.md")?.confidence, "provisional");
    assert.equal(preview.candidates.find((item) => item.originalPath === "ignored-note.md")?.category, "excluded");
    assert.equal(preview.candidates.find((item) => item.originalPath === "package.json")?.category, "excluded");
    assert.equal(preview.candidates.some((item) => item.originalPath.includes("node_modules")), false);
    assert.equal(preview.candidates.some((item) => item.originalPath === "linked-chapter.md"), false);
    assert.match(renderOrganizationPreview(preview), /This preview did not change repository files/);
    assert.equal(scanWritingRepository(root).previewHash, preview.previewHash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("honors gitignore without an initialized repository and rejects nested Git repositories", () => {
  const root = temp();
  try {
    writeFileSync(join(root, ".gitignore"), "ignored-note.md\n", "utf8");
    writeFileSync(join(root, "ignored-note.md"), "private ignored material", "utf8");
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nVisible.\n", "utf8");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "SECURITY-NOTES.md"), "repository documentation", "utf8");
    const preview = scanWritingRepository(root);
    assert.equal(preview.candidates.find((item) => item.originalPath === "ignored-note.md")?.category, "excluded");
    assert.equal(preview.candidates.find((item) => item.originalPath === "docs/SECURITY-NOTES.md")?.category, "excluded");

    mkdirSync(join(root, "embedded"));
    execFileSync("git", ["init"], { cwd: join(root, "embedded"), stdio: "ignore" });
    writeFileSync(join(root, "embedded", "chapter.md"), "# Chapter 2\n\nNested.\n", "utf8");
    assert.throws(() => scanWritingRepository(root), /Nested Git repository/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("organizes in place, verifies exact bytes, archives originals, and preserves conservative workflow state", () => {
  const root = temp();
  try {
    mkdirSync(join(root, "notes"));
    mkdirSync(join(root, "research"));
    mkdirSync(join(root, "art"));
    const chapter = "# Chapter 1 - Opening\n\nThe signal arrived before dawn.\n";
    const outline = "# Plot Outline\n\nThe witness disappears at midpoint.\n";
    const research = "Research sources for harbor procedure.\n";
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    writeFileSync(join(root, "01-opening.md"), chapter, "utf8");
    writeFileSync(join(root, "notes", "outline.md"), outline, "utf8");
    writeFileSync(join(root, "research", "harbor.txt"), research, "utf8");
    writeFileSync(join(root, "art", "cover.png"), png);
    writeFileSync(join(root, "README.md"), "# Keep me\n", "utf8");

    const result = apply(root);
    assert.equal(result.organized, 4);
    assert.equal(result.archived, 4);
    assert.equal(result.chapters, 1);
    assert.equal(existsSync(join(root, "PROJECT.yaml")), true);
    assert.equal(existsSync(join(root, "01-opening.md")), false);
    assert.equal(existsSync(join(root, "README.md")), true);
    const copiedChapter = join(root, "books", "book-01", "manuscript", "chapters", "01-01-opening.md");
    assert.equal(readFileSync(copiedChapter, "utf8"), chapter);
    assert.equal(sha(readFileSync(copiedChapter)), sha(chapter));
    assert.equal(readFileSync(join(root, result.archiveRoot!, "files", "01-opening.md"), "utf8"), chapter);
    assert.equal(readFileSync(join(root, "books", "book-01", "assets", "adopted", `${sha(png).slice(0, 12)}-cover.png`)).equals(png), true);
    assert.match(readFileSync(join(root, result.manifestPath), "utf8"), /original_path: 01-opening.md/);
    assert.match(readFileSync(join(root, result.reportPath), "utf8"), /remains voice-intake/);
    assert.equal(readProject(root).current_stage, "voice-intake");
    assert.deepEqual(readProject(root).approvals, []);
    assert.equal(readBook(root).status, "planning");
    assert.equal(readBook(root).current_chapter, 1);
    assert.ok(readBook(root).actual_words > 0);
    assert.equal(result.gitMessage, "Novel Forge: organize existing repository");
    assert.match(execFileSync("git", ["log", "-1", "--pretty=%s"], { cwd: root }).toString(), /Novel Forge: organize existing repository/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("checkpoints tracked source moves without committing unrelated paths", () => {
  const root = temp();
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Organizer Test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "organizer@example.test"], { cwd: root });
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nTracked.\n", "utf8");
    writeFileSync(join(root, "package.json"), "{}\n", "utf8");
    execFileSync("git", ["add", "01-opening.md", "package.json"], { cwd: root });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: root, stdio: "ignore" });
    writeFileSync(join(root, "package.json"), "{\"private\":true}\n", "utf8");

    const result = apply(root);
    const names = execFileSync("git", ["show", "--name-status", "--pretty=format:", "HEAD"], { cwd: root }).toString();
    assert.match(names, /(?:D\s+01-opening\.md|R100\s+01-opening\.md\s+\.archive\/.+\/files\/01-opening\.md)/);
    assert.match(names, /\.archive\/.+\/files\/01-opening\.md/);
    assert.equal(execFileSync("git", ["diff", "--name-only", "HEAD", "--", "package.json"], { cwd: root }).toString().trim(), "package.json");
    assert.equal(result.gitMessage, "Novel Forge: organize existing repository");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("archives exact duplicates without manufacturing a second canonical copy", () => {
  const root = temp();
  try {
    const content = "# Chapter 1\n\nOne canonical chapter.\n";
    writeFileSync(join(root, "01-first.md"), content, "utf8");
    writeFileSync(join(root, "01-first-copy.md"), content, "utf8");
    const preview = scanWritingRepository(root);
    const duplicate = preview.candidates.find((item) => item.category === "duplicate")!;
    assert.equal(preview.candidates.filter((item) => item.category === "duplicate").length, 1);
    assert.throws(() => applyRepositoryOrganization(root, preview, {
      project: { projectName: "Orphan Duplicate", projectType: "standalone", profile: "thriller" },
      selectedCandidateIds: [duplicate.id],
      confirmApply: true,
      confirmArchive: true,
      confirmProvisional: true,
    }), /cannot be selected without its canonical source/);
    const result = applyRepositoryOrganization(root, preview, {
      project: { projectName: "Duplicates", projectType: "standalone", profile: "thriller" },
      confirmApply: true,
      confirmArchive: true,
      confirmProvisional: true,
      now: new Date("2026-07-17T12:34:56.789Z"),
    });
    assert.equal(result.organized, 1);
    assert.equal(result.archived, 2);
    assert.equal(existsSync(join(root, result.archiveRoot!, "files", "01-first.md")), true);
    assert.equal(existsSync(join(root, result.archiveRoot!, "files", "01-first-copy.md")), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("refuses pre-existing staged work before mutation", () => {
  const root = temp();
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    writeFileSync(join(root, "package.json"), "{}\n", "utf8");
    execFileSync("git", ["add", "package.json"], { cwd: root });
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nOriginal.\n", "utf8");
    const preview = scanWritingRepository(root);
    assert.throws(() => applyRepositoryOrganization(root, preview, {
      project: { projectName: "Staged", projectType: "standalone", profile: "thriller" },
      confirmApply: true,
      confirmArchive: true,
      confirmProvisional: true,
    }), /empty Git staging area/);
    assert.equal(existsSync(join(root, "PROJECT.yaml")), false);
    assert.equal(existsSync(join(root, "01-opening.md")), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects stale previews and missing destructive confirmations before mutation", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nOriginal.\n", "utf8");
    const preview = scanWritingRepository(root);
    assert.throws(() => applyRepositoryOrganization(root, preview, {
      project: { projectName: "No Confirm", projectType: "standalone", profile: "thriller" },
      confirmApply: true,
      confirmArchive: false,
      confirmProvisional: true,
    }), /archive confirmation/i);
    const tampered = structuredClone(preview);
    tampered.candidates[0]!.destination = "books/book-01/manuscript/chapters/99-tampered.md";
    assert.throws(() => applyRepositoryOrganization(root, tampered, {
      project: { projectName: "Tampered", projectType: "standalone", profile: "thriller" },
      confirmApply: true,
      confirmArchive: true,
      confirmProvisional: true,
    }), /modified after scanning/);
    writeFileSync(join(root, "01-opening.md"), "# Chapter 1\n\nChanged.\n", "utf8");
    assert.throws(() => applyRepositoryOrganization(root, preview, {
      project: { projectName: "Stale", projectType: "standalone", profile: "thriller" },
      confirmApply: true,
      confirmArchive: true,
      confirmProvisional: true,
    }), /stale/i);
    assert.equal(existsSync(join(root, "PROJECT.yaml")), false);
    assert.equal(existsSync(join(root, "01-opening.md")), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
