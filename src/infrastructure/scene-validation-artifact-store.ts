import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { SceneValidationArtifactSchema, type SceneValidationArtifact } from "../domain/scene-validation-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene validation artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene validation artifact.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene validation artifact attempt must be a positive integer.");
}

export function sceneValidationArtifactPath(root: string, runId: string, sceneId: string, attempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(attempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `validation-attempt-${attempt}.json`);
}

export function writeSceneValidationArtifact(root: string, artifact: SceneValidationArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.draft_attempt);
  if (!Value.Check(SceneValidationArtifactSchema, artifact)) throw new Error("Invalid scene validation artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = sceneValidationArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.draft_attempt);
  const temporary = join(directory, `.validation-attempt-${artifact.draft_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene validation artifact.", { cause: error });
  }
}

export function readSceneValidationArtifact(root: string, runId: string, sceneId: string, attempt: number): SceneValidationArtifact | null {
  const path = sceneValidationArtifactPath(root, runId, sceneId, attempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene validation artifact.", { cause: error });
  }
  if (!Value.Check(SceneValidationArtifactSchema, value)) throw new Error("Stored scene validation artifact is invalid.");
  return value as SceneValidationArtifact;
}
