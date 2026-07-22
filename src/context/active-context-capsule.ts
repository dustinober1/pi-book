import { createHash } from "node:crypto";
import { Value } from "@sinclair/typebox/value";
import {
  ActiveContextCapsuleSchema,
  type ActiveContextCapsule,
  type ActiveContextRecord,
  type ContextAuthority,
} from "../domain/active-context-capsule.js";
import type { ModelExecutionProfile } from "../domain/model-execution-profile.js";
import type { ModelJobType } from "../domain/model-job.js";
import type { SceneContract } from "../domain/scene-contract.js";
import type { StoryRecordStatus } from "../domain/story-record-status.js";
import type { StyleCard } from "../domain/style-card.js";
import {
  StoryRecordIndexManifestSchema,
  StoryRecordIndexRecordSchema,
  type StoryRecordIndex,
  type StoryRecordIndexRecord,
} from "./story-record-index.js";

export type ActiveContextCapsuleErrorCode =
  | "missing-required-records"
  | "unsafe-required-records"
  | "required-context-overflow"
  | "invalid-capsule";

export class ActiveContextCapsuleError extends Error {
  constructor(
    readonly code: ActiveContextCapsuleErrorCode,
    readonly recordIds: string[],
    message: string,
  ) {
    super(message);
    this.name = "ActiveContextCapsuleError";
  }
}

export interface BuildActiveContextCapsuleInput {
  storyIndex: StoryRecordIndex;
  sceneContract: SceneContract;
  modelProfile: ModelExecutionProfile;
  jobType: ModelJobType;
  optionalRecordIds?: string[];
  openingRules: string[];
  previousTail?: string;
  styleCard?: StyleCard | string;
  closingTask: string[];
  maximumDependencyDepth?: 1 | 2;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function estimatedTokens(value: unknown): number {
  return Math.max(1, Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4));
}

