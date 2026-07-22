import { createHash } from "node:crypto";
import { join } from "node:path";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import type { ChapterExecutionManifest } from "../domain/chapter-execution-manifest.js";
import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { ModelJobType } from "../domain/model-job.js";
import type { SceneContract } from "../domain/scene-contract.js";
import { buildActiveContextCapsule } from "../context/active-context-capsule.js";
import type { ActiveContextCapsule } from "../domain/active-context-capsule.js";
import { RUNTIME_PROFILES } from "../domain/runtime-profile.js";
import { readText } from "../infrastructure/files.js";
import { readCachedContextCapsule, writeCachedContextCapsule } from "../infrastructure/context-capsule-cache.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { compileSceneContracts } from "./contracts/scene-contract-compiler.js";
import { resolveModelExecutionProfile } from "./model-execution-profile-resolver.js";
import { readStoryRecordIndex } from "./rebuild-story-index.js";
import { compileProjectStyleCard } from "./style-card-compiler.js";

export interface BuildExecutionContextCapsuleInput {
  root: string;
  manifest: ChapterExecutionManifest;
  sceneId: string;
  jobType: ModelJobType;
  customModelProfile?: ModelExecutionProfile;
}

export interface BuildExecutionContextCapsuleResult {
  capsule: ActiveContextCapsule;
  cacheHit: boolean;
  cacheKey: string;
  sceneContract: SceneContract;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function readContract(root: string, manifest: ChapterExecutionManifest): ChapterContract {
  const path = chapterContractPath(manifest.book_id, manifest.chapter);
  const text = readText(join(root, path));
  if (text === null) throw new Error(`Execution context requires ${path}.`);
  const contract = parseYaml<ChapterContract>(text, ChapterContractSchema, path);
  if (stableHash(contract) !== manifest.chapter_contract_hash) throw new Error("Execution context chapter contract changed after preparation.");
  return contract;
}

function sceneContract(root: string, manifest: ChapterExecutionManifest, sceneId: string): SceneContract {
  const contract = readContract(root, manifest);
  const scene = compileSceneContracts(contract).find((item) => item.scene_id === sceneId);
  if (!scene) throw new Error(`Prepared execution scene ${sceneId} is not in ${contract.contract_id}.`);
  const expected = manifest.scenes.find((item) => item.scene_id === sceneId);
  if (!expected || expected.sequence !== scene.sequence || expected.contract_hash !== stableHash(scene)) {
    throw new Error(`Prepared scene contract changed for ${sceneId}.`);
  }
  return scene;
}

function closingTask(sceneId: string, jobType: ModelJobType): string[] {
  if (jobType === "plan-scene") return [`Plan only ${sceneId}.`, "Return one exact JSON object."];
  if (jobType === "draft-scene") return [`Draft only ${sceneId}.`, "Return scene prose only."];
  if (jobType === "extract-state-delta") return ["Extract the actual state delta for this scene.", "Return one exact JSON object."];
  if (jobType === "patch-spans") return ["Repair only the listed findings.", "Return one exact JSON patch object."];
  if (jobType.startsWith("critic-")) return [`Review only ${jobType}.`, "Return one exact JSON object."];
  return [`Execute only ${sceneId} for ${jobType}.`, "Return one exact JSON object."];
}

function modelProfile(input: BuildExecutionContextCapsuleInput): ModelExecutionProfile {
  if (input.manifest.model_execution_profile === "custom") {
    return resolveModelExecutionProfile({ explicit: "custom", ...(input.customModelProfile ? { custom: input.customModelProfile } : {}) });
  }
  return resolveModelExecutionProfile({ explicit: input.manifest.model_execution_profile });
}

export function buildExecutionContextCapsule(input: BuildExecutionContextCapsuleInput): BuildExecutionContextCapsuleResult {
  const scene = sceneContract(input.root, input.manifest, input.sceneId);
  const storyIndex = readStoryRecordIndex(input.root);
  if (storyIndex.manifest.index_hash !== input.manifest.story_index_hash) {
    throw new Error("Execution context story index changed after preparation.");
  }
  const runtime = RUNTIME_PROFILES[input.manifest.runtime_profile];
  const capsule = buildActiveContextCapsule({
    storyIndex,
    sceneContract: scene,
    modelProfile: modelProfile(input),
    jobType: input.jobType,
    openingRules: [
      "Use only supplied records and preserve every authority label.",
      "Treat established records as facts; requirements and proposals are not completed events.",
      "Do not infer missing facts or cross the scene knowledge boundaries.",
    ],
    styleCard: compileProjectStyleCard(input.root, scene.pov),
    closingTask: closingTask(scene.scene_id, input.jobType),
    maximumDependencyDepth: runtime.graphDepth,
  });
  const cacheInput = { projectHash: input.manifest.project_hash, runtimeProfile: input.manifest.runtime_profile, capsule };
  const cached = readCachedContextCapsule(input.root, cacheInput);
  if (cached) {
    return {
      capsule: cached,
      cacheHit: true,
      cacheKey: createHash("sha256").update(JSON.stringify({ project: input.manifest.project_hash, capsule: cached.capsule_id, job: cached.job_type }), "utf8").digest("hex"),
      sceneContract: scene,
    };
  }
  const written = writeCachedContextCapsule(input.root, cacheInput);
  return { capsule, cacheHit: false, cacheKey: written.key, sceneContract: scene };
}
