import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { SceneDraftArtifactSchema, type SceneDraftArtifact } from "../domain/scene-draft-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene draft artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene draft artifact.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene draft artifact attempt must be a positive integer.");
}

export function sceneDraftArtifactPath(root: string, runId: string, sceneId: string, attempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(attempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `draft-attempt-${attempt}.json`);
}

export function writeSceneDraftArtifact(root: string, artifact: SceneDraftArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.attempt);
  if (!Value.Check(SceneDraftArtifactSchema, artifact)) throw new Error("Invalid scene draft artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = sceneDraftArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.attempt);
  const temporary = join(directory, `.draft-attempt-${artifact.attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene draft artifact.", { cause: error });
  }
}

export function readSceneDraftArtifact(root: string, runId: string, sceneId: string, attempt: number): SceneDraftArtifact | null {
  const path = sceneDraftArtifactPath(root, runId, sceneId, attempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene draft artifact.", { cause: error });
  }
  if (!Value.Check(SceneDraftArtifactSchema, value)) throw new Error("Stored scene draft artifact is invalid.");
  return value as SceneDraftArtifact;
}
