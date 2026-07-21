import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterExecutionStateSchema, type ChapterExecutionState } from "../domain/chapter-execution-state.js";

function executionStatePath(root: string, runId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error(`Invalid execution run id: ${runId}.`);
  return join(root, ".pi-book", "runs", runId, "execution-state.json");
}

export function writeChapterExecutionState(root: string, state: ChapterExecutionState): string {
  if (!Value.Check(ChapterExecutionStateSchema, state)) throw new Error("Chapter execution state failed schema validation.");
  const path = executionStatePath(root, state.run_id);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
  return path;
}

export function readChapterExecutionState(root: string, runId: string): ChapterExecutionState {
  const path = executionStatePath(root, runId);
  if (!existsSync(path)) throw new Error(`Chapter execution state ${runId} does not exist.`);
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Value.Check(ChapterExecutionStateSchema, value)) throw new Error(`Chapter execution state ${runId} failed schema validation.`);
  return value as ChapterExecutionState;
}
