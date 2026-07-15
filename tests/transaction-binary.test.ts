import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyTransaction } from "../src/infrastructure/transaction.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-binary-txn-")); }

test("binary transaction preserves exact bytes", () => {
  const root = temp();
  try {
    const bytes = Uint8Array.from([0, 1, 2, 127, 128, 255]);
    const result = applyTransaction(root, [{ path: "books/book-01/assets/test.bin", content: bytes, encoding: "binary" }]);
    assert.deepEqual(readFileSync(join(root, "books/book-01/assets/test.bin")), Buffer.from(bytes));
    assert.deepEqual(result.changed, ["books/book-01/assets/test.bin"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("binary replacement rolls back exactly after later failure", () => {
  const root = temp();
  try {
    const path = join(root, "asset.bin");
    const original = Buffer.from([9, 8, 7, 6]);
    writeFileSync(path, original);
    assert.throws(() => applyTransaction(root, [
      { path: "asset.bin", content: Uint8Array.from([1, 2, 3]), encoding: "binary" },
      { path: "later.txt", content: "fail after replacement" },
    ], { simulateFailureAfter: 2 }), /Simulated/);
    assert.deepEqual(readFileSync(path), original);
    assert.equal(existsSync(join(root, "later.txt")), false);
    assert.equal(readdirSync(root).some((name) => name.startsWith(".novel-forge-txn-")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("YAML changes cannot be binary", () => {
  const root = temp();
  try {
    assert.throws(() => applyTransaction(root, [
      { path: "bad.yaml", content: Uint8Array.from([1, 2, 3]), encoding: "binary" },
    ]), /YAML changes must be UTF-8 text/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
