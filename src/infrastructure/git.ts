import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface GitCheckpointResult { initialized: boolean; committed: boolean; message: string }
export interface GitHeadInfo { sha: string; subject: string }
export interface GitCheckpointOptions { forceAdd?: boolean; noVerify?: boolean; onlyPaths?: boolean }

function run(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function commitArgs(root: string, message: string, options: GitCheckpointOptions = {}, paths: string[] = []): string[] {
  const commit = [
    "commit",
    ...(options.noVerify ? ["--no-verify"] : []),
    ...(options.onlyPaths ? ["--only"] : []),
    "-m", message,
    ...(options.onlyPaths && paths.length ? ["--", ...paths] : []),
  ];
  try {
    if (run(root, ["config", "user.name"]) && run(root, ["config", "user.email"])) return commit;
  } catch {}
  return [
    "-c", "user.name=Novel Forge",
    "-c", "user.email=novel-forge@localhost",
    ...commit,
  ];
}

export function ensureGit(root: string): boolean {
  try { if (run(root, ["rev-parse", "--is-inside-work-tree"]) === "true") return true; } catch {}
  try { run(root, ["init"]); return existsSync(join(root, ".git")); } catch { return false; }
}

export function gitState(root: string): { initialized: boolean; branch: string; dirty: number } {
  try {
    if (run(root, ["rev-parse", "--is-inside-work-tree"]) !== "true") return { initialized: false, branch: "", dirty: 0 };
    const branch = run(root, ["branch", "--show-current"]);
    const dirty = run(root, ["status", "--porcelain"]).split(/\r?\n/).filter(Boolean).length;
    return { initialized: true, branch, dirty };
  } catch { return { initialized: false, branch: "", dirty: 0 }; }
}

export function gitHeadInfo(root: string): GitHeadInfo | null {
  try {
    return { sha: run(root, ["rev-parse", "HEAD"]), subject: run(root, ["log", "-1", "--pretty=%s"]) };
  } catch { return null; }
}

export function gitTopLevel(root: string): string | null {
  try { return run(root, ["rev-parse", "--show-toplevel"]); }
  catch { return null; }
}

export function gitStagedPaths(root: string): string[] {
  try { return run(root, ["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean); }
  catch { return []; }
}

export function gitTrackedPaths(root: string, paths: string[]): string[] {
  if (!paths.length) return [];
  try { return run(root, ["--literal-pathspecs", "ls-files", "-z", "--", ...paths]).split("\0").filter(Boolean); }
  catch { return []; }
}

export function beginRevertHead(root: string): GitHeadInfo {
  const head = gitHeadInfo(root);
  if (!head) throw new Error("Git HEAD is unavailable; nothing can be undone safely.");
  run(root, ["revert", "--no-commit", "HEAD"]);
  return head;
}

export function abortRevert(root: string): void {
  try { run(root, ["revert", "--abort"]); } catch {}
}

export function commitWorkflowEvent(root: string, relativePaths: string[], message: string, options: GitCheckpointOptions = {}): GitCheckpointResult {
  if (!ensureGit(root)) return { initialized: false, committed: false, message: "Git initialization failed; files were written without a checkpoint." };
  try {
    if (relativePaths.length) run(root, ["--literal-pathspecs", "add", ...(options.forceAdd ? ["-f"] : []), "--", ...relativePaths]);
    const staged = run(root, ["diff", "--cached", "--name-only"]);
    if (!staged) return { initialized: true, committed: false, message: "No staged changes required a checkpoint." };
    const commit = commitArgs(root, message, options, relativePaths);
    run(root, options.onlyPaths ? ["--literal-pathspecs", ...commit] : commit);
    return { initialized: true, committed: true, message };
  } catch (error) {
    if (relativePaths.length) {
      try { run(root, ["--literal-pathspecs", "reset", "--mixed", "HEAD", "--", ...relativePaths]); }
      catch {
        try { run(root, ["--literal-pathspecs", "rm", "--cached", "-r", "--ignore-unmatch", "--", ...relativePaths]); }
        catch {}
      }
    }
    return { initialized: true, committed: false, message: `Files were written, but Git checkpoint failed and organizer paths were unstaged: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function createPreMigrationTag(root: string): string | null {
  const state = gitState(root);
  if (!state.initialized || state.dirty) return null;
  try {
    run(root, ["rev-parse", "HEAD"]);
    const tag = `novel-forge-pre-migration-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    run(root, ["tag", tag]);
    return tag;
  } catch { return null; }
}