import {
  closeSync,
  cpSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  removePaths?: string[];
  replacePaths?: string[];
  simulateProcessExitAfter?: number;
}

export interface TransactionResult {
  changed: string[];
  git: GitCheckpointResult | null;
}

interface JournalWrite {
  path: string;
  had_original: boolean;
  covered_by_retired: boolean;
}

interface JournalRetired {
  path: string;
  had_original: boolean;
}

interface OperationalTransactionOwner {
  pid: number;
  token: string;
}

interface OperationalTransactionJournal {
  schema_version: "1.0.0";
  owner: OperationalTransactionOwner;
  state: "prepared" | "applying" | "committed";
  writes: JournalWrite[];
  retired: JournalRetired[];
}

const TRANSACTION_NAME = /^TXN-[a-f0-9]{32}$/;
const OWNER_TOKEN = /^[a-f0-9]{32}$/;
const OPERATIONAL_RUNTIME_ROOTS = new Set(["runs", "cache", "index"]);

function validateChange(change: TransactionFileChange): void {
  if (change.path.startsWith("/") || change.path.includes("..")) throw new Error(`Unsafe transaction path: ${change.path}`);
  if (/\.(yaml|yml)$/i.test(change.path)) {
    if (typeof change.content !== "string") throw new Error(`YAML changes must be UTF-8 text: ${change.path}`);
    const schema = v15SchemaForPath(change.path) ?? v14SchemaForPath(change.path) ?? v13SchemaForPath(change.path) ?? v12SchemaForPath(change.path) ?? schemaForPath(change.path);
    parseYaml(change.content, schema ?? undefined, change.path);
  }
}

function validateOperationalPath(path: string, source: "request" | "journal"): void {
  const parts = path.split("/");
  if (path.startsWith("/") || path.includes("\\") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe operational ${source} path: ${path}`);
  }
  if (parts[0] === ".pi-book" && parts[1] === "transactions") {
    throw new Error(`Operational ${source} paths cannot target transaction journals: ${path}`);
  }
  if (parts[0] !== ".pi-book" || parts.length < 3 || !OPERATIONAL_RUNTIME_ROOTS.has(parts[1]!)) {
    throw new Error(`Operational ${source} paths must stay below the .pi-book/runs/, .pi-book/cache/, or .pi-book/index/ runtime roots: ${path}`);
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isBelow(path: string, parent: string): boolean {
  return path.startsWith(`${parent}/`);
}

function transactionJournalRoot(root: string): string {
  return join(root, ".pi-book", "transactions");
}

function syncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function syncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function writeJournal(transactionRoot: string, journal: OperationalTransactionJournal): void {
  const path = join(transactionRoot, "journal.json");
  const temporary = join(transactionRoot, `.journal.${randomUUID()}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(journal, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  syncFile(temporary);
  renameSync(temporary, path);
  syncDirectory(transactionRoot);
}

function objectWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function parseOwner(value: unknown, source: "lock" | "journal"): OperationalTransactionOwner {
  if (!objectWithKeys(value, ["pid", "token"])
    || !Number.isSafeInteger(value.pid)
    || Number(value.pid) <= 0
    || typeof value.token !== "string"
    || !OWNER_TOKEN.test(value.token)) {
    throw new Error(`Operational transaction ${source} owner is invalid.`);
  }
  return { pid: Number(value.pid), token: value.token };
}

function processIsLive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error;
  }
}

function lockRoot(root: string): string {
  return join(transactionJournalRoot(root), "lock");
}

function readLockOwner(path: string): OperationalTransactionOwner {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(path, "owner.json"), "utf8")) as unknown;
  } catch (error) {
    throw new Error("Operational transaction lock owner is unreadable.", { cause: error });
  }
  return parseOwner(value, "lock");
}

function sameOwner(left: OperationalTransactionOwner, right: OperationalTransactionOwner): boolean {
  return left.pid === right.pid && left.token === right.token;
}

function lockConflict(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST" || code === "ENOTEMPTY" || code === "EISDIR";
}

function cleanupStaleLocks(journalRoot: string): void {
  for (const entry of readdirSync(journalRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(".stale-lock-")) {
      rmSync(join(journalRoot, entry.name), { recursive: true, force: true });
    }
  }
}

