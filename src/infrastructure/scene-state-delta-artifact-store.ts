import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { SceneStateDeltaArtifactSchema, type SceneStateDeltaArtifact } from "../domain/scene-state-delta-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene state-delta artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene state-delta artifact.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene state-delta artifact attempt must be a positive integer.");
}

export function sceneStateDeltaArtifactPath(root: string, runId: string, sceneId: string, draftAttempt: number, extractionAttempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireAttempt(draftAttempt);
  requireAttempt(extractionAttempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `state-delta-draft-${draftAttempt}-attempt-${extractionAttempt}.json`);
}

export function writeSceneStateDeltaArtifact(root: string, artifact: SceneStateDeltaArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireAttempt(artifact.draft_attempt);
  requireAttempt(artifact.extraction_attempt);
  if (!Value.Check(SceneStateDeltaArtifactSchema, artifact)) throw new Error("Invalid scene state-delta artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = sceneStateDeltaArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.draft_attempt, artifact.extraction_attempt);
  const temporary = join(directory, `.state-delta-draft-${artifact.draft_attempt}-attempt-${artifact.extraction_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene state-delta artifact.", { cause: error });
  }
}

export function readSceneStateDeltaArtifact(
  root: string,
  runId: string,
  sceneId: string,
  draftAttempt: number,
  extractionAttempt: number,
): SceneStateDeltaArtifact | null {
  const path = sceneStateDeltaArtifactPath(root, runId, sceneId, draftAttempt, extractionAttempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene state-delta artifact.", { cause: error });
  }
  if (!Value.Check(SceneStateDeltaArtifactSchema, value)) throw new Error("Stored scene state-delta artifact is invalid.");
  return value as SceneStateDeltaArtifact;
}
