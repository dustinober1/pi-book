import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { BookSchema, type BookState } from "../../domain/schemas.js";
import { countWords } from "../../infrastructure/files.js";
import { commitWorkflowEvent, gitStagedPaths, gitTopLevel, gitTrackedPaths } from "../../infrastructure/git.js";
import {
  applyOrganizationTransaction,
  type OrganizationArchiveMove,
  type OrganizationWrite,
} from "../../infrastructure/organization-transaction.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { projectTemplateFiles } from "../../project/templates.js";
import { scanWritingRepository } from "./scan.js";
import type {
  OrganizationApplyOptions,
  OrganizationApplyResult,
  OrganizationPreview,
  OrganizerCandidate,
} from "./types.js";

function sha256(bytes: Uint8Array | string): string { return createHash("sha256").update(bytes).digest("hex"); }
function collisionKey(path: string): string { return path.normalize("NFC").toLocaleLowerCase("en-US"); }

function archiveId(now: Date): string {
  return now.toISOString().replace(/[-:.]/g, "").replace(/Z$/, "Z");
}

function availableArchiveRoot(root: string, now: Date): string {
  const base = `.archive/${archiveId(now)}`;
  let candidate = base;
  let suffix = 1;
  while (existsSync(join(root, candidate))) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function assertFreshPreview(root: string, preview: OrganizationPreview): void {
  const fresh = scanWritingRepository(root);
  if (fresh.previewHash !== preview.previewHash) throw new Error("Repository organization preview is stale; scan the repository again before applying.");
  if (JSON.stringify(fresh.candidates) !== JSON.stringify(preview.candidates)) throw new Error("Repository organization preview was modified after scanning; scan again before applying.");
}

function selectedCandidates(preview: OrganizationPreview, ids?: string[]): OrganizerCandidate[] {
  const selectedIds = ids ? new Set(ids) : new Set(preview.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id));
  if (ids && selectedIds.size !== ids.length) throw new Error("Repository organization selection contains duplicate candidate IDs.");
  const known = new Set(preview.candidates.map((candidate) => candidate.id));
  for (const id of selectedIds) if (!known.has(id)) throw new Error(`Unknown repository organization candidate: ${id}`);
  const selected = preview.candidates.filter((candidate) => selectedIds.has(candidate.id) && candidate.selected);
  for (const candidate of selected) {
    if (candidate.duplicateOf && !selectedIds.has(candidate.duplicateOf)) throw new Error(`Duplicate ${candidate.originalPath} cannot be selected without its canonical source candidate.`);
  }
  return selected;
}

