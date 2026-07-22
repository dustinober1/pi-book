import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { SceneAcceptanceArtifactSchema, type SceneAcceptanceArtifact } from "../domain/scene-acceptance-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene acceptance artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene acceptance artifact.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene acceptance draft attempt must be a positive integer.");
}

export function sceneAcceptanceArtifactPath(root: string, runId: string, sceneId: string, draftAttempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(draftAttempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `acceptance-draft-${draftAttempt}.json`);
}

export function writeSceneAcceptanceArtifact(root: string, artifact: SceneAcceptanceArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.draft_attempt);
  if (!Value.Check(SceneAcceptanceArtifactSchema, artifact)) throw new Error("Invalid scene acceptance artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = sceneAcceptanceArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.draft_attempt);
  const temporary = join(directory, `.acceptance-draft-${artifact.draft_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene acceptance artifact.", { cause: error });
  }
}

export function readSceneAcceptanceArtifact(root: string, runId: string, sceneId: string, draftAttempt: number): SceneAcceptanceArtifact | null {
  const path = sceneAcceptanceArtifactPath(root, runId, sceneId, draftAttempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene acceptance artifact.", { cause: error });
  }
  if (!Value.Check(SceneAcceptanceArtifactSchema, value)) throw new Error("Stored scene acceptance artifact is invalid.");
  return value as SceneAcceptanceArtifact;
}
