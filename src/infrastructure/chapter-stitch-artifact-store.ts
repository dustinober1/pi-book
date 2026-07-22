import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterStitchArtifactSchema, type ChapterStitchArtifact } from "../domain/chapter-stitch-artifact.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for chapter stitch artifact.");
}

function requireChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter stitch artifact chapter must be a positive integer.");
}

export function chapterStitchArtifactPath(root: string, runId: string, chapter: number): string {
  requireRunId(runId);
  requireChapter(chapter);
  return join(root, ".pi-book", "runs", runId, "chapters", `chapter-${String(chapter).padStart(3, "0")}`, "stitched.json");
}

export function writeChapterStitchArtifact(root: string, artifact: ChapterStitchArtifact): string {
  requireRunId(artifact.run_id);
  requireChapter(artifact.chapter);
  if (!Value.Check(ChapterStitchArtifactSchema, artifact)) throw new Error("Invalid chapter stitch artifact.");
  const path = chapterStitchArtifactPath(root, artifact.run_id, artifact.chapter);
  const directory = join(root, ".pi-book", "runs", artifact.run_id, "chapters", `chapter-${String(artifact.chapter).padStart(3, "0")}`);
  const temporary = join(directory, `.stitched.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write chapter stitch artifact.", { cause: error });
  }
}

export function readChapterStitchArtifact(root: string, runId: string, chapter: number): ChapterStitchArtifact | null {
  const path = chapterStitchArtifactPath(root, runId, chapter);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read chapter stitch artifact.", { cause: error });
  }
  if (!Value.Check(ChapterStitchArtifactSchema, value)) throw new Error("Stored chapter stitch artifact is invalid.");
  return value as ChapterStitchArtifact;
}
