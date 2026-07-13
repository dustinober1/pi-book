import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readText(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

export function writeText(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, "utf8");
}

export function findProjectRoot(cwd: string): string | null {
  let current = resolve(cwd);
  while (true) {
    if (existsSync(join(current, "PROJECT.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function listFilesRecursive(root: string, predicate: (path: string) => boolean, depth = 0): string[] {
  if (!existsSync(root) || depth > 8) return [];
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "legacy") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) output.push(...listFilesRecursive(full, predicate, depth + 1));
    else if (predicate(full)) output.push(full);
  }
  return output;
}

export function listChapterFiles(root: string): string[] {
  const chapterRoot = join(root, "manuscript", "chapters");
  return listFilesRecursive(chapterRoot, (path) => /\.md$/i.test(path)).sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
}

export function countWords(text: string): number {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[>*_~|#]/g, " ");
  return cleaned.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function newestFiles(root: string, limit = 6): Array<{ path: string; mtimeMs: number }> {
  return listFilesRecursive(root, () => true)
    .map((path) => ({ path: path.slice(root.length + 1), mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);
}

export function safeSlug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "novel-project";
}

export function fileLabel(path: string): string {
  return basename(path).replace(/\.[^.]+$/, "");
}
