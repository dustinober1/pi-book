import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type QualityCacheRetention = "delete-on-success" | "keep-latest" | "keep-all";

export interface WriteQualityArtifactInput {
  runId: string;
  chapter: number;
  name: string;
  artifact: unknown;
}

export interface WrittenQualityArtifact {
  path: string;
  relativePath: string;
  hash: string;
}

function safeRunId(runId: string): string {
  const normalized = runId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized) || normalized.includes("..")) {
    throw new Error("Quality cache run ID is invalid.");
  }
  return normalized;
}

function safeArtifactName(name: string): string {
  const normalized = name.trim().toLocaleLowerCase("en-US");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) throw new Error("Quality cache artifact name is invalid.");
  return normalized;
}

function positiveChapter(chapter: number): number {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("Quality cache chapter must be a positive integer.");
  return chapter;
}

function generationRoot(root: string): string {
  return join(root, ".pi-book", "cache", "generation");
}

export function writeQualityArtifact(root: string, input: WriteQualityArtifactInput): WrittenQualityArtifact {
  const runId = safeRunId(input.runId);
  const chapter = positiveChapter(input.chapter);
  const name = safeArtifactName(input.name);
  const chapterDirectory = join(generationRoot(root), runId, `chapter-${String(chapter).padStart(2, "0")}`);
  const path = join(chapterDirectory, `${name}.json`);
  const temporary = join(chapterDirectory, `.${name}.${process.pid}.${randomUUID()}.tmp`);
  const content = `${JSON.stringify(input.artifact, null, 2)}\n`;
  try {
    mkdirSync(chapterDirectory, { recursive: true });
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error(`Unable to write quality cache artifact ${name}.`, { cause: error });
  }
  return {
    path,
    relativePath: `.pi-book/cache/generation/${runId}/chapter-${String(chapter).padStart(2, "0")}/${name}.json`,
    hash: createHash("sha256").update(content, "utf8").digest("hex"),
  };
}

export function finalizeQualityCache(root: string, runIdValue: string, retention: QualityCacheRetention = "delete-on-success"): void {
  const runId = safeRunId(runIdValue);
  const directory = generationRoot(root);
  const runDirectory = join(directory, runId);
  if (retention === "keep-all") return;
  if (retention === "delete-on-success") {
    rmSync(runDirectory, { recursive: true, force: true });
    return;
  }
  if (retention !== "keep-latest") throw new Error(`Unknown quality cache retention: ${String(retention)}.`);
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== runId) rmSync(join(directory, entry.name), { recursive: true, force: true });
  }
}
