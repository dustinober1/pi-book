import { createHash, randomUUID } from "node:crypto";
import { join, relative } from "node:path";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import type { ChapterExecutionManifest } from "../domain/chapter-execution-manifest.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import type { SceneContract } from "../domain/scene-contract.js";
import { readText } from "../infrastructure/files.js";
import {
  chapterExecutionManifestPath,
  readChapterExecutionManifest,
  serializeChapterExecutionManifest,
  writeChapterExecutionManifest,
} from "../infrastructure/chapter-execution-manifest-store.js";
import {
  chapterExecutionStatePath,
  readChapterExecutionState,
  serializeChapterExecutionState,
  writeChapterExecutionState,
} from "../infrastructure/chapter-execution-store.js";
import {
  activeContextCapsulePath,
  serializeActiveContextCapsule,
} from "../infrastructure/context-capsule-store.js";
import { applyTransaction, type TransactionFileChange } from "../infrastructure/transaction.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { chapterContractHash, createChapterExecutionState } from "./chapter-execution-machine.js";
import { compileSceneContracts } from "./contracts/scene-contract-compiler.js";
import { buildExecutionContextCapsule } from "./execution-context-capsule.js";
import { resolveModelExecutionProfile } from "./model-execution-profile-resolver.js";
import { projectStateHash } from "./project-hash.js";
import { rebuildStoryRecordIndex, readStoryRecordIndex } from "./rebuild-story-index.js";

export interface PrepareChapterExecutionInput {
  root: string;
  chapter: number;
  runId?: string;
  now?: string;
}

export interface PrepareChapterExecutionResult {
  manifest: ChapterExecutionManifest;
  manifestPath: string;
  state: ChapterExecutionState;
  statePath: string;
  alreadyPrepared: boolean;
}

export interface RebaseChapterExecutionInput {
  root: string;
  chapter: number;
  runId: string;
  now?: string;
}

export interface RebaseChapterExecutionResult {
  manifest: ChapterExecutionManifest;
  manifestPath: string;
  state: ChapterExecutionState;
  statePath: string;
  capsules: ActiveContextCapsule[];
  capsulePaths: string[];
}

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for chapter execution preparation.");
}

function requireChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter execution preparation requires a positive chapter number.");
}

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function readContract(root: string, bookId: string, chapter: number): ChapterContract {
  const path = chapterContractPath(bookId, chapter);
  const text = readText(join(root, path));
  if (text === null) throw new Error(`Chapter execution preparation requires ${path}.`);
  const contract = parseYaml<ChapterContract>(text, ChapterContractSchema, path);
  if (!contract.small_model_ready) {
    throw new Error(`Chapter contract ${contract.contract_id} is not small-model ready: ${contract.missing_small_model_fields.join(", ") || "missing executable fields"}.`);
  }
  return contract;
}

function sceneEntries(scenes: readonly SceneContract[]): ChapterExecutionManifest["scenes"] {
  return scenes.map((scene) => ({ scene_id: scene.scene_id, sequence: scene.sequence, contract_hash: stableHash(scene) }));
}

function immutableManifest(manifest: ChapterExecutionManifest): Omit<ChapterExecutionManifest, "created_at"> {
  const { created_at: _createdAt, ...immutable } = manifest;
  return immutable;
}

function assertManifestMatches(existing: ChapterExecutionManifest, expected: ChapterExecutionManifest): void {
  if (existing.run_id !== expected.run_id || existing.book_id !== expected.book_id || existing.chapter !== expected.chapter) {
    throw new Error("Prepared run identity or chapter changed.");
  }
  if (existing.chapter_contract_id !== expected.chapter_contract_id
    || existing.chapter_contract_version !== expected.chapter_contract_version
    || existing.chapter_contract_hash !== expected.chapter_contract_hash) {
    throw new Error("Prepared run chapter contract changed.");
  }
  if (existing.project_hash !== expected.project_hash) throw new Error("Prepared run project hash changed.");
  if (existing.story_index_hash !== expected.story_index_hash) throw new Error("Prepared run story index changed.");
  if (existing.runtime_profile !== expected.runtime_profile
    || existing.model_execution_profile !== expected.model_execution_profile) {
    throw new Error("Prepared run execution profile changed.");
  }
  if (JSON.stringify(immutableManifest(existing)) !== JSON.stringify(immutableManifest(expected))) {
    throw new Error("Prepared run scene contracts changed.");
  }
}