function normalizedStyleCard(value: StyleCard | string | undefined): StyleCard | string | null {
  if (value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  return structuredClone(value);
}

function assertIndexValid(index: StoryRecordIndex): void {
  if (!Value.Check(StoryRecordIndexManifestSchema, index.manifest)) {
    throw new ActiveContextCapsuleError("invalid-capsule", [], "Story record index manifest is invalid.");
  }
  if (index.manifest.record_count !== index.records.length) {
    throw new ActiveContextCapsuleError("invalid-capsule", [], "Story record index count disagrees with its manifest.");
  }
  const seen = new Set<string>();
  for (const record of index.records) {
    if (!Value.Check(StoryRecordIndexRecordSchema, record)) {
      throw new ActiveContextCapsuleError("invalid-capsule", [], "Story record index contains an invalid record.");
    }
    if (seen.has(record.id)) throw new ActiveContextCapsuleError("invalid-capsule", [record.id], `Story record index duplicates ${record.id}.`);
    seen.add(record.id);
  }
}

function authority(status: StoryRecordStatus): ContextAuthority | null {
  switch (status) {
    case "locked-canon":
    case "accepted-manuscript-fact":
    case "current-state":
      return "established";
    case "required-future-event":
      return "requirement";
    case "proposed-plan":
      return "proposal";
    case "unresolved":
    case "deprecated":
      return null;
  }
}

function activeRecord(record: StoryRecordIndexRecord, required: boolean, reason: string): ActiveContextRecord {
  const recordAuthority = authority(record.status);
  if (!recordAuthority) throw new Error(`Unsafe story record ${record.id} cannot become active context.`);
  const base = {
    id: record.id,
    kind: record.kind,
    status: record.status,
    authority: recordAuthority,
    required,
    reason,
    source_path: record.source_path,
    source_hash: record.source_hash,
    version: record.version,
    payload: structuredClone(record.payload),
    dependencies: [...record.dependencies].sort(),
    estimated_tokens: 1,
  } satisfies ActiveContextRecord;
  return { ...base, estimated_tokens: estimatedTokens(base) };
}

function baseEvidenceTokens(input: BuildActiveContextCapsuleInput): number {
  return estimatedTokens({
    scene_contract: input.sceneContract,
    opening_rules: unique(input.openingRules),
    previous_tail: input.previousTail?.trim() || null,
    style_card: normalizedStyleCard(input.styleCard),
    closing_task: unique(input.closingTask),
  });
}

function explicitSeedIds(scene: SceneContract): string[] {
  return unique([
    scene.pov,
    ...scene.required_record_ids,
    ...scene.start_state_ids,
    ...scene.knowledge_boundary_ids,
    ...scene.active_thread_ids,
  ]).sort();
}

export function buildActiveContextCapsule(input: BuildActiveContextCapsuleInput): ActiveContextCapsule {
  assertIndexValid(input.storyIndex);
  const openingRules = unique(input.openingRules);
  const closingTask = unique(input.closingTask);
  const previousTail = input.previousTail?.trim() || null;
  const styleCard = normalizedStyleCard(input.styleCard);
  if (!openingRules.length || !closingTask.length) {
    throw new ActiveContextCapsuleError("invalid-capsule", [], "Active context capsules require opening rules and a closing task.");
  }
  const jobBudget = input.modelProfile.job_budgets[input.jobType];
  if (!jobBudget) throw new ActiveContextCapsuleError("invalid-capsule", [], `Model profile ${input.modelProfile.id} has no ${input.jobType} budget.`);
  const maximumEvidenceTokens = jobBudget.maximumEvidenceTokens;
  const byId = new Map(input.storyIndex.records.map((record) => [record.id, record]));
  const seeds = explicitSeedIds(input.sceneContract);
  const missing = seeds.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new ActiveContextCapsuleError(
      "missing-required-records",
      missing,
      `Active context is missing required records: ${missing.join(", ")}.`,
    );
  }

  const maxDepth = input.maximumDependencyDepth ?? 2;
  const requiredReasons = new Map<string, string>();
  const depths = new Map<string, number>();
  const queue = seeds.map((id) => ({ id, depth: 0 }));
  const edges: Array<{ from: string; to: string }> = [];
  for (const seed of seeds) {
    requiredReasons.set(seed, "explicit scene contract reference");
    depths.set(seed, 0);
  }
  while (queue.length) {
    const current = queue.shift()!;
    const record = byId.get(current.id)!;
    if (current.depth >= maxDepth) continue;
    for (const dependency of [...record.dependencies].sort()) {
      const dependencyRecord = byId.get(dependency);
      if (!dependencyRecord) continue;
      edges.push({ from: current.id, to: dependency });
      const nextDepth = current.depth + 1;
      const knownDepth = depths.get(dependency);
      if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
      depths.set(dependency, nextDepth);
      requiredReasons.set(dependency, `dependency of ${current.id}`);
      queue.push({ id: dependency, depth: nextDepth });
    }
  }

  const requiredIds = [...requiredReasons.keys()].sort();
  const unsafe = requiredIds.filter((id) => authority(byId.get(id)!.status) === null);
  if (unsafe.length) {
    throw new ActiveContextCapsuleError(
      "unsafe-required-records",
      unsafe,
      `Required records are unresolved or deprecated: ${unsafe.join(", ")}.`,
    );
  }
  const requiredRecords = requiredIds.map((id) => activeRecord(byId.get(id)!, true, requiredReasons.get(id)!));
  const baseTokens = baseEvidenceTokens(input);
  const requiredTokens = requiredRecords.reduce((sum, record) => sum + record.estimated_tokens, baseTokens);
  if (requiredTokens > maximumEvidenceTokens) {
    throw new ActiveContextCapsuleError(
      "required-context-overflow",
      requiredIds,
      `Required context needs approximately ${requiredTokens} evidence tokens, above the ${maximumEvidenceTokens}-token ${input.jobType} budget.`,
    );
  }

  let usedTokens = requiredTokens;
  const optionalRecords: ActiveContextRecord[] = [];
  const omitted: string[] = [];
  const optionalIds = unique(input.optionalRecordIds ?? []).filter((id) => !requiredReasons.has(id)).sort();
  for (const id of optionalIds) {
    const record = byId.get(id);
    if (!record || authority(record.status) === null) {
      omitted.push(id);
      continue;
    }
    const candidate = activeRecord(record, false, "optional supporting record");
    if (usedTokens + candidate.estimated_tokens > maximumEvidenceTokens) {
      omitted.push(id);
      continue;
    }
    optionalRecords.push(candidate);
    usedTokens += candidate.estimated_tokens;
  }

  const records = [...requiredRecords, ...optionalRecords];
  const contractHash = stableHash(input.sceneContract);
  const storyIndexHash = input.storyIndex.manifest.index_hash;
  const capsuleSeed = {
    job_type: input.jobType,
    model_execution_profile: input.modelProfile.id,
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    record_ids: records.map((record) => record.id),
    opening_rules: openingRules,
    previous_tail: previousTail,
    style_card: styleCard,
    closing_task: closingTask,
  };
  const capsule: ActiveContextCapsule = {
    schema_version: "1.0.0",
    capsule_id: `CAP-${stableHash(capsuleSeed).slice(0, 16).toUpperCase()}`,
    job_type: input.jobType,
    model_execution_profile: input.modelProfile.id,
    scene_contract: structuredClone(input.sceneContract),
    contract_hash: contractHash,
    story_index_hash: storyIndexHash,
    opening_rules: openingRules,
    records,
    previous_tail: previousTail,
    style_card: styleCard,
    closing_task: closingTask,
    manifest: {
      included_record_ids: records.map((record) => record.id),
      omitted_record_ids: omitted,
      missing_required_record_ids: [],
      unsafe_required_record_ids: [],
      dependency_edges: edges
        .filter((edge, index, all) => all.findIndex((item) => item.from === edge.from && item.to === edge.to) === index)
        .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to)),
      estimated_evidence_tokens: usedTokens,
      maximum_evidence_tokens: maximumEvidenceTokens,
    },
  };
  if (!Value.Check(ActiveContextCapsuleSchema, capsule)) {
    throw new ActiveContextCapsuleError("invalid-capsule", records.map((record) => record.id), "Built active context capsule failed schema validation.");
  }
  return capsule;
}
