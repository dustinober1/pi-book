import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  ActiveContextCapsuleSchema,
  type ActiveContextCapsule,
} from "../domain/active-context-capsule.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for active context capsule.");
}

function requireCapsuleId(capsuleId: string): void {
  if (!/^CAP-[A-F0-9]{16}$/.test(capsuleId)) throw new Error("Invalid capsule ID.");
}

export function activeContextCapsulePath(root: string, runId: string, capsule: Pick<ActiveContextCapsule, "capsule_id">): string {
  requireRunId(runId);
  requireCapsuleId(capsule.capsule_id);
  return join(root, ".pi-book", "runs", runId, "capsules", `${capsule.capsule_id}.json`);
}

export function serializeActiveContextCapsule(runId: string, capsule: ActiveContextCapsule): string {
  requireRunId(runId);
  requireCapsuleId(capsule.capsule_id);
  if (!Value.Check(ActiveContextCapsuleSchema, capsule)) throw new Error("Invalid active context capsule.");
  return `${JSON.stringify(capsule, null, 2)}\n`;
}

export function writeActiveContextCapsule(root: string, runId: string, capsule: ActiveContextCapsule): string {
  const content = serializeActiveContextCapsule(runId, capsule);
  const directory = join(root, ".pi-book", "runs", runId, "capsules");
  const path = activeContextCapsulePath(root, runId, capsule);
  const temporary = join(directory, `.${capsule.capsule_id}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write active context capsule.", { cause: error });
  }
}

export function readActiveContextCapsule(root: string, runId: string, capsuleId: string): ActiveContextCapsule | null {
  requireRunId(runId);
  requireCapsuleId(capsuleId);
  const path = join(root, ".pi-book", "runs", runId, "capsules", `${capsuleId}.json`);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read active context capsule.", { cause: error });
  }
  if (!Value.Check(ActiveContextCapsuleSchema, value)) throw new Error("Stored active context capsule is invalid.");
  return value as ActiveContextCapsule;
}