function acquireOperationalTransactionLock(root: string): OperationalTransactionOwner {
  const journalRoot = transactionJournalRoot(root);
  mkdirSync(journalRoot, { recursive: true });
  const owner: OperationalTransactionOwner = {
    pid: process.pid,
    token: randomUUID().replace(/-/g, ""),
  };
  const candidate = join(journalRoot, `.lock-candidate-${owner.token}`);
  mkdirSync(candidate);
  writeFileSync(join(candidate, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  syncFile(join(candidate, "owner.json"));
  syncDirectory(candidate);

  try {
    for (;;) {
      try {
        renameSync(candidate, lockRoot(root));
        syncDirectory(journalRoot);
        return owner;
      } catch (error) {
        if (!lockConflict(error)) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT" && !existsSync(lockRoot(root))) continue;
          throw error;
        }
      }

      const current = readLockOwner(lockRoot(root));
      if (processIsLive(current.pid)) {
        throw new Error(`Operational transaction lock is held by live process ${current.pid}.`);
      }
      const stale = join(journalRoot, `.stale-lock-${current.token}`);
      try {
        renameSync(lockRoot(root), stale);
        syncDirectory(journalRoot);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || lockConflict(error)) continue;
        throw error;
      }
      const displaced = readLockOwner(stale);
      if (!sameOwner(displaced, current)) {
        throw new Error("Operational transaction lock changed during stale-owner takeover.");
      }
    }
  } catch (error) {
    rmSync(candidate, { recursive: true, force: true });
    throw error;
  }
}

function releaseOperationalTransactionLock(root: string, owner: OperationalTransactionOwner): void {
  const current = readLockOwner(lockRoot(root));
  if (!sameOwner(current, owner)) {
    throw new Error("Operational transaction lock token changed before release.");
  }
  const released = join(transactionJournalRoot(root), `.released-lock-${owner.token}`);
  renameSync(lockRoot(root), released);
  const displaced = readLockOwner(released);
  if (!sameOwner(displaced, owner)) {
    throw new Error("Operational transaction lock token changed during release.");
  }
  cleanupStaleLocks(transactionJournalRoot(root));
  rmSync(released, { recursive: true, force: true });
  syncDirectory(transactionJournalRoot(root));
}

function parseJournal(transactionRoot: string): OperationalTransactionJournal {
  const path = join(transactionRoot, "journal.json");
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Interrupted operational transaction journal is unreadable.", { cause: error });
  }
  if (!objectWithKeys(value, ["owner", "retired", "schema_version", "state", "writes"])
    || value.schema_version !== "1.0.0"
    || !["prepared", "applying", "committed"].includes(String(value.state))
    || !Array.isArray(value.writes)
    || !Array.isArray(value.retired)) {
    throw new Error("Interrupted operational transaction journal is invalid.");
  }
  const owner = parseOwner(value.owner, "journal");
  const writes: JournalWrite[] = value.writes.map((entry) => {
    if (!objectWithKeys(entry, ["covered_by_retired", "had_original", "path"])
      || typeof entry.path !== "string"
      || typeof entry.had_original !== "boolean"
      || typeof entry.covered_by_retired !== "boolean") {
      throw new Error("Interrupted operational transaction journal has an invalid write entry.");
    }
    validateOperationalPath(entry.path, "journal");
    return { path: entry.path, had_original: entry.had_original, covered_by_retired: entry.covered_by_retired };
  });
  const retired: JournalRetired[] = value.retired.map((entry) => {
    if (!objectWithKeys(entry, ["had_original", "path"])
      || typeof entry.path !== "string"
      || typeof entry.had_original !== "boolean") {
      throw new Error("Interrupted operational transaction journal has an invalid retired entry.");
    }
    validateOperationalPath(entry.path, "journal");
    return { path: entry.path, had_original: entry.had_original };
  });
  if (new Set(writes.map((entry) => entry.path)).size !== writes.length
    || new Set(retired.map((entry) => entry.path)).size !== retired.length) {
    throw new Error("Interrupted operational transaction journal repeats a path.");
  }
  for (let index = 0; index < retired.length; index += 1) {
    if (retired.slice(index + 1).some((entry) => pathsOverlap(retired[index]!.path, entry.path))) {
      throw new Error("Interrupted operational transaction journal has overlapping retired paths.");
    }
  }
  for (const write of writes) {
    const covered = retired.some((entry) => isBelow(write.path, entry.path));
    if (write.covered_by_retired !== covered) {
      throw new Error("Interrupted operational transaction journal has inconsistent path coverage.");
    }
  }
  const journal: OperationalTransactionJournal = {
    schema_version: "1.0.0",
    owner,
    state: value.state as OperationalTransactionJournal["state"],
    writes,
    retired,
  };
  for (const entry of retired) {
    if (entry.had_original && !existsSync(join(transactionRoot, "backup", entry.path))) {
      throw new Error("Interrupted operational transaction journal is missing a retired-path backup.");
    }
  }
  for (const entry of writes) {
    if (entry.had_original && !entry.covered_by_retired && !existsSync(join(transactionRoot, "backup", entry.path))) {
      throw new Error("Interrupted operational transaction journal is missing a write-path backup.");
    }
  }
  return journal;
}

