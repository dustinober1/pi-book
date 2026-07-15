import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { listFilesRecursive, readText } from "../infrastructure/files.js";
import { readBook, readProject } from "../project/store.js";

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/");
}

function guardedEvidencePaths(root: string, bookId: string): string[] {
  const fixed = [
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    "research/source-register.yaml",
    `books/${bookId}/reader-experiments.yaml`,
    `books/${bookId}/revision-tickets.yaml`,
    `books/${bookId}/research-ledger.yaml`,
    `books/${bookId}/book-strategy.yaml`,
    `books/${bookId}/voice-audits.yaml`,
  ];
  const experimentRoot = join(root, "series", "voice-experiments");
  const experimentFiles = listFilesRecursive(experimentRoot, (path) => /\.(?:yaml|md)$/i.test(path))
    .map((path) => normalizedRelative(root, path));
  return [...new Set([...fixed, ...experimentFiles])].sort();
}

export function projectStateHash(root: string): string {
  const project = readProject(root);
  const book = readBook(root);
  const hash = createHash("sha256")
    .update("PROJECT.yaml\0")
    .update(stringifyYaml(project))
    .update("\0BOOK.yaml\0")
    .update(stringifyYaml(book));

  for (const path of guardedEvidencePaths(root, book.book_id)) {
    hash.update("\0").update(path).update("\0").update(readText(join(root, path)) ?? "<missing>");
  }
  return hash.digest("hex");
}
