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
    "series/intake.yaml",
    "series/decision-ledger.yaml",
    "series/taste-profile.yaml",
    "series/voice-profile.md",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
    "series/series-bible.md",
    "series/series-arc.yaml",
    "series/canon.yaml",
    "series/story-threads.yaml",
    "series/entity-registry.yaml",
    "series/state-ledger.yaml",
    "series/knowledge-ledger.yaml",
    "research/source-register.yaml",
    `books/${bookId}/reader-experiments.yaml`,
    `books/${bookId}/revision-tickets.yaml`,
    `books/${bookId}/research-ledger.yaml`,
    `books/${bookId}/book-strategy.yaml`,
    `books/${bookId}/voice-audits.yaml`,
    `books/${bookId}/premise-lab.yaml`,
    `books/${bookId}/historical-context.yaml`,
    `books/${bookId}/invention-ledger.yaml`,
  ];
  const experimentRoot = join(root, "series", "voice-experiments");
  const experimentFiles = listFilesRecursive(experimentRoot, (path) => /\.(?:yaml|md)$/i.test(path))
    .map((path) => normalizedRelative(root, path));
  const contractRoot = join(root, "books", bookId, "contracts");
  const contractFiles = listFilesRecursive(contractRoot, (path) => /\.yaml$/i.test(path))
    .map((path) => normalizedRelative(root, path));
  return [...new Set([...fixed, ...experimentFiles, ...contractFiles])].sort();
}

function calculateProjectHash(root: string, includeRunBookkeeping: boolean): string {
  const project = structuredClone(readProject(root));
  const book = readBook(root);
  if (!includeRunBookkeeping) {
    const automation = project.automation as typeof project.automation & { active_run?: unknown };
    delete automation.active_run;
  }
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

export function projectStateHash(root: string): string {
  return calculateProjectHash(root, true);
}

export function creativeProjectStateHash(root: string): string {
  return calculateProjectHash(root, false);
}