function assertStateMatches(state: ChapterExecutionState, manifest: ChapterExecutionManifest): void {
  if (state.run_id !== manifest.run_id || state.chapter !== manifest.chapter) throw new Error("Prepared run execution state identity changed.");
  if (state.project_hash !== manifest.project_hash) throw new Error("Prepared run execution project hash changed.");
  if (state.canon_snapshot_hash !== manifest.story_index_hash) throw new Error("Prepared run execution story index changed.");
  if (chapterContractHash(state) !== manifest.chapter_contract_hash) throw new Error("Prepared run execution chapter contract changed.");
  const sceneById = new Map(manifest.scenes.map((scene) => [scene.scene_id, scene]));
  if (state.current_scene_id !== null) {
    const scene = sceneById.get(state.current_scene_id);
    if (!scene) throw new Error(`Prepared run execution references unknown scene ${state.current_scene_id}.`);
    const chapterOwned = ["chapter-stitch", "chapter-validate", "chapter-commit", "complete"].includes(state.current_node);
    const expectedHash = chapterOwned ? manifest.chapter_contract_hash : scene.contract_hash;
    if (state.contract_hash !== expectedHash) throw new Error("Prepared run active contract ownership changed.");
  }
}

function initialState(manifest: ChapterExecutionManifest, createdAt: string): ChapterExecutionState {
  const firstScene = manifest.scenes[0];
  if (!firstScene) throw new Error("Chapter execution manifest has no scenes.");
  const state = createChapterExecutionState({
    runId: manifest.run_id,
    projectHash: manifest.project_hash,
    canonSnapshotHash: manifest.story_index_hash,
    contractHash: firstScene.contract_hash,
    chapterContractHash: manifest.chapter_contract_hash,
    chapter: manifest.chapter,
    now: createdAt,
  });
  return { ...state, current_scene_id: firstScene.scene_id };
}

interface CompiledChapterExecution {
  manifest: ChapterExecutionManifest;
}

function compileChapterExecution(
  input: PrepareChapterExecutionInput,
  runId: string,
  expectedIdentity?: Pick<ChapterExecutionManifest, "book_id" | "chapter" | "chapter_contract_id">,
): CompiledChapterExecution {
  const project = readProject(input.root);
  if (expectedIdentity && project.active_book !== expectedIdentity.book_id) {
    throw new Error(`Chapter execution rebase cannot change the prepared book identity from ${expectedIdentity.book_id} to ${project.active_book}.`);
  }
  const book = readBook(input.root);
  if (expectedIdentity && book.book_id !== expectedIdentity.book_id) {
    throw new Error(`Chapter execution rebase cannot change the prepared book identity from ${expectedIdentity.book_id} to ${book.book_id}.`);
  }
  const contract = readContract(input.root, book.book_id, input.chapter);
  if (expectedIdentity && (input.chapter !== expectedIdentity.chapter || contract.contract_id !== expectedIdentity.chapter_contract_id)) {
    throw new Error("Chapter execution rebase cannot change the prepared chapter contract identity.");
  }
  const scenes = compileSceneContracts(contract);
  rebuildStoryRecordIndex(input.root);
  const storyIndex = readStoryRecordIndex(input.root);
  const projectHash = projectStateHash(input.root);
  const runtimeProfile = project.runtime?.profile ?? "full";
  const modelProfile = project.runtime?.model_execution_profile
    ? resolveModelExecutionProfile({ project: project.runtime.model_execution_profile })
    : resolveModelExecutionProfile({});
  return {
    manifest: {
      schema_version: "1.0.0",
      run_id: runId,
      book_id: book.book_id,
      chapter: input.chapter,
      chapter_contract_id: contract.contract_id,
      chapter_contract_version: contract.version,
      chapter_contract_hash: stableHash(contract),
      project_hash: projectHash,
      story_index_hash: storyIndex.manifest.index_hash,
      runtime_profile: runtimeProfile,
      model_execution_profile: modelProfile.id,
      scenes: sceneEntries(scenes),
      created_at: timestamp(input.now),
    },
  };
}

