import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";

export interface ContextCacheKeyInput {
  projectHash: string;
  sourceHashes: Readonly<Record<string, string>>;
  runtimeProfile: RuntimeProfileId;
  distillerVersion: string;
  sectionPolicyVersion: string;
}

export interface ContextCachePayload {
  text: string;
  report: unknown;
}

interface ContextCacheEnvelope {
  schemaVersion: "1.0.0";
  key: string;
  payloadHash: string;
  payload: ContextCachePayload;
}

function normalizedInput(input: ContextCacheKeyInput): object {
  return {
    projectHash: input.projectHash,
    sourceHashes: Object.fromEntries(Object.entries(input.sourceHashes).sort(([left], [right]) => left.localeCompare(right))),
    runtimeProfile: input.runtimeProfile,
    distillerVersion: input.distillerVersion,
    sectionPolicyVersion: input.sectionPolicyVersion,
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function contextCacheKey(input: ContextCacheKeyInput): string {
  return hashJson(normalizedInput(input));
}

function cachePath(root: string, key: string): string {
  return join(root, ".pi-book", "cache", "v1", `${key}.json`);
}

export function writeContextCache(root: string, key: string, payload: ContextCachePayload): void {
  const path = cachePath(root, key);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  const envelope: ContextCacheEnvelope = { schemaVersion: "1.0.0", key, payloadHash: hashJson(payload), payload };
  try {
    writeFileSync(temporary, `${JSON.stringify(envelope)}\n`, "utf8");
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function readContextCache(root: string, key: string): ContextCachePayload | null {
  const path = cachePath(root, key);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ContextCacheEnvelope>;
    if (parsed.schemaVersion !== "1.0.0" || parsed.key !== key || !parsed.payload || typeof parsed.payload.text !== "string" || typeof parsed.payloadHash !== "string") return null;
    if (hashJson(parsed.payload) !== parsed.payloadHash) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}
