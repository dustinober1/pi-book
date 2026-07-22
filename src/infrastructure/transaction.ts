import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { validateCanonicalStoryTransaction } from "../application/canonical-story-transaction-validation.js";
import { parseYaml } from "./yaml.js";
import { schemaForPath } from "../domain/schemas.js";
import { v12SchemaForPath } from "../domain/v1-2-schema-registry.js";
import { v13SchemaForPath } from "../domain/v1-3-schema-registry.js";
import { v14SchemaForPath } from "../domain/v1-4-schema-registry.js";
import { v15SchemaForPath } from "../domain/v1-5-schema-registry.js";
import { commitWorkflowEvent, type GitCheckpointResult } from "./git.js";

export interface FileChange { path: string; content: string; encoding?: "utf8" }
export interface BinaryFileChange { path: string; content: Uint8Array; encoding: "binary" }
export type TransactionFileChange = FileChange | BinaryFileChange;

export interface TransactionOptions {
  commitMessage?: string;
  gitCheckpoint?: boolean;
  simulateFailureAfter?: number;
  deriveChanges?: () => TransactionFileChange[];
}

export interface TransactionResult {
  changed: string[];
  git: GitCheckpointResult | null;
}

function validateChange(change: TransactionFileChange): void {
  if (change.path.startsWith("/") || change.path.includes("..")) throw new Error(`Unsafe transaction path: ${change.path}`);
  if (/\.(yaml|yml)$/i.test(change.path)) {
    if (typeof change.content !== "string") throw new Error(`YAML changes must be UTF-8 text: ${change.path}`);
    const schema = v15SchemaForPath(change.path) ?? v14SchemaForPath(change.path) ?? v13SchemaForPath(change.path) ?? v12SchemaForPath(change.path) ?? schemaForPath(change.path);
    parseYaml(change.content, schema ?? undefined, change.path);
  }
}

export function applyTransaction(root: string, changes: TransactionFileChange[], options: TransactionOptions = {}): TransactionResult {
  if (!changes.length && !options.deriveChanges) return { changed: [], git: null };
  const transactionRoot = join(root, `.novel-forge-txn-${randomUUID()}`);
  const stagedRoot = join(transactionRoot, "staged");
  const backupRoot = join(transactionRoot, "backup");
  mkdirSync(stagedRoot, { recursive: true });
  mkdirSync(backupRoot, { recursive: true });

  const allChanges: TransactionFileChange[] = [];
  const knownPaths = new Set<string>();
  const applied: string[] = [];
  let appliedCount = 0;

  function stage(batch: TransactionFileChange[]): void {
    for (const change of batch) {
      validateChange(change);
      if (knownPaths.has(change.path)) throw new Error(`Duplicate transaction path: ${change.path}`);
      knownPaths.add(change.path);
      allChanges.push(change);
      const staged = join(stagedRoot, change.path);
      mkdirSync(dirname(staged), { recursive: true });
      if (typeof change.content === "string") writeFileSync(staged, change.content, "utf8");
      else writeFileSync(staged, change.content);
    }
  }

  function apply(batch: TransactionFileChange[]): void {
    for (const change of batch) {
      const destination = join(root, change.path);
      const backup = join(backupRoot, change.path);
      if (existsSync(destination)) {
        mkdirSync(dirname(backup), { recursive: true });
        cpSync(destination, backup, { recursive: true });
      }
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(stagedRoot, change.path), destination);
      applied.push(change.path);
      appliedCount += 1;
      if (options.simulateFailureAfter === appliedCount) throw new Error("Simulated transaction failure");
    }
  }

  try {
    stage(changes);
    validateCanonicalStoryTransaction(root, changes);
    apply(changes);
    const derived = options.deriveChanges?.() ?? [];
    if (derived.length) {
      stage(derived);
      validateCanonicalStoryTransaction(root, [...changes, ...derived]);
      apply(derived);
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
  const changed = allChanges.map((change) => relative(root, join(root, change.path)));
  const git = options.gitCheckpoint && options.commitMessage
    ? commitWorkflowEvent(root, changed, options.commitMessage)
    : null;
  return { changed, git };
}
