import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOrganizationTransaction, pendingOrganizationTransactions } from "../src/infrastructure/organization-transaction.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-organize-txn-")); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

test("organization transaction installs verified copies, moves originals, and writes its manifest last", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "draft.md"), "draft bytes", "utf8");
    const result = applyOrganizationTransaction(root, {
      writes: [{ path: "books/book-01/manuscript/drafts/draft.md", content: "draft bytes", expectedHash: hash("draft bytes") }],
      archiveMoves: [{ sourcePath: "draft.md", archivePath: ".archive/run/files/draft.md", expectedHash: hash("draft bytes") }],
      manifest: { path: ".archive/run/manifest.yaml", content: "schema_version: 1.0.0\n" },
      archiveRoot: ".archive/run",
    });
    assert.equal(existsSync(join(root, "draft.md")), false);
    assert.equal(readFileSync(join(root, "books/book-01/manuscript/drafts/draft.md"), "utf8"), "draft bytes");
    assert.equal(readFileSync(join(root, ".archive/run/files/draft.md"), "utf8"), "draft bytes");
    assert.equal(existsSync(join(root, ".archive/run/manifest.yaml")), true);
    assert.ok(result.changed.includes("draft.md"));
    assert.deepEqual(pendingOrganizationTransactions(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("organization transaction refuses case-folded destination collisions", () => {
  const root = temp();
  try {
    mkdirSync(join(root, "Books"));
    writeFileSync(join(root, "draft.md"), "draft bytes", "utf8");
    assert.throws(() => applyOrganizationTransaction(root, {
      writes: [{ path: "books/book-01/draft.md", content: "draft bytes" }],
      archiveMoves: [{ sourcePath: "draft.md", archivePath: ".archive/run/files/draft.md", expectedHash: hash("draft bytes") }],
      manifest: { path: ".archive/run/manifest.yaml", content: "schema_version: 1.0.0\n" },
      archiveRoot: ".archive/run",
    }), /case or Unicode collision/);
    assert.equal(readFileSync(join(root, "draft.md"), "utf8"), "draft bytes");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("organization transaction rolls an archive move back when a later operation fails", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "draft.md"), "draft bytes", "utf8");
    assert.throws(() => applyOrganizationTransaction(root, {
      writes: [{ path: "books/book-01/manuscript/drafts/draft.md", content: "draft bytes", expectedHash: hash("draft bytes") }],
      archiveMoves: [{ sourcePath: "draft.md", archivePath: ".archive/run/files/draft.md", expectedHash: hash("draft bytes") }],
      manifest: { path: ".archive/run/manifest.yaml", content: "schema_version: 1.0.0\n" },
      archiveRoot: ".archive/run",
      simulateFailureAfter: 2,
    }), /Simulated/);
    assert.equal(readFileSync(join(root, "draft.md"), "utf8"), "draft bytes");
    assert.equal(existsSync(join(root, "books/book-01/manuscript/drafts/draft.md")), false);
    assert.equal(existsSync(join(root, ".archive/run")), false);
    assert.deepEqual(pendingOrganizationTransactions(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