function transactionPath(root: string, absolutePath: string): string {
  const path = relative(root, absolutePath).replace(/\\/g, "/");
  if (!path || path.startsWith("../") || path === "..") throw new Error("Chapter execution publication path escaped the project root.");
  return path;
}

function rebaseCapsules(root: string, manifest: ChapterExecutionManifest): ActiveContextCapsule[] {
  return manifest.scenes.map((scene) => buildExecutionContextCapsule({
    root,
    manifest,
    sceneId: scene.scene_id,
    jobType: "plan-scene",
  }).capsule);
}

export function prepareChapterExecution(input: PrepareChapterExecutionInput): PrepareChapterExecutionResult {
  requireChapter(input.chapter);
  const runId = input.runId ?? `CHRUN-${randomUUID()}`;
  requireRunId(runId);
  const expected = compileChapterExecution(input, runId).manifest;

  const existingManifest = readChapterExecutionManifest(input.root, runId, input.chapter);
  const existingState = readChapterExecutionState(input.root, runId);
  if (existingManifest) assertManifestMatches(existingManifest, expected);
  if (existingState) assertStateMatches(existingState, existingManifest ?? expected);

  if (existingManifest && existingState) {
    return {
      manifest: existingManifest,
      manifestPath: chapterExecutionManifestPath(input.root, runId, input.chapter),
      state: existingState,
      statePath: chapterExecutionStatePath(input.root, runId),
      alreadyPrepared: true,
    };
  }

  const manifest = existingManifest ?? { ...expected, created_at: existingState?.updated_at ?? expected.created_at };
  const state = existingState ?? initialState(manifest, manifest.created_at);
  const manifestPath = existingManifest
    ? chapterExecutionManifestPath(input.root, runId, input.chapter)
    : writeChapterExecutionManifest(input.root, manifest);
  const statePath = existingState
    ? chapterExecutionStatePath(input.root, runId)
    : writeChapterExecutionState(input.root, state);
  return { manifest, manifestPath, state, statePath, alreadyPrepared: Boolean(existingManifest || existingState) };
}

export function rebaseChapterExecution(input: RebaseChapterExecutionInput): RebaseChapterExecutionResult {
  requireChapter(input.chapter);
  requireRunId(input.runId);
  const previousManifest = readChapterExecutionManifest(input.root, input.runId, input.chapter);
  const previousState = readChapterExecutionState(input.root, input.runId);
  if (!previousManifest || !previousState) {
    throw new Error("Chapter execution rebase requires an existing prepared manifest and execution state.");
  }
  assertStateMatches(previousState, previousManifest);

  const manifest = compileChapterExecution(input, input.runId, previousManifest).manifest;
  const state = initialState(manifest, manifest.created_at);
  const capsules = rebaseCapsules(input.root, manifest);
  const manifestPath = chapterExecutionManifestPath(input.root, input.runId, input.chapter);
  const statePath = chapterExecutionStatePath(input.root, input.runId);
  const capsulePaths = capsules.map((capsule) => activeContextCapsulePath(input.root, input.runId, capsule));
  const changes: TransactionFileChange[] = [
    ...capsules.map((capsule, index) => ({
      path: transactionPath(input.root, capsulePaths[index]!),
      content: serializeActiveContextCapsule(input.runId, capsule),
    })),
    { path: transactionPath(input.root, manifestPath), content: serializeChapterExecutionManifest(manifest) },
    { path: transactionPath(input.root, statePath), content: serializeChapterExecutionState(state) },
  ];
  applyTransaction(input.root, changes, {
    removePaths: [transactionPath(input.root, join(input.root, ".pi-book", "runs", input.runId, "scenes"))],
  });
  return { manifest, manifestPath, state, statePath, capsules, capsulePaths };
}
