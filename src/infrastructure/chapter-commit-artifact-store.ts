import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterCommitArtifactSchema, type ChapterCommitArtifact } from "../domain/chapter-commit-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for chapter commit artifact.");
}

function requireChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter commit artifact chapter must be a positive integer.");
}

export function chapterCommitArtifactPath(root: string, runId: string, chapter: number): string {
  requireRunId(runId);
  requireChapter(chapter);
  return join(root, ".pi-book", "runs", runId, "chapters", `chapter-${String(chapter).padStart(3, "0")}`, "commit.json");
}

export function writeChapterCommitArtifact(root: string, artifact: ChapterCommitArtifact): string {
  requireRunId(artifact.run_id);
  requireChapter(artifact.chapter);
  if (!Value.Check(ChapterCommitArtifactSchema, artifact)) throw new Error("Invalid chapter commit artifact.");
  const path = chapterCommitArtifactPath(root, artifact.run_id, artifact.chapter);
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "chapters", `chapter-${String(artifact.chapter).padStart(3, "0")}`);
  const temporary = join(directory, `.commit.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write chapter commit artifact.", { cause: error });
  }
}

export function readChapterCommitArtifact(root: string, runId: string, chapter: number): ChapterCommitArtifact | null {
  const path = chapterCommitArtifactPath(root, runId, chapter);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read chapter commit artifact.", { cause: error });
  }
  if (!Value.Check(ChapterCommitArtifactSchema, value)) throw new Error("Stored chapter commit artifact is invalid.");
  return value as ChapterCommitArtifact;
}