function restoreJournal(root: string, transactionRoot: string, journal: OperationalTransactionJournal): void {
  for (const entry of [...journal.writes].reverse()) {
    rmSync(join(root, entry.path), { recursive: true, force: true });
  }
  for (const entry of [...journal.retired].reverse()) {
    rmSync(join(root, entry.path), { recursive: true, force: true });
  }
  for (const entry of journal.retired) {
    if (!entry.had_original) continue;
    const destination = join(root, entry.path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(transactionRoot, "backup", entry.path), destination, { recursive: true });
  }
  for (const entry of journal.writes) {
    if (!entry.had_original || entry.covered_by_retired) continue;
    const destination = join(root, entry.path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(transactionRoot, "backup", entry.path), destination, { recursive: true });
  }
}

function recoverInterruptedOperationalTransactionsWhileLocked(root: string): string[] {
  const journalRoot = transactionJournalRoot(root);
  const recovered: string[] = [];
  const entries = readdirSync(journalRoot, { withFileTypes: true })
    .filter((entry) => TRANSACTION_NAME.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (!entry.isDirectory()) throw new Error(`Interrupted operational transaction ${entry.name} is not a directory.`);
    const transactionRoot = join(journalRoot, entry.name);
    const journalPath = join(transactionRoot, "journal.json");
    if (!existsSync(journalPath)) {
      rmSync(transactionRoot, { recursive: true, force: true });
      recovered.push(entry.name);
      continue;
    }
    const journal = parseJournal(transactionRoot);
    if (processIsLive(journal.owner.pid)) {
      throw new Error(`Interrupted operational transaction journal belongs to live process ${journal.owner.pid}.`);
    }
    if (journal.state !== "committed") restoreJournal(root, transactionRoot, journal);
    rmSync(transactionRoot, { recursive: true, force: true });
    recovered.push(entry.name);
  }
  return recovered;
}

export function recoverInterruptedOperationalTransactions(root: string): string[] {
  const journalRoot = transactionJournalRoot(root);
  if (!existsSync(journalRoot)) return [];
  const owner = acquireOperationalTransactionLock(root);
  try {
    return recoverInterruptedOperationalTransactionsWhileLocked(root);
  } finally {
    releaseOperationalTransactionLock(root, owner);
  }
}

