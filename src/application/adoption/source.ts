import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { WizardSource } from "../../wizard/types.js";

export type AdoptionSourceRef =
  | { kind: "authorized-path"; path: string }
  | { kind: "upload"; source_id: string };

export interface ResolvedAdoptionSource {
  absolutePath: string;
  originalName: string;
  extension: string;
  byteSize: number;
  sourceHash: string;
  isDirectory: boolean;
}

export interface AdoptionSourceResolver {
  authorizedPaths?: Set<string>;
  resolveUpload?(sourceId: string): WizardSource | null;
}

const allowedFileExtensions = new Set([".docx", ".epub", ".md", ".txt"]);

function directoryDigest(path: string): { hash: string; bytes: number } {
  const hash = createHash("sha256");
  let bytes = 0;
  const files = readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|txt)$/i.test(entry.name))
    .sort((left, right) => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(left.name, right.name));
  if (!files.length) throw new Error("Chapter directory contains no .md or .txt files.");
  for (const entry of files) {
    const absolute = join(path, entry.name);
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Chapter source must be a regular file: ${entry.name}`);
    const content = readFileSync(absolute);
    bytes += content.length;
    hash.update(entry.name).update("\0").update(content);
  }
  return { hash: hash.digest("hex"), bytes };
}

function resolved(path: string, originalName: string): ResolvedAdoptionSource {
  if (!existsSync(path)) throw new Error(`Manuscript source does not exist: ${originalName}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error("Manuscript source may not be a symbolic link.");
  if (stat.isDirectory()) {
    const digest = directoryDigest(path);
    return { absolutePath: path, originalName, extension: "directory", byteSize: digest.bytes, sourceHash: digest.hash, isDirectory: true };
  }
  if (!stat.isFile()) throw new Error("Manuscript source must be a regular file or chapter directory.");
  const extension = extname(path).toLowerCase();
  if (!allowedFileExtensions.has(extension)) throw new Error(`Unsupported manuscript source extension: ${extension || "none"}.`);
  const content = readFileSync(path);
  if (!content.length) throw new Error("Manuscript source is empty.");
  return { absolutePath: path, originalName, extension, byteSize: content.length, sourceHash: createHash("sha256").update(content).digest("hex"), isDirectory: false };
}

export function resolveAdoptionSource(ref: AdoptionSourceRef, resolver: AdoptionSourceResolver = {}): ResolvedAdoptionSource {
  if (ref.kind === "upload") {
    const upload = resolver.resolveUpload?.(ref.source_id);
    if (!upload) throw new Error(`Unknown or expired wizard source ID: ${ref.source_id}`);
    return resolved(upload.absolutePath, upload.originalName);
  }
  const absolute = resolve(ref.path);
  if (resolver.authorizedPaths && !resolver.authorizedPaths.has(absolute)) throw new Error("The selected source path was not authorized by the current Pi session.");
  return resolved(absolute, basename(absolute));
}
