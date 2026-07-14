import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyTransaction } from "../src/infrastructure/transaction.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-txn-")); }

test("multi-file transaction rolls back after an interrupted replacement", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "a.txt"), "old-a", "utf8");
    writeFileSync(join(root, "b.txt"), "old-b", "utf8");
    assert.throws(() => applyTransaction(root, [{ path: "a.txt", content: "new-a" }, { path: "b.txt", content: "new-b" }], { simulateFailureAfter: 1 }), /Simulated/);
    assert.equal(readFileSync(join(root, "a.txt"), "utf8"), "old-a");
    assert.equal(readFileSync(join(root, "b.txt"), "utf8"), "old-b");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a derived-file failure rolls back the primary workflow changes", () => {
  const root = temp();
  try {
    writeFileSync(join(root, "PROJECT.yaml"), "schema_version: 1.0.0\n", "utf8");
    assert.throws(() => applyTransaction(root, [{ path: "primary.txt", content: "applied" }], {
      deriveChanges() { throw new Error("derived guidance failed"); },
    }), /derived guidance failed/);
    assert.equal(existsSync(join(root, "primary.txt")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("derived files are reported as part of one successful transaction", () => {
  const root = temp();
  try {
    const result = applyTransaction(root, [{ path: "primary.txt", content: "applied" }], {
      deriveChanges() { return [{ path: "STATUS.md", content: "derived" }]; },
    });
    assert.deepEqual(result.changed, ["primary.txt", "STATUS.md"]);
    assert.equal(readFileSync(join(root, "STATUS.md"), "utf8"), "derived");
  } finally { rmSync(root, { recursive: true, force: true }); }
});