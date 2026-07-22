import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applyTransaction, recoverInterruptedOperationalTransactions } from "../src/infrastructure/transaction.js";

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

test("an operational tree removal rolls back when a later publication fails", () => {
  const root = temp();
  try {
    const artifact = join(root, ".pi-book", "runs", "RUN-001", "scenes", "SC-01", "draft.json");
    mkdirSync(join(root, ".pi-book", "runs", "RUN-001", "scenes", "SC-01"), { recursive: true });
    writeFileSync(artifact, "prior artifact", "utf8");
    writeFileSync(join(root, ".pi-book", "runs", "RUN-001", "manifest.json"), "prior manifest", "utf8");
    writeFileSync(join(root, ".pi-book", "runs", "RUN-001", "state.json"), "prior state", "utf8");

    assert.throws(() => applyTransaction(root, [
      { path: ".pi-book/runs/RUN-001/manifest.json", content: "new manifest" },
      { path: ".pi-book/runs/RUN-001/state.json", content: "new state" },
    ], {
      removePaths: [".pi-book/runs/RUN-001/scenes"],
      simulateFailureAfter: 3,
    }), /Simulated/);
    assert.equal(readFileSync(artifact, "utf8"), "prior artifact");
    assert.equal(readFileSync(join(root, ".pi-book", "runs", "RUN-001", "manifest.json"), "utf8"), "prior manifest");
    assert.equal(readFileSync(join(root, ".pi-book", "runs", "RUN-001", "state.json"), "utf8"), "prior state");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("operational removals reject canonical unsafe duplicate and overlapping paths", () => {
  const root = temp();
  try {
    assert.throws(() => applyTransaction(root, [], { removePaths: ["books/book-01"] }), /operational|\.pi-book/i);
    assert.throws(() => applyTransaction(root, [], { removePaths: [".pi-book/../books"] }), /unsafe|operational/i);
    assert.throws(() => applyTransaction(root, [], {
      removePaths: [".pi-book/runs/RUN-001/scenes", ".pi-book/runs/RUN-001/scenes"],
    }), /duplicate/i);
    assert.throws(() => applyTransaction(root, [{
      path: ".pi-book/runs/RUN-001/scenes/new.json",
      content: "new",
    }], {
      removePaths: [".pi-book/runs/RUN-001/scenes"],
    }), /overlap/i);
    assert.throws(() => applyTransaction(root, [], {
      removePaths: [".pi-book/foo/stale.json"],
    }), /runtime root|runs|cache|index/i);
    assert.throws(() => applyTransaction(root, [], {
      replacePaths: [".pi-book/foo/capsules"],
    }), /runtime root|runs|cache|index/i);
    assert.throws(() => applyTransaction(root, [{
      path: ".pi-book/foo/new.json",
      content: "new",
    }], {
      removePaths: [".pi-book/runs/RUN-001/scenes"],
    }), /runtime root|runs|cache|index/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a live operational owner blocks a competing publication without disturbing its journal", () => {
  const root = temp();
  try {
    const journalRoot = join(root, ".pi-book", "transactions");
    const lockRoot = join(journalRoot, "lock");
    const transactionRoot = join(journalRoot, `TXN-${"a".repeat(32)}`);
    const owner = { pid: process.pid, token: "b".repeat(32) };
    const checkpoint = join(root, ".pi-book", "runs", "RUN-001", "manifest.json");
    const stateCheckpoint = join(root, ".pi-book", "runs", "RUN-001", "state.json");
    mkdirSync(lockRoot, { recursive: true });
    mkdirSync(transactionRoot, { recursive: true });
    mkdirSync(join(root, ".pi-book", "runs", "RUN-001"), { recursive: true });
    writeFileSync(join(lockRoot, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, "utf8");
    writeFileSync(join(transactionRoot, "journal.json"), `${JSON.stringify({
      schema_version: "1.0.0",
      owner,
      state: "applying",
      writes: [],
      retired: [],
    }, null, 2)}\n`, "utf8");
    writeFileSync(checkpoint, "live checkpoint", "utf8");
    writeFileSync(stateCheckpoint, "live state checkpoint", "utf8");

    assert.throws(() => applyTransaction(root, [
      { path: ".pi-book/runs/RUN-001/manifest.json", content: "competing checkpoint" },
      { path: ".pi-book/runs/RUN-001/state.json", content: "competing state checkpoint" },
    ], {
      removePaths: [".pi-book/runs/RUN-001/scenes"],
    }), /lock.*live|live.*operational.*owner|live process/i);
    assert.equal(readFileSync(checkpoint, "utf8"), "live checkpoint");
    assert.equal(readFileSync(stateCheckpoint, "utf8"), "live state checkpoint");
    assert.equal(existsSync(transactionRoot), true);
    assert.equal(existsSync(lockRoot), true);
    assert.deepEqual(JSON.parse(readFileSync(join(lockRoot, "owner.json"), "utf8")), owner);

    rmSync(lockRoot, { recursive: true, force: true });
    assert.throws(
      () => recoverInterruptedOperationalTransactions(root),
      /journal.*live process|live.*operational.*owner/i,
    );
    assert.equal(readFileSync(checkpoint, "utf8"), "live checkpoint");
    assert.equal(readFileSync(stateCheckpoint, "utf8"), "live state checkpoint");
    assert.equal(existsSync(transactionRoot), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("stale takeover keeps the displaced lock sentinel for the replacement lock lifetime", () => {
  const root = temp();
  try {
    const journalRoot = join(root, ".pi-book", "transactions");
    const oldToken = "d".repeat(32);
    const lockRoot = join(journalRoot, "lock");
    const staleSentinel = join(journalRoot, `.stale-lock-${oldToken}`);
    const scene = join(root, ".pi-book", "runs", "RUN-001", "scenes", "SC-01", "draft.json");
    mkdirSync(lockRoot, { recursive: true });
    mkdirSync(join(root, ".pi-book", "runs", "RUN-001", "scenes", "SC-01"), { recursive: true });
    writeFileSync(join(lockRoot, "owner.json"), `${JSON.stringify({ pid: 999999999, token: oldToken }, null, 2)}\n`, "utf8");
    writeFileSync(scene, "prior scene", "utf8");

    const moduleUrl = pathToFileURL(join(process.cwd(), "src", "infrastructure", "transaction.ts")).href;
    const script = [
      `import { applyTransaction } from ${JSON.stringify(moduleUrl)};`,
      `applyTransaction(${JSON.stringify(root)}, [`,
      `{ path: ".pi-book/runs/RUN-001/manifest.json", content: "new manifest" }`,
      `], { removePaths: [".pi-book/runs/RUN-001/scenes"], simulateProcessExitAfter: 1 });`,
    ].join("\n");
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(child.status, 86, child.stderr || child.stdout);
    assert.equal(existsSync(staleSentinel), true, "the old-token sentinel must block cached stale contenders");

    applyTransaction(root, [{ path: ".pi-book/runs/RUN-001/recovery-proof.json", content: "recovered" }]);
    assert.equal(readFileSync(scene, "utf8"), "prior scene");
    assert.equal(readdirSync(journalRoot).some((name) => name.startsWith(".stale-lock-")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a hard process exit after quarantine and partial publication recovers exact prior operational state", () => {
  const root = temp();
  try {
    const runRoot = join(root, ".pi-book", "runs", "RUN-001");
    const oldScene = join(runRoot, "scenes", "SC-01", "draft.json");
    const oldCapsule = join(runRoot, "capsules", "CAP-OLD.json");
    const manifest = join(runRoot, "manifest.json");
    const state = join(runRoot, "state.json");
    mkdirSync(join(runRoot, "scenes", "SC-01"), { recursive: true });
    mkdirSync(join(runRoot, "capsules"), { recursive: true });
    writeFileSync(oldScene, "prior scene", "utf8");
    writeFileSync(oldCapsule, "prior capsule", "utf8");
    writeFileSync(manifest, "prior manifest", "utf8");
    writeFileSync(state, "prior state", "utf8");

    const moduleUrl = pathToFileURL(join(process.cwd(), "src", "infrastructure", "transaction.ts")).href;
    const script = [
      `import { applyTransaction } from ${JSON.stringify(moduleUrl)};`,
      `applyTransaction(${JSON.stringify(root)}, [`,
      `{ path: ".pi-book/runs/RUN-001/capsules/CAP-NEW.json", content: "new capsule" },`,
      `{ path: ".pi-book/runs/RUN-001/manifest.json", content: "new manifest" },`,
      `{ path: ".pi-book/runs/RUN-001/state.json", content: "new state" }`,
      `], { removePaths: [".pi-book/runs/RUN-001/scenes"], replacePaths: [".pi-book/runs/RUN-001/capsules"], simulateProcessExitAfter: 4 });`,
    ].join("\n");
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(child.status, 86, child.stderr || child.stdout);

    applyTransaction(root, [{ path: ".pi-book/runs/RUN-001/recovery-proof.json", content: "recovered" }]);
    assert.equal(readFileSync(oldScene, "utf8"), "prior scene");
    assert.equal(readFileSync(oldCapsule, "utf8"), "prior capsule");
    assert.equal(readFileSync(manifest, "utf8"), "prior manifest");
    assert.equal(readFileSync(state, "utf8"), "prior state");
    assert.equal(existsSync(join(runRoot, "capsules", "CAP-NEW.json")), false);
    assert.equal(readFileSync(join(runRoot, "recovery-proof.json"), "utf8"), "recovered");
    const journalRoot = join(root, ".pi-book", "transactions");
    assert.ok(!existsSync(journalRoot) || readdirSync(journalRoot).length === 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("recovery rejects an untrusted journal that targets a canonical path", () => {
  const root = temp();
  try {
    const canonical = join(root, "PROJECT.yaml");
    writeFileSync(canonical, "canonical project\n", "utf8");
    const transactionRoot = join(root, ".pi-book", "transactions", `TXN-${"a".repeat(32)}`);
    mkdirSync(transactionRoot, { recursive: true });
    writeFileSync(join(transactionRoot, "journal.json"), `${JSON.stringify({
      schema_version: "1.0.0",
      owner: { pid: 999999999, token: "c".repeat(32) },
      state: "applying",
      writes: [{ path: "PROJECT.yaml", had_original: true, covered_by_retired: false }],
      retired: [],
    }, null, 2)}\n`, "utf8");

    assert.throws(() => applyTransaction(root, []), /journal.*operational|unsafe.*journal|\.pi-book/i);
    assert.equal(readFileSync(canonical, "utf8"), "canonical project\n");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("operational transaction journals are gitignored", () => {
  const result = spawnSync("git", ["check-ignore", "--no-index", ".pi-book/transactions/journal.json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
