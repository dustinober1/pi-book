import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ScenePatchArtifactSchema, type ScenePatchArtifact } from "../domain/scene-patch-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene patch artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene patch artifact.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene patch artifact attempt must be a positive integer.");
}

export function scenePatchArtifactPath(root: string, runId: string, sceneId: string, attempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(attempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `patch-attempt-${attempt}.json`);
}

export function writeScenePatchArtifact(root: string, artifact: ScenePatchArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.patch_attempt);
  if (!Value.Check(ScenePatchArtifactSchema, artifact)) throw new Error("Invalid scene patch artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = scenePatchArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.patch_attempt);
  const temporary = join(directory, `.patch-attempt-${artifact.patch_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene patch artifact.", { cause: error });
  }
}

export function readScenePatchArtifact(root: string, runId: string, sceneId: string, attempt: number): ScenePatchArtifact | null {
  const path = scenePatchArtifactPath(root, runId, sceneId, attempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene patch artifact.", { cause: error });
  }
  if (!Value.Check(ScenePatchArtifactSchema, value)) throw new Error("Stored scene patch artifact is invalid.");
  return value as ScenePatchArtifact;
}
