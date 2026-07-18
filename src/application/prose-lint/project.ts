import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { listChapterFiles, readText } from "../../infrastructure/files.js";
import { parseYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import { CanonSchema, type CanonState } from "../../domain/schemas.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../../domain/v1-3-schemas.js";
import { normalizeDocument } from "./normalize.js";
import type { ProseLintInput } from "./types.js";

function markdownFiles(root: string): string[] {
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.md$/i.test(entry.name) && statSync(path).isFile()) result.push(path);
    }
  };
  visit(root);
  return result.sort();
}

function chapterNumber(path: string): number | null {
  const match = path.match(/(?:^|\/)(?:0*)(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

export function loadProseLintInput(target: string, options: { scope?: { startChapter: number; endChapter: number } } = {}): ProseLintInput {
  const projectPath = join(target, "PROJECT.yaml");
  if (!existsSync(projectPath)) {
    const files = markdownFiles(target);
    if (!files.length) throw new Error(`No Markdown manuscript files found at ${target}.`);
    return { documents: files.map((path, index) => normalizeDocument(relative(target, path), readText(path) ?? "", index + 1)) };
  }
  const project = readProject(target);
  const book = readBook(target);
  const root = join(target, "books", book.book_id);
  const chapterPaths = listChapterFiles(root).filter((path) => {
    const number = chapterNumber(path);
    return !options.scope || (number !== null && number >= options.scope.startChapter && number <= options.scope.endChapter);
  });
  if (!chapterPaths.length) throw new Error(`No manuscript chapters found for ${book.book_id}.`);
  const canonText = readText(join(target, "series", "canon.yaml"));
  const canon = canonText ? parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml") : { facts: [], relationships: [] };
  const guardrailsText = readText(join(target, "series", "voice-guardrails.yaml"));
  const guardrails = guardrailsText ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "voice-guardrails.yaml") : null;
  const canonNames = (canon.facts ?? []).map((fact: { subject: string }) => fact.subject).filter(Boolean);
  return {
    documents: chapterPaths.map((path, index) => normalizeDocument(relative(target, path), readText(path) ?? "", index + 1)),
    ...(guardrails?.baseline.metrics ? { baselineMetrics: guardrails.baseline.metrics } : {}),
    projectContext: { projectRoot: target, bookId: project.active_book, chapterFiles: chapterPaths.map((path) => ({ path: relative(target, path), number: chapterNumber(path) })), canonNames, canonIds: (canon.facts ?? []).map((fact: { id: string }) => fact.id), threadIds: [], sourceIds: [] },
  };
}
