import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ActiveContextCapsuleSchema, type ActiveContextCapsule } from "../domain/active-context-capsule.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/;

export interface ContextCapsuleCacheKeyInput {
  projectHash: string;
  runtimeProfile: string;
  capsule: ActiveContextCapsule;
}

interface CachedContextCapsuleEnvelope {
  schema_version: "1.0.0";
  key: string;
  project_hash: string;
  runtime_profile: string;
  contract_hash: string;
  story_index_hash: string;
  capsule_id: string;
  model_execution_profile: ActiveContextCapsule["model_execution_profile"];
  job_type: ActiveContextCapsule["job_type"];
  capsule: ActiveContextCapsule;
}

function assertKeyInput(input: ContextCapsuleCacheKeyInput): void {
  if (!HASH_PATTERN.test(input.projectHash)) throw new Error("Context capsule cache requires a valid project hash.");
  if (!input.runtimeProfile.trim()) throw new Error("Context capsule cache requires a runtime profile.");
  if (!Value.Check(ActiveContextCapsuleSchema, input.capsule)) throw new Error("Context capsule cache requires a valid capsule.");
}

function stableDimensions(input: ContextCapsuleCacheKeyInput): Omit<CachedContextCapsuleEnvelope, "schema_version" | "key" | "capsule"> {
  return {
    project_hash: input.projectHash,
    runtime_profile: input.runtimeProfile.trim(),
    contract_hash: input.capsule.contract_hash,
    story_index_hash: input.capsule.story_index_hash,
    capsule_id: input.capsule.capsule_id,
    model_execution_profile: input.capsule.model_execution_profile,
    job_type: input.capsule.job_type,
  };
}

export function contextCapsuleCacheKey(input: ContextCapsuleCacheKeyInput): string {
  assertKeyInput(input);
  return createHash("sha256").update(JSON.stringify(stableDimensions(input)), "utf8").digest("hex");
}

export function contextCapsuleCachePath(root: string, key: string): string {
  if (!CACHE_KEY_PATTERN.test(key)) throw new Error("Invalid context capsule cache key.");
  return join(root, ".pi-book", "cache", "context-capsules", `${key}.json`);
}

function envelope(input: ContextCapsuleCacheKeyInput): CachedContextCapsuleEnvelope {
  const key = contextCapsuleCacheKey(input);
  return {
    schema_version: "1.0.0",
    key,
    ...stableDimensions(input),
    capsule: structuredClone(input.capsule),
  };
}

function validEnvelope(value: unknown, input: ContextCapsuleCacheKeyInput): value is CachedContextCapsuleEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CachedContextCapsuleEnvelope>;
  const expected = envelope(input);
  return candidate.schema_version === "1.0.0"
    && candidate.key === expected.key
    && candidate.project_hash === expected.project_hash
    && candidate.runtime_profile === expected.runtime_profile
    && candidate.contract_hash === expected.contract_hash
    && candidate.story_index_hash === expected.story_index_hash
    && candidate.capsule_id === expected.capsule_id
    && candidate.model_execution_profile === expected.model_execution_profile
    && candidate.job_type === expected.job_type
    && Value.Check(ActiveContextCapsuleSchema, candidate.capsule);
}

export function writeCachedContextCapsule(root: string, input: ContextCapsuleCacheKeyInput): { key: string; path: string } {
  const value = envelope(input);
  const directory = join(root, ".pi-book", "cache", "context-capsules");
  const path = contextCapsuleCachePath(root, value.key);
  const temporary = join(directory, `.${value.key}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return { key: value.key, path };
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write cached context capsule.", { cause: error });
  }
}

export function readCachedContextCapsule(root: string, input: ContextCapsuleCacheKeyInput): ActiveContextCapsule | null {
  const key = contextCapsuleCacheKey(input);
  const path = contextCapsuleCachePath(root, key);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read cached context capsule.", { cause: error });
  }
  if (!validEnvelope(value, input)) return null;
  return structuredClone(value.capsule);
}
