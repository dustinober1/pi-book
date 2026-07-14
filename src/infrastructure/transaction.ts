import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { parseYaml } from "./yaml.js";
import { schemaForPath } from "../domain/schemas.js";
import { commitWorkflowEvent, type GitCheckpointResult } from "./git.js";

export interface FileChange {
  path: string;
  content: string;
}

export interface TransactionOptions {
  commitMessage?: string;
  gitCheckpoint?: boolean;
  simulateFailureAfter?: number;
}

export interface TransactionResult {
  changed: string[];
  git: GitCheckpointResult | null;
}

function validateChange(change: FileChange): void {
  if (change.path.startsWith("/") || change.path.includes("..")) throw new Error(`Unsafe transaction path: ${change.path}`);
  if (/\.(yaml|yml)$/i.test(change.path)) {
    const schema = schemaForPath(change.path);
    parseYaml(change.content, schema ?? undefined, change.path);
  }
}

export function applyTransaction(root: string, changes: FileChange[], options: TransactionOptions = {}): TransactionResult {
  if (!changes.length) return { changed: [], git: null };
  const transactionRoot = join(root, `.novel-forge-txn-${randomUUID()}`);
  const stagedRoot = join(transactionRoot, "staged");
  const backupRoot = join(transactionRoot, "backup");
  mkdirSync(stagedRoot, { recursive: true });
  mkdirSync(backupRoot, { recursive: true });

  for (const change of changes) {
    validateChange(change);
    const staged = join(stagedRoot, change.path);
    mkdirSync(dirname(staged), { recursive: true });
    writeFileSync(staged, change.content, "utf8");
  }

  const applied: string[] = [];
  try {
    for (const [index, change] of changes.entries()) {
      const destination = join(root, change.path);
      const backup = join(backupRoot, change.path);
      if (existsSync(destination)) {
        mkdirSync(dirname(backup), { recursive: true });
        cpSync(destination, backup, { recursive: true });
      }
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(stagedRoot, change.path), destination);
      applied.push(change.path);
      if (options.simulateFailureAfter === index + 1) throw new Error("Simulated transaction failure");
    }
  } catch (error) {
    for (const path of [...applied].reverse()) {
      const destination = join(root, path);
      const backup = join(backupRoot, path);
      rmSync(destination, { recursive: true, force: true });
      if (existsSync(backup)) {
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(backup, destination, { recursive: true });
      }
    }
    rmSync(transactionRoot, { recursive: true, force: true });
    throw error;
  }

  rmSync(transactionRoot, { recursive: true, force: true });
  const changed = changes.map((change) => relative(root, join(root, change.path)));
  const git = options.gitCheckpoint && options.commitMessage
    ? commitWorkflowEvent(root, changed, options.commitMessage)
    : null;
  return { changed, git };
}
