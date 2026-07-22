import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { PlanChangeRequestSchema, type PlanChangeRequest } from "../domain/plan-change-request.js";

function requireRequestId(requestId: string): void {
  if (!/^PC-[0-9]{3}$/.test(requestId)) throw new Error("Plan-change request ID must use PC-NNN format.");
}

export function planChangeRequestStorePath(root: string, requestId: string): string {
  requireRequestId(requestId);
  return join(root, ".pi-book", "plan-changes", `${requestId}.json`);
}

export function writePlanChangeRequest(root: string, request: PlanChangeRequest): string {
  requireRequestId(request.request_id);
  if (!Value.Check(PlanChangeRequestSchema, request)) throw new Error("Invalid plan-change request.");
  const directory = join(root, ".pi-book", "plan-changes");
  const path = planChangeRequestStorePath(root, request.request_id);
  const temporary = join(directory, `.${request.request_id}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write plan-change request.", { cause: error });
  }
}

export function readStoredPlanChangeRequest(root: string, requestId: string): PlanChangeRequest | null {
  const path = planChangeRequestStorePath(root, requestId);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read plan-change request.", { cause: error });
  }
  if (!Value.Check(PlanChangeRequestSchema, value)) throw new Error("Stored plan-change request is invalid.");
  return value as PlanChangeRequest;
}

export function listStoredPlanChangeRequests(root: string): PlanChangeRequest[] {
  const directory = join(root, ".pi-book", "plan-changes");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /^PC-[0-9]{3}\.json$/.test(name))
    .sort()
    .map((name) => readStoredPlanChangeRequest(root, name.slice(0, -5)))
    .filter((item): item is PlanChangeRequest => item !== null);
}
