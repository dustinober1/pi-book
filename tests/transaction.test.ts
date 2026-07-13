import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