function applyStandardTransaction(root: string, changes: TransactionFileChange[], options: TransactionOptions): TransactionResult {
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

function validateOperationalRequest(
  changes: TransactionFileChange[],
  removePaths: readonly string[],
  replacePaths: readonly string[],
): void {
  for (const change of changes) {
    validateChange(change);
    validateOperationalPath(change.path, "request");
  }
  const retired = [...removePaths, ...replacePaths];
  for (const path of retired) validateOperationalPath(path, "request");
  if (new Set(retired).size !== retired.length) throw new Error("Duplicate operational retirement path.");
  for (let index = 0; index < retired.length; index += 1) {
    if (retired.slice(index + 1).some((path) => pathsOverlap(retired[index]!, path))) {
      throw new Error(`Overlapping operational retirement paths: ${retired[index]}.`);
    }
  }
  for (const change of changes) {
    if (removePaths.some((path) => pathsOverlap(path, change.path))) {
      throw new Error(`Transaction write overlaps operational removal path: ${change.path}`);
    }
    const replacementOverlap = replacePaths.find((path) => pathsOverlap(path, change.path));
    if (replacementOverlap && !isBelow(change.path, replacementOverlap)) {
      throw new Error(`Transaction write does not stay below operational replacement path: ${change.path}`);
    }
  }
}

function applyRecoverableOperationalTransaction(
  root: string,
  changes: TransactionFileChange[],
  options: TransactionOptions,
  removePaths: string[],
  replacePaths: string[],
  owner: OperationalTransactionOwner,
): TransactionResult {
  if (options.deriveChanges || options.gitCheckpoint || options.commitMessage) {
    throw new Error("Recoverable operational transactions cannot derive or checkpoint canonical changes.");
  }
  validateOperationalRequest(changes, removePaths, replacePaths);
  const name = `TXN-${randomUUID().replace(/-/g, "")}`;
  const transactionRoot = join(transactionJournalRoot(root), name);
  const stagedRoot = join(transactionRoot, "staged");
  const backupRoot = join(transactionRoot, "backup");
  mkdirSync(stagedRoot, { recursive: true });
  mkdirSync(backupRoot, { recursive: true });
  const retiredPaths = [...removePaths, ...replacePaths];
  const retired: JournalRetired[] = retiredPaths.map((path) => ({ path, had_original: existsSync(join(root, path)) }));
  const writes: JournalWrite[] = [];

  try {
    const seen = new Set<string>();
    for (const change of changes) {
      if (seen.has(change.path)) throw new Error(`Duplicate transaction path: ${change.path}`);
      seen.add(change.path);
      const staged = join(stagedRoot, change.path);
      mkdirSync(dirname(staged), { recursive: true });
      if (typeof change.content === "string") writeFileSync(staged, change.content, "utf8");
      else writeFileSync(staged, change.content);
      const covered = retiredPaths.some((path) => isBelow(change.path, path));
      writes.push({ path: change.path, had_original: existsSync(join(root, change.path)), covered_by_retired: covered });
    }
    validateCanonicalStoryTransaction(root, changes);
    for (const entry of retired) {
      if (!entry.had_original) continue;
      const backup = join(backupRoot, entry.path);
      mkdirSync(dirname(backup), { recursive: true });
      cpSync(join(root, entry.path), backup, { recursive: true });
    }
    for (const entry of writes) {
      if (!entry.had_original || entry.covered_by_retired) continue;
      const backup = join(backupRoot, entry.path);
      mkdirSync(dirname(backup), { recursive: true });
      cpSync(join(root, entry.path), backup, { recursive: true });
    }
  } catch (error) {
    rmSync(transactionRoot, { recursive: true, force: true });
    throw error;
  }

  let journal: OperationalTransactionJournal = { schema_version: "1.0.0", owner, state: "prepared", writes, retired };
  writeJournal(transactionRoot, journal);
  journal = { ...journal, state: "applying" };
  writeJournal(transactionRoot, journal);
  let mutationCount = 0;
  const afterMutation = (): void => {
    mutationCount += 1;
    if (options.simulateProcessExitAfter === mutationCount) process.exit(86);
    if (options.simulateFailureAfter === mutationCount) throw new Error("Simulated transaction failure");
  };
  try {
    for (const entry of retired) {
      const destination = join(root, entry.path);
      if (!existsSync(destination)) continue;
      rmSync(destination, { recursive: true, force: true });
      afterMutation();
    }
    for (const change of changes) {
      const destination = join(root, change.path);
      rmSync(destination, { recursive: true, force: true });
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(stagedRoot, change.path), destination);
      afterMutation();
    }
  } catch (error) {
    restoreJournal(root, transactionRoot, journal);
    rmSync(transactionRoot, { recursive: true, force: true });
    throw error;
  }
  journal = { ...journal, state: "committed" };
  writeJournal(transactionRoot, journal);
  rmSync(transactionRoot, { recursive: true, force: true });
  return { changed: [...retiredPaths, ...changes.map((change) => change.path)], git: null };
}

export function applyTransaction(root: string, changes: TransactionFileChange[], options: TransactionOptions = {}): TransactionResult {
  const removePaths = options.removePaths ?? [];
  const replacePaths = options.replacePaths ?? [];
  const hasOperationalMutation = removePaths.length > 0 || replacePaths.length > 0;
  if (!hasOperationalMutation) {
    recoverInterruptedOperationalTransactions(root);
    if (!changes.length && !options.deriveChanges) return { changed: [], git: null };
    if (options.simulateProcessExitAfter !== undefined) {
      throw new Error("Process-exit simulation requires a recoverable operational transaction.");
    }
    return applyStandardTransaction(root, changes, options);
  }
  const owner = acquireOperationalTransactionLock(root);
  try {
    recoverInterruptedOperationalTransactionsWhileLocked(root);
    return applyRecoverableOperationalTransaction(root, changes, options, removePaths, replacePaths, owner);
  } finally {
    releaseOperationalTransactionLock(root, owner);
  }
}