function sourceBytes(root: string, candidate: OrganizerCandidate): Uint8Array {
  const path = join(root, candidate.originalPath);
  if (!existsSync(path)) throw new Error(`Organization source no longer exists: ${candidate.originalPath}`);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Organization source must remain a regular file: ${candidate.originalPath}`);
  const bytes = readFileSync(path);
  if (sha256(bytes) !== candidate.sha256 || bytes.byteLength !== candidate.byteSize) {
    throw new Error(`Organization preview is stale because ${candidate.originalPath} changed.`);
  }
  return bytes;
}

function preflightRoot(inputRoot: string): string {
  const requested = resolve(inputRoot);
  const stat = lstatSync(requested);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Repository organizer requires a real directory, not a symbolic link.");
  const root = realpathSync(requested);
  if (existsSync(join(root, "PROJECT.yaml"))) throw new Error("This repository is already a Novel Forge project.");
  const gitRoot = gitTopLevel(root);
  if (gitRoot && realpathSync(gitRoot) !== root) throw new Error("Repository organization must run at the existing Git repository root.");
  const staged = gitStagedPaths(root);
  if (staged.length) throw new Error(`Repository organization requires an empty Git staging area. Commit or unstage: ${staged.join(", ")}`);
  return root;
}

function ensureNoCollisions(root: string, writes: OrganizationWrite[], moves: OrganizationArchiveMove[]): void {
  const destinations = new Set<string>();
  for (const write of writes) {
    const key = collisionKey(write.path);
    if (destinations.has(key)) throw new Error(`Organization has colliding destinations: ${write.path}`);
    destinations.add(key);
    if (existsSync(join(root, write.path))) throw new Error(`Organization will not overwrite existing path: ${write.path}`);
  }
  for (const move of moves) {
    const key = collisionKey(move.archivePath);
    if (destinations.has(key)) throw new Error(`Organization has colliding archive paths: ${move.archivePath}`);
    destinations.add(key);
  }
}

export function applyRepositoryOrganization(inputRoot: string, preview: OrganizationPreview, options: OrganizationApplyOptions): OrganizationApplyResult {
  if (!options.confirmApply) throw new Error("Repository organization requires explicit confirmation of the proposed structure.");
  if (!options.confirmProvisional) throw new Error("Repository organization requires acknowledgement that inferred classifications are provisional.");
  if (!options.confirmArchive) throw new Error("Moving originals requires separate explicit archive confirmation.");
  const root = preflightRoot(inputRoot);
  assertFreshPreview(root, preview);
  const selected = selectedCandidates(preview, options.selectedCandidateIds);
  if (!selected.length) throw new Error("Select at least one writing file to organize.");

  const templates = projectTemplateFiles({
    projectName: options.project.projectName,
    projectType: options.project.projectType,
    profile: options.project.profile,
    ...(options.project.targetWords !== undefined ? { targetWords: options.project.targetWords } : {}),
    ...(options.project.runtimeProfile !== undefined ? { runtimeProfile: options.project.runtimeProfile } : {}),
  });
  const templateWrites: OrganizationWrite[] = Object.entries(templates).map(([path, content]) => ({ path, content }));
  for (const write of templateWrites) {
    if (existsSync(join(root, write.path))) throw new Error(`Partial Novel Forge path already exists and will not be overwritten: ${write.path}`);
  }

  const bytesById = new Map<string, Uint8Array>();
  for (const candidate of selected) bytesById.set(candidate.id, sourceBytes(root, candidate));
  const organized = selected.filter((candidate) => candidate.category !== "duplicate" && candidate.destination !== null);
  const destinationWrites: OrganizationWrite[] = organized.map((candidate) => ({
    path: candidate.destination!,
    content: bytesById.get(candidate.id)!,
    encoding: "binary" as const,
    expectedHash: candidate.sha256,
  }));

  const bookPath = "books/book-01/BOOK.yaml";
  const rawBook = templates[bookPath];
  if (!rawBook) throw new Error("Novel Forge project template is missing BOOK.yaml.");
  const book = parseYaml<BookState>(rawBook, BookSchema, bookPath);
  const chapters = organized.filter((candidate) => candidate.category === "chapter");
  book.title = options.project.projectName;
  book.current_chapter = Math.max(0, ...chapters.map((candidate) => candidate.chapterNumber ?? 0));
  book.actual_words = chapters.reduce((sum, candidate) => sum + countWords(Buffer.from(bytesById.get(candidate.id)!).toString("utf8")), 0);
  book.status = "planning";
  const bookWrite = templateWrites.find((write) => write.path === bookPath)!;
  bookWrite.content = stringifyYaml(book);

  const archiveRoot = availableArchiveRoot(root, options.now ?? new Date());
  const moves: OrganizationArchiveMove[] = selected.filter((candidate) => candidate.archive).map((candidate) => ({
    sourcePath: candidate.originalPath,
    archivePath: `${archiveRoot}/files/${candidate.originalPath}`,
    expectedHash: candidate.sha256,
  }));
  const manifestPath = `${archiveRoot}/manifest.yaml`;
  const reportPath = "ORGANIZATION_REPORT.md";
  const manifestEntries = selected.map((candidate) => ({
    candidate_id: candidate.id,
    original_path: candidate.originalPath,
    canonical_path: candidate.destination,
    archived_path: candidate.archive ? `${archiveRoot}/files/${candidate.originalPath}` : null,
    source_sha256: candidate.sha256,
    canonical_sha256: candidate.destination ? candidate.sha256 : null,
    bytes: candidate.byteSize,
    category: candidate.category,
    confidence: candidate.confidence,
    reason: candidate.reason,
  }));
  const manifest = {
    schema_version: "1.0.0",
    created_at: (options.now ?? new Date()).toISOString(),
    preview_id: preview.previewId,
    preview_hash: preview.previewHash,
    project_root: ".",
    entries: manifestEntries,
  };
  const report = [
    "# Repository Organization Report",
    "",
    `- Project: ${options.project.projectName}`,
    `- Preview hash: ${preview.previewHash}`,
    `- Organized files: ${organized.length}`,
    `- Archived originals: ${moves.length}`,
    `- Imported chapter candidates: ${chapters.length}`,
    `- Imported chapter words: ${book.actual_words}`,
    `- Archive manifest: ${manifestPath}`,
    "- Workflow stage remains voice-intake and the book remains planning.",
    "- Classifications based on names or folders remain provisional source material.",
    "- No canon, plot approval, research claim, review evidence, reader evidence, or writer approval was invented.",
    "",
    "## Confirmed map",
    "",
    ...manifestEntries.map((entry) => `- ${entry.original_path} → ${entry.canonical_path ?? "duplicate; no second canonical copy"}${entry.archived_path ? ` → ${entry.archived_path}` : ""}`),
    "",
  ].join("\n");
  templateWrites.find((write) => write.path === "STATUS.md")!.content = [
    "# Novel Forge",
    "",
    `Repository organization completed for ${options.project.projectName}.`,
    `Imported ${chapters.length} provisional chapter candidate${chapters.length === 1 ? "" : "s"} and preserved all other confirmed source material without promoting it into canon or approvals.`,
    "",
    "Run `/novel` to begin voice intake and review the organization report.",
    "",
  ].join("\n");
  templateWrites.find((write) => write.path === "HANDOFF.md")!.content = [
    "# Novel Forge Handoff",
    "",
    `Continue the newly organized Novel Forge project ${options.project.projectName}.`,
    "Read ORGANIZATION_REPORT.md and the archive manifest, then run `/novel`.",
    "Treat imported outlines, notes, research, drafts, and chapter files as provisional source material until the writer confirms them.",
    "Do not infer approvals, canon, research readiness, review outcomes, or reader evidence from imported files.",
    "",
  ].join("\n");

  const reportWrite: OrganizationWrite = { path: reportPath, content: report };
  const manifestWrite: OrganizationWrite = { path: manifestPath, content: stringifyYaml(manifest) };
  const writes = [...templateWrites, ...destinationWrites, reportWrite];
  ensureNoCollisions(root, [...writes, manifestWrite], moves);
  const trackedSources = new Set(gitTrackedPaths(root, moves.map((move) => move.sourcePath)));
  const transaction = applyOrganizationTransaction(root, {
    writes,
    archiveMoves: moves,
    manifest: manifestWrite,
    archiveRoot,
    ...(options.simulateFailureAfter !== undefined ? { simulateFailureAfter: options.simulateFailureAfter } : {}),
  });
  const uniqueChanged = [...new Set(transaction.changed)];
  const sourcePaths = new Set(moves.map((move) => move.sourcePath));
  const checkpointPaths = uniqueChanged.filter((path) => !sourcePaths.has(path) || trackedSources.has(path));
  const newlyStaged = gitStagedPaths(root);
  const gitMessage = newlyStaged.length
    ? `Git checkpoint skipped because the staging area changed during organization: ${newlyStaged.join(", ")}`
    : commitWorkflowEvent(root, checkpointPaths, "Novel Forge: organize existing repository", { forceAdd: true, noVerify: true, onlyPaths: true }).message;
  return {
    root,
    organized: organized.length,
    archived: moves.length,
    chapters: chapters.length,
    words: book.actual_words,
    archiveRoot,
    manifestPath,
    reportPath,
    changed: uniqueChanged,
    gitMessage,
  };
}

export function summarizeArchiveList(preview: OrganizationPreview, selectedIds?: string[]): string {
  const selected = selectedCandidates(preview, selectedIds).filter((candidate) => candidate.archive);
  return [
    `${selected.length} original file${selected.length === 1 ? "" : "s"} will move into a timestamped .archive directory after byte-for-byte copies are verified:`,
    ...selected.map((candidate) => `- ${candidate.originalPath}`),
  ].join("\n");
}
