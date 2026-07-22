import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  SceneCriticArtifactSchema,
  isSceneCriticJobType,
  type SceneCriticArtifact,
  type SceneCriticJobType,
} from "../domain/scene-critic-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for scene critic artifact.");
}

function requireSceneId(sceneId: string): void {
  if (!/^CH-[0-9]{3}-SC-[0-9]{2}-V[0-9]+$/.test(sceneId)) throw new Error("Invalid scene ID for scene critic artifact.");
}

function requireJobType(jobType: unknown): asserts jobType is SceneCriticJobType {
  if (!isSceneCriticJobType(jobType)) throw new Error("Invalid scene critic job type.");
}

function requireAttempt(attempt: number): void {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Scene critic artifact attempt must be a positive integer.");
}

export function sceneCriticArtifactPath(root: string, runId: string, sceneId: string, jobType: SceneCriticJobType, attempt: number): string {
  requireRunId(runId);
  requireSceneId(sceneId);
  requireJobType(jobType);
  requireAttempt(attempt);
  return join(root, ".pi-book", "runs", runId, "scenes", sceneId, `${jobType}-attempt-${attempt}.json`);
}

export function writeSceneCriticArtifact(root: string, artifact: SceneCriticArtifact): string {
  requireRunId(artifact.run_id);
  requireSceneId(artifact.scene_id);
  requireJobType(artifact.job_type);
  requireAttempt(artifact.critic_attempt);
  if (!Value.Check(SceneCriticArtifactSchema, artifact)) throw new Error("Invalid scene critic artifact.");
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "scenes", artifact.scene_id);
  const path = sceneCriticArtifactPath(root, artifact.run_id, artifact.scene_id, artifact.job_type, artifact.critic_attempt);
  const temporary = join(directory, `.${artifact.job_type}-attempt-${artifact.critic_attempt}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write scene critic artifact.", { cause: error });
  }
}

export function readSceneCriticArtifact(
  root: string,
  runId: string,
  sceneId: string,
  jobType: SceneCriticJobType,
  attempt: number,
): SceneCriticArtifact | null {
  const path = sceneCriticArtifactPath(root, runId, sceneId, jobType, attempt);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read scene critic artifact.", { cause: error });
  }
  if (!Value.Check(SceneCriticArtifactSchema, value)) throw new Error("Stored scene critic artifact is invalid.");
  return value as SceneCriticArtifact;
}
