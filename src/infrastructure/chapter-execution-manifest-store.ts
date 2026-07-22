import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { ChapterExecutionManifestSchema, type ChapterExecutionManifest } from "../domain/chapter-execution-manifest.js";

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Invalid run ID for chapter execution manifest.");
}

function requireChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Chapter execution manifest requires a positive chapter number.");
}

export function chapterExecutionManifestPath(root: string, runId: string, chapter: number): string {
  requireRunId(runId);
  requireChapter(chapter);
  return join(root, ".pi-book", "runs", runId, "chapters", `chapter-${String(chapter).padStart(3, "0")}`, "execution-manifest.json");
}

export function serializeChapterExecutionManifest(manifest: ChapterExecutionManifest): string {
  requireRunId(manifest.run_id);
  requireChapter(manifest.chapter);
  if (!Value.Check(ChapterExecutionManifestSchema, manifest)) throw new Error("Invalid chapter execution manifest.");
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function writeChapterExecutionManifest(root: string, manifest: ChapterExecutionManifest): string {
  const content = serializeChapterExecutionManifest(manifest);
  const path = chapterExecutionManifestPath(root, manifest.run_id, manifest.chapter);
  const directory = join(root, ".pi-book", "runs", manifest.run_id, "chapters", `chapter-${String(manifest.chapter).padStart(3, "0")}`);
  const temporary = join(directory, `.execution-manifest.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write chapter execution manifest.", { cause: error });
  }
}

export function readChapterExecutionManifest(root: string, runId: string, chapter: number): ChapterExecutionManifest | null {
  const path = chapterExecutionManifestPath(root, runId, chapter);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read chapter execution manifest.", { cause: error });
  }
  if (!Value.Check(ChapterExecutionManifestSchema, value)) throw new Error("Stored chapter execution manifest is invalid.");
  const manifest = value as ChapterExecutionManifest;
  if (manifest.run_id !== runId || manifest.chapter !== chapter) {
    throw new Error("Stored chapter execution manifest identity does not match its path.");
  }
  return manifest;
}
