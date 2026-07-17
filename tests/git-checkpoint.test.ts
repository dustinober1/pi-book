import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitWorkflowEvent, gitStagedPaths } from "../src/infrastructure/git.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-git-checkpoint-")); }

test("path-only checkpoints never include unrelated staged work", () => {
  const root = temp();
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Checkpoint Test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "checkpoint@example.test"], { cwd: root });
    writeFileSync(join(root, "base.txt"), "base\n", "utf8");
    writeFileSync(join(root, "unrelated.txt"), "before\n", "utf8");
    execFileSync("git", ["add", "base.txt", "unrelated.txt"], { cwd: root });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: root, stdio: "ignore" });

    writeFileSync(join(root, "unrelated.txt"), "staged secret\n", "utf8");
    execFileSync("git", ["add", "unrelated.txt"], { cwd: root });
    writeFileSync(join(root, "organized.txt"), "organized\n", "utf8");
    const result = commitWorkflowEvent(root, ["organized.txt"], "Novel Forge: isolated checkpoint", {
      forceAdd: true,
      noVerify: true,
      onlyPaths: true,
    });

    assert.equal(result.committed, true);
    const committed = execFileSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"], { cwd: root }).toString().trim().split(/\r?\n/).filter(Boolean);
    assert.deepEqual(committed, ["organized.txt"]);
    assert.deepEqual(gitStagedPaths(root), ["unrelated.txt"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
