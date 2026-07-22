import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  ChapterExecutionStateSchema,
  type ChapterExecutionState,
} from "../domain/chapter-execution-state.js";

function safeRunId(runId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId);
}

function requireRunId(runId: string): void {
  if (!safeRunId(runId)) throw new Error("Invalid run ID for chapter execution state.");
}

export function chapterExecutionStatePath(root: string, runId: string): string {
  requireRunId(runId);
  return join(root, ".pi-book", "runs", runId, "execution-state.json");
}

export function serializeChapterExecutionState(state: ChapterExecutionState): string {
  requireRunId(state.run_id);
  if (!Value.Check(ChapterExecutionStateSchema, state)) throw new Error("Invalid chapter execution state.");
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function writeChapterExecutionState(root: string, state: ChapterExecutionState): string {
  const content = serializeChapterExecutionState(state);
  const directory = join(root, ".pi-book", "runs", state.run_id);
  const path = chapterExecutionStatePath(root, state.run_id);
  const temporary = join(directory, `.execution-state.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write chapter execution state.", { cause: error });
  }
}

export function readChapterExecutionState(root: string, runId: string): ChapterExecutionState | null {
  const path = chapterExecutionStatePath(root, runId);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read chapter execution state.", { cause: error });
  }
  if (!Value.Check(ChapterExecutionStateSchema, value)) throw new Error("Stored chapter execution state is invalid.");
  const state = value as ChapterExecutionState;
  if (state.run_id !== runId) throw new Error("Stored chapter execution state run identity does not match its path.");
  return state;
}
