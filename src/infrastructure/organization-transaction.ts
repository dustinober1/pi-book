import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { TransactionFileChange } from "./transaction.js";

export type OrganizationWrite = TransactionFileChange & {
  expectedHash?: string;
};

export interface OrganizationArchiveMove {
  sourcePath: string;
  archivePath: string;
  expectedHash: string;
}

export interface OrganizationTransactionOptions {
  writes: OrganizationWrite[];
  archiveMoves: OrganizationArchiveMove[];
  manifest: OrganizationWrite;
  archiveRoot: string;
  simulateFailureAfter?: number;
}

export interface OrganizationTransactionResult {
  changed: string[];
}

interface JournalWrite { path: string; hash: string }
interface OrganizationJournal {
  version: 1;
  archiveRoot: string;
  writes: JournalWrite[];
  manifest: JournalWrite;
  moves: OrganizationArchiveMove[];
}

const transactionPrefix = ".novel-forge-organize-txn-";

function normalizedRelative(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (!normalized || normalized.includes("\u0000") || normalized.startsWith("/") || segments.includes("..") || segments.includes(".")) {
    throw new Error(`Unsafe organization path: ${path}`);
  }
  return normalized;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fileHash(path: string): string {
  return sha256(readFileSync(path));
}

function assertRoot(root: string): string {
  const absolute = resolve(root);
  const stat = lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Organization root must be a real directory, not a symbolic link.");
  return realpathSync(absolute);
}

function caseCollision(root: string, relativePath: string): string | null {
  let current = root;
  for (const segment of normalizedRelative(relativePath).split("/")) {
    if (!existsSync(current) || !lstatSync(current).isDirectory()) return null;
    const match = readdirSync(current).find((name) => name.normalize("NFC").toLocaleLowerCase("en-US") === segment.normalize("NFC").toLocaleLowerCase("en-US"));
    if (!match) return null;
    if (match !== segment) return relative(root, join(current, match));
    current = join(current, match);
  }
  return null;
}

function assertContained(root: string, relativePath: string, allowMissingLeaf = true): string {
  const safe = normalizedRelative(relativePath);
  const absolute = resolve(root, safe);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) throw new Error(`Organization path escapes the repository: ${relativePath}`);
  let current = dirname(absolute);
  while (current !== root) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Organization path crosses a symbolic link: ${relativePath}`);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!allowMissingLeaf && !existsSync(absolute)) throw new Error(`Organization source no longer exists: ${relativePath}`);
  if (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()) throw new Error(`Organization path may not be a symbolic link: ${relativePath}`);
  return absolute;
}

function contentHash(write: OrganizationWrite): string {
  return write.expectedHash ?? sha256(write.content);
}

function journalPath(transactionRoot: string): string {
  return join(transactionRoot, "journal.json");
}

function saveJournal(transactionRoot: string, journal: OrganizationJournal): void {
  writeFileSync(journalPath(transactionRoot), `${JSON.stringify(journal, null, 2)}\n`, "utf8");
}

function removeIfExpected(root: string, item: JournalWrite): void {
  const path = assertContained(root, item.path);
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (!stat.isFile() || fileHash(path) !== item.hash) {
    throw new Error(`Interrupted organization recovery found unexpected content at ${item.path}; manual review is required.`);
  }
  rmSync(path, { force: true });
}

function treeFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) output.push(...treeFiles(path));
    else output.push(path);
  }
  return output;
}

function recoverOne(root: string, transactionRoot: string, journal: OrganizationJournal): void {
  for (const move of [...journal.moves].reverse()) {
    const source = assertContained(root, move.sourcePath);
    const archived = assertContained(root, move.archivePath);
    const sourceExists = existsSync(source);
    const archiveExists = existsSync(archived);
    if (sourceExists && archiveExists) throw new Error(`Interrupted organization recovery found both ${move.sourcePath} and ${move.archivePath}.`);
    if (!sourceExists && archiveExists) {
      if (fileHash(archived) !== move.expectedHash) throw new Error(`Archived recovery content changed: ${move.archivePath}`);
      mkdirSync(dirname(source), { recursive: true });
      renameSync(archived, source);
    }
  }
  removeIfExpected(root, journal.manifest);
  for (const write of [...journal.writes].reverse()) removeIfExpected(root, write);
  const archiveRoot = assertContained(root, journal.archiveRoot);
  if (existsSync(archiveRoot)) {
    const remaining = treeFiles(archiveRoot);
    if (remaining.length) throw new Error(`Interrupted archive still contains unexpected files at ${journal.archiveRoot}.`);
    rmSync(archiveRoot, { recursive: true, force: true });
  }
  rmSync(transactionRoot, { recursive: true, force: true });
}

export function pendingOrganizationTransactions(root: string): string[] {
  const safeRoot = assertRoot(root);
  return readdirSync(safeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(transactionPrefix))
    .map((entry) => entry.name)
    .sort();
}

export function applyOrganizationTransaction(root: string, options: OrganizationTransactionOptions): OrganizationTransactionResult {
  const safeRoot = assertRoot(root);
  const pending = pendingOrganizationTransactions(safeRoot);
  if (pending.length) throw new Error("An interrupted repository organization transaction must be recovered before continuing.");

  const writePaths = new Set<string>();
  const sourcePaths = new Set<string>();
  const allWrites = [...options.writes, options.manifest].map((write) => ({ ...write, path: normalizedRelative(write.path) }));
  for (const write of allWrites) {
    if (writePaths.has(write.path)) throw new Error(`Duplicate organization destination: ${write.path}`);
    writePaths.add(write.path);
    const destination = assertContained(safeRoot, write.path);
    const conflictingCase = caseCollision(safeRoot, write.path);
    if (conflictingCase) throw new Error(`Organization path has a case or Unicode collision with ${conflictingCase}: ${write.path}`);
    if (existsSync(destination)) throw new Error(`Organization will not overwrite existing path: ${write.path}`);
  }

  const moves = options.archiveMoves.map((move) => ({
    ...move,
    sourcePath: normalizedRelative(move.sourcePath),
    archivePath: normalizedRelative(move.archivePath),
  }));
  for (const move of moves) {
    if (sourcePaths.has(move.sourcePath)) throw new Error(`Duplicate organization source: ${move.sourcePath}`);
    sourcePaths.add(move.sourcePath);
    if (writePaths.has(move.sourcePath) || writePaths.has(move.archivePath)) throw new Error(`Organization source/destination overlap: ${move.sourcePath}`);
    const source = assertContained(safeRoot, move.sourcePath, false);
    const archived = assertContained(safeRoot, move.archivePath);
    const conflictingCase = caseCollision(safeRoot, move.archivePath);
    if (conflictingCase) throw new Error(`Archive path has a case or Unicode collision with ${conflictingCase}: ${move.archivePath}`);
    const stat = lstatSync(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Organization source must be a regular file: ${move.sourcePath}`);
    if (existsSync(archived)) throw new Error(`Archive destination already exists: ${move.archivePath}`);
    if (fileHash(source) !== move.expectedHash) throw new Error(`Organization preview is stale because ${move.sourcePath} changed.`);
  }

  const archiveRoot = normalizedRelative(options.archiveRoot);
  if (!archiveRoot.startsWith(".archive/")) throw new Error("Organization archive must be created below .archive/.");
  assertContained(safeRoot, archiveRoot);
  const archiveCaseCollision = caseCollision(safeRoot, archiveRoot);
  if (archiveCaseCollision) throw new Error(`Archive root has a case or Unicode collision with ${archiveCaseCollision}.`);
  const transactionRoot = join(safeRoot, `${transactionPrefix}${randomUUID()}`);
  const stagedRoot = join(transactionRoot, "staged");
  mkdirSync(stagedRoot, { recursive: true });

  const regularWrites = allWrites.slice(0, -1);
  const manifest = allWrites.at(-1)!;
  const journal: OrganizationJournal = {
    version: 1,
    archiveRoot,
    writes: regularWrites.map((write) => ({ path: write.path, hash: contentHash(write) })),
    manifest: { path: manifest.path, hash: contentHash(manifest) },
    moves,
  };
  try {
    saveJournal(transactionRoot, journal);
    for (const write of allWrites) {
      const staged = join(stagedRoot, write.path);
      mkdirSync(dirname(staged), { recursive: true });
      if (typeof write.content === "string") writeFileSync(staged, write.content, "utf8");
      else writeFileSync(staged, write.content);
      if (fileHash(staged) !== contentHash(write)) throw new Error(`Staged organization hash mismatch: ${write.path}`);
    }
  } catch (error) {
    rmSync(transactionRoot, { recursive: true, force: true });
    throw error;
  }

  let operations = 0;
  const failIfRequested = () => {
    operations += 1;
    if (options.simulateFailureAfter === operations) throw new Error("Simulated organization transaction failure");
  };

  try {
    for (const write of regularWrites) {
      const destination = assertContained(safeRoot, write.path);
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(stagedRoot, write.path), destination);
      failIfRequested();
    }
    for (const write of regularWrites) {
      if (fileHash(join(safeRoot, write.path)) !== contentHash(write)) throw new Error(`Installed organization hash mismatch: ${write.path}`);
    }
    for (const move of moves) {
      const source = assertContained(safeRoot, move.sourcePath, false);
      const archived = assertContained(safeRoot, move.archivePath);
      mkdirSync(dirname(archived), { recursive: true });
      renameSync(source, archived);
      if (fileHash(archived) !== move.expectedHash) throw new Error(`Archived organization hash mismatch: ${move.archivePath}`);
      failIfRequested();
    }
    const manifestDestination = assertContained(safeRoot, manifest.path);
    mkdirSync(dirname(manifestDestination), { recursive: true });
    renameSync(join(stagedRoot, manifest.path), manifestDestination);
    failIfRequested();
  } catch (error) {
    recoverOne(safeRoot, transactionRoot, journal);
    throw error;
  }

  rmSync(transactionRoot, { recursive: true, force: true });
  return {
    changed: [...regularWrites.map((write) => write.path), ...moves.flatMap((move) => [move.sourcePath, move.archivePath]), manifest.path],
  };
}
