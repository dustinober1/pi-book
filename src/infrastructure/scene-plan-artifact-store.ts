import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ScenePlanArtifactSchema, type ScenePlanArtifact } from "../domain/scene-plan-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene plan artifact.");
}
function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene plan artifact.");
}
function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene plan artifact attempt must be a positive integer.");
}

export function scenePlanArtifactPath(root: string, runId: string, sceneId: string, attempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(attempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `plan-attempt-${attempt}.json`);
}

export function writeScenePlanArtifact(root: string, artifact: ScenePlanArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.plan_attempt);
  if (!Value.Check(ScenePlanArtifactSchema, artifact)) throw new Error("Invalid scene plan artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = scenePlanArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.plan_attempt);
  const temporary = join(directory, `.plan-attempt-${artifact.plan_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene plan artifact.", { cause: error });
  }
}

export function readScenePlanArtifact(root: string, runId: string, sceneId: string, attempt: number): ScenePlanArtifact | null {
  const path = scenePlanArtifactPath(root, runId, sceneId, attempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, "utf8")) as unknown; }
  catch (error) { throw new Error("Unable to read scene plan artifact.", { cause: error }); }
  if (!Value.Check(ScenePlanArtifactSchema, value)) throw new Error("Stored scene plan artifact is invalid.");
  return value as ScenePlanArtifact;
}
