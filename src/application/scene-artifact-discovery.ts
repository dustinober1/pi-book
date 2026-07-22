import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene artifact discovery.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene artifact discovery.");
}

function attempts(root: string, runId: string, sceneId: string, pattern: RegExp): number[] {
  requireRunId(runId);
  requireSceneId(sceneId);
  const directory = join(root, ".pi-book", "runs", runId, "scenes", sceneId);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .map((name) => Number.parseInt(name.match(pattern)?.[1] ?? "", 10))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);
}

export function sceneDraftAttempts(root: string, runId: string, sceneId: string): number[] {
  return attempts(root, runId, sceneId, /^draft-attempt-(\d+)\.json$/);
}

export function latestSceneDraftAttempt(root: string, runId: string, sceneId: string): number | null {
  return sceneDraftAttempts(root, runId, sceneId).at(-1) ?? null;
}

export function sceneAcceptanceDraftAttempts(root: string, runId: string, sceneId: string): number[] {
  return attempts(root, runId, sceneId, /^acceptance-draft-(\d+)\.json$/);
}

export function acceptedSceneDraftAttempt(root: string, runId: string, sceneId: string): number | null {
  const values = sceneAcceptanceDraftAttempts(root, runId, sceneId);
  if (values.length > 1) throw new Error(`Scene ${sceneId} has multiple acceptance artifacts: ${values.join(", ")}.`);
  return values[0] ?? null;
}
