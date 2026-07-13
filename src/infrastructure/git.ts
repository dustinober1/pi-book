import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface GitCheckpointResult {
  initialized: boolean;
  committed: boolean;
  message: string;
}

function run(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

export function ensureGit(root: string): boolean {
  try {
    if (run(root, ["rev-parse", "--is-inside-work-tree"]) === "true") return true;
  } catch {
    // Initialize below.
  }
  try {
    run(root, ["init"]);
    return existsSync(join(root, ".git"));
  } catch {
    return false;
  }
}

export function gitState(root: string): { initialized: boolean; branch: string; dirty: number } {
  try {
    if (run(root, ["rev-parse", "--is-inside-work-tree"]) !== "true") return { initialized: false, branch: "", dirty: 0 };
    const branch = run(root, ["branch", "--show-current"]);
    const dirty = run(root, ["status", "--porcelain"]).split(/\r?\n/).filter(Boolean).length;
    return { initialized: true, branch, dirty };
  } catch {
    return { initialized: false, branch: "", dirty: 0 };
  }
}

export function commitWorkflowEvent(root: string, relativePaths: string[], message: string): GitCheckpointResult {
  if (!ensureGit(root)) return { initialized: false, committed: false, message: "Git initialization failed; files were written without a checkpoint." };
  try {
    if (relativePaths.length) run(root, ["add", "--", ...relativePaths]);
    const staged = run(root, ["diff", "--cached", "--name-only"]);
    if (!staged) return { initialized: true, committed: false, message: "No staged changes required a checkpoint." };
    run(root, ["commit", "-m", message]);
    return { initialized: true, committed: true, message };
  } catch (error) {
    return {
      initialized: true,
      committed: false,
      message: `Files were written, but Git checkpoint failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
