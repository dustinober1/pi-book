import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterValidationArtifactSchema, type ChapterValidationArtifact } from "../domain/chapter-validation-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for chapter validation artifact.");
}

function requireChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter validation artifact chapter must be a positive integer.");
}

export function chapterValidationArtifactPath(root: string, runId: string, chapter: number): string {
  requireRunId(runId);
  requireChapter(chapter);
  return join(root, ".pi-book", "runs", runId, "chapters", `chapter-${String(chapter).padStart(3, "0")}`, "validation.json");
}

export function writeChapterValidationArtifact(root: string, artifact: ChapterValidationArtifact): string {
  requireRunId(artifact.run_id);
  requireChapter(artifact.chapter);
  if (!Value.Check(ChapterValidationArtifactSchema, artifact)) throw new Error("Invalid chapter validation artifact.");
  const path = chapterValidationArtifactPath(root, artifact.run_id, artifact.chapter);
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "chapters", `chapter-${String(artifact.chapter).padStart(3, "0")}`);
  const temporary = join(directory, `.validation.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write chapter validation artifact.", { cause: error });
  }
}

export function readChapterValidationArtifact(root: string, runId: string, chapter: number): ChapterValidationArtifact | null {
  const path = chapterValidationArtifactPath(root, runId, chapter);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read chapter validation artifact.", { cause: error });
  }
  if (!Value.Check(ChapterValidationArtifactSchema, value)) throw new Error("Stored chapter validation artifact is invalid.");
  return value as ChapterValidationArtifact;
}
