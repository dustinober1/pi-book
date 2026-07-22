import { join, relative } from "node:path";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import { isModelJobType, type ModelJobType } from "../domain/model-job.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import type { SceneContract } from "../domain/scene-contract.js";
import { listFilesRecursive, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { compileSceneContracts } from "./contracts/scene-contract-compiler.js";
import { rebuildStoryRecordIndex, readStoryRecordIndex } from "./rebuild-story-index.js";
import { compileProjectStyleCard } from "./style-card-compiler.js";
import { resolveModelExecutionProfile } from "./model-execution-profile-resolver.js";
import { projectStateHash } from "./project-hash.js";
import { buildActiveContextCapsule } from "../context/active-context-capsule.js";
import {
  contextCapsuleCacheKey,
  readCachedContextCapsule,
  writeCachedContextCapsule,
  type ContextCapsuleCacheKeyInput,
} from "../infrastructure/context-capsule-cache.js";

export interface InspectActiveContextOptions {
  chapter: number;
  sceneId: string;
  jobType: ModelJobType;
}

export interface ContextInspectionRecord {
  id: string;
  kind: string;
  status: string;
  authority: string;
  required: boolean;
  reason: string;
  estimatedTokens: number;
  dependencies: string[];
}

export interface ActiveContextInspection {
  chapter: number;
  sceneId: string;
  jobType: ModelJobType;
  runtimeProfile: string;
  modelExecutionProfile: string;
  capsuleId: string;
  cacheKey: string;
  cacheHit: boolean;
  projectHash: string;
  contractHash: string;
  storyIndexHash: string;
  styleCardId: string | null;
  estimatedEvidenceTokens: number;
  maximumEvidenceTokens: number;
  records: ContextInspectionRecord[];
  omittedRecordIds: string[];
  dependencyEdges: Array<{ from: string; to: string }>;
}

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function readChapterContract(root: string, bookId: string, chapter: number): ChapterContract {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Context inspection requires a positive chapter number.");
  const path = chapterContractPath(bookId, chapter);
  const text = readText(join(root, path));
  if (text === null) throw new Error(`Chapter contract not found: ${path}`);
  const contract = parseYaml<ChapterContract>(text, ChapterContractSchema, path);
  if (!contract.small_model_ready) {
    throw new Error(`Chapter contract ${contract.contract_id} is not small-model ready: ${contract.missing_small_model_fields.join(", ") || "missing executable fields"}.`);
  }
  return contract;
}

function sceneFor(contract: ChapterContract, sceneId: string): SceneContract {
  const scenes = compileSceneContracts(contract);
  const scene = scenes.find((item) => item.scene_id === sceneId);
  if (!scene) throw new Error(`Scene ${sceneId} is not part of ${contract.contract_id}. Available: ${scenes.map((item) => item.scene_id).join(", ")}.`);
  return scene;
}

function capsuleInput(root: string, scene: SceneContract, jobType: ModelJobType): {
  capsule: ActiveContextCapsule;
  projectHash: string;
  runtimeProfile: string;
} {
  const project = readProject(root);
  rebuildStoryRecordIndex(root);
  const storyIndex = readStoryRecordIndex(root);
  const configuredModelProfile = project.runtime?.model_execution_profile;
  const modelProfile = resolveModelExecutionProfile(configuredModelProfile ? { project: configuredModelProfile } : {});
  const styleCard = compileProjectStyleCard(root, scene.pov);
  const capsule = buildActiveContextCapsule({
    storyIndex,
    sceneContract: scene,
    modelProfile,
    jobType,
    openingRules: [
      "Use only supplied records and preserve every authority label.",
      "Treat established records as facts; requirements and proposals are not completed events.",
      "Do not infer missing facts or cross the scene knowledge boundaries.",
    ],
    styleCard,
    closingTask: [
      `Execute only ${scene.scene_id} for the ${jobType} job.`,
      "Return only the requested job output without commentary about hidden reasoning or source files.",
    ],
  });
  return {
    capsule,
    projectHash: projectStateHash(root),
    runtimeProfile: project.runtime?.profile ?? "full",
  };
}

function inspectionFrom(
  capsule: ActiveContextCapsule,
  input: ContextCapsuleCacheKeyInput,
  chapter: number,
  cacheHit: boolean,
): ActiveContextInspection {
  return {
    chapter,
    sceneId: capsule.scene_contract.scene_id,
    jobType: capsule.job_type,
    runtimeProfile: input.runtimeProfile,
    modelExecutionProfile: capsule.model_execution_profile,
    capsuleId: capsule.capsule_id,
    cacheKey: contextCapsuleCacheKey(input),
    cacheHit,
    projectHash: input.projectHash,
    contractHash: capsule.contract_hash,
    storyIndexHash: capsule.story_index_hash,
    styleCardId: typeof capsule.style_card === "object" && capsule.style_card !== null ? capsule.style_card.style_id : null,
    estimatedEvidenceTokens: capsule.manifest.estimated_evidence_tokens,
    maximumEvidenceTokens: capsule.manifest.maximum_evidence_tokens,
    records: capsule.records.map((record) => ({
      id: record.id,
      kind: record.kind,
      status: record.status,
      authority: record.authority,
      required: record.required,
      reason: record.reason,
      estimatedTokens: record.estimated_tokens,
      dependencies: [...record.dependencies],
    })),
    omittedRecordIds: [...capsule.manifest.omitted_record_ids],
    dependencyEdges: capsule.manifest.dependency_edges.map((edge) => ({ ...edge })),
  };
}

export function inspectActiveContext(root: string, options: InspectActiveContextOptions): ActiveContextInspection {
  if (!isModelJobType(options.jobType)) throw new Error(`Unknown context job type: ${String(options.jobType)}.`);
  const book = readBook(root);
  const contract = readChapterContract(root, book.book_id, options.chapter);
  const scene = sceneFor(contract, options.sceneId);
  const built = capsuleInput(root, scene, options.jobType);
  const keyInput: ContextCapsuleCacheKeyInput = {
    projectHash: built.projectHash,
    runtimeProfile: built.runtimeProfile,
    capsule: built.capsule,
  };
  const cached = readCachedContextCapsule(root, keyInput);
  if (cached) return inspectionFrom(cached, { ...keyInput, capsule: cached }, options.chapter, true);
  writeCachedContextCapsule(root, keyInput);
  return inspectionFrom(built.capsule, keyInput, options.chapter, false);
}

function executableContracts(root: string): ChapterContract[] {
  const book = readBook(root);
  const directory = join(root, "books", book.book_id, "contracts", "chapters");
  return listFilesRecursive(directory, (path) => /\.ya?ml$/i.test(path))
    .map((path) => {
      const relativePath = normalizedRelative(root, path);
      const text = readText(path);
      return text === null ? null : parseYaml<ChapterContract>(text, ChapterContractSchema, relativePath);
    })
    .filter((contract): contract is ChapterContract => Boolean(contract?.small_model_ready))
    .sort((left, right) => left.chapter - right.chapter || left.version - right.version);
}

export function hasExecutableContext(root: string): boolean {
  return executableContracts(root).length > 0;
}

export function inspectNextActiveContext(root: string, jobType: ModelJobType = "draft-scene"): ActiveContextInspection {
  const contract = executableContracts(root)[0];
  if (!contract) throw new Error("No small-model-ready chapter contract is available for context inspection.");
  const scene = compileSceneContracts(contract)[0];
  if (!scene) throw new Error(`Chapter contract ${contract.contract_id} did not compile a scene.`);
  return inspectActiveContext(root, { chapter: contract.chapter, sceneId: scene.scene_id, jobType });
}

export function renderContextInspection(inspection: ActiveContextInspection): string {
  const records = inspection.records.length
    ? inspection.records.map((record) => [
      `- ${record.id} | ${record.authority} | ${record.kind} | ${record.estimatedTokens} tokens`,
      `  Reason: ${record.reason}`,
      `  Dependencies: ${record.dependencies.join(", ") || "none"}`,
    ].join("\n"))
    : ["- none"];
  const omitted = inspection.omittedRecordIds.length ? inspection.omittedRecordIds.map((id) => `- ${id}`) : ["- none"];
  const edges = inspection.dependencyEdges.length
    ? inspection.dependencyEdges.map((edge) => `- ${edge.from} -> ${edge.to}`)
    : ["- none"];
  return [
    "# Active Context Inspection",
    "",
    `- Chapter: ${inspection.chapter}`,
    `- Scene: ${inspection.sceneId}`,
    `- Job: ${inspection.jobType}`,
    `- Runtime profile: ${inspection.runtimeProfile}`,
    `- Model execution profile: ${inspection.modelExecutionProfile}`,
    `- Capsule: ${inspection.capsuleId}`,
    `- Cache: ${inspection.cacheHit ? "hit" : "miss"}`,
    `- Estimated evidence tokens: ${inspection.estimatedEvidenceTokens} / ${inspection.maximumEvidenceTokens}`,
    `- Style card: ${inspection.styleCardId ?? "none"}`,
    "",
    "## Included records",
    "",
    ...records,
    "",
    "## Omitted record IDs",
    "",
    ...omitted,
    "",
    "## Dependency edges",
    "",
    ...edges,
  ].join("\n");
}
