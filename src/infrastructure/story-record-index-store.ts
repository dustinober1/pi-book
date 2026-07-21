import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import {
  StoryRecordIndexManifestSchema,
  StoryRecordIndexRecordSchema,
  type StoryRecordIndexManifest,
  type StoryRecordIndexRecord,
} from "../context/story-record-index.js";

export interface StoryRecordIndexPaths {
  directory: string;
  indexPath: string;
  manifestPath: string;
}

export function storyRecordIndexPaths(root: string): StoryRecordIndexPaths {
  const directory = join(root, ".pi-book", "index");
  return {
    directory,
    indexPath: join(directory, "story-records.jsonl"),
    manifestPath: join(directory, "story-records-manifest.json"),
  };
}

export function writeStoryRecordIndex(
  root: string,
  indexText: string,
  manifest: StoryRecordIndexManifest,
): StoryRecordIndexPaths {
  if (!Value.Check(StoryRecordIndexManifestSchema, manifest)) throw new Error("Invalid story record index manifest.");
  const paths = storyRecordIndexPaths(root);
  const suffix = `${process.pid}.${randomUUID()}.tmp`;
  const temporaryIndex = join(paths.directory, `.story-records.${suffix}`);
  const temporaryManifest = join(paths.directory, `.story-records-manifest.${suffix}`);
  try {
    mkdirSync(paths.directory, { recursive: true });
    writeFileSync(temporaryIndex, indexText, { encoding: "utf8", flag: "wx" });
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryIndex, paths.indexPath);
    renameSync(temporaryManifest, paths.manifestPath);
    return paths;
  } catch (error) {
    if (existsSync(temporaryIndex)) rmSync(temporaryIndex, { force: true });
    if (existsSync(temporaryManifest)) rmSync(temporaryManifest, { force: true });
    throw new Error("Unable to write story record index.", { cause: error });
  }
}

export function readStoredStoryRecordIndex(root: string): {
  indexText: string;
  manifest: StoryRecordIndexManifest;
  records: StoryRecordIndexRecord[];
} | null {
  const paths = storyRecordIndexPaths(root);
  if (!existsSync(paths.indexPath) || !existsSync(paths.manifestPath)) return null;
  let manifestValue: unknown;
  let records: StoryRecordIndexRecord[];
  let indexText: string;
  try {
    indexText = readFileSync(paths.indexPath, "utf8");
    manifestValue = JSON.parse(readFileSync(paths.manifestPath, "utf8")) as unknown;
    records = indexText.trim()
      ? indexText.trimEnd().split("\n").map((line) => JSON.parse(line) as StoryRecordIndexRecord)
      : [];
  } catch (error) {
    throw new Error("Unable to read story record index.", { cause: error });
  }
  if (!Value.Check(StoryRecordIndexManifestSchema, manifestValue)) throw new Error("Stored story record index manifest is invalid.");
  for (const record of records) if (!Value.Check(StoryRecordIndexRecordSchema, record)) throw new Error(`Stored story record ${record.id ?? "unknown"} is invalid.`);
  return { indexText, manifest: manifestValue as StoryRecordIndexManifest, records };
}
