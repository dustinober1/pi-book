import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { readBook, readProject } from "../project/store.js";
export interface CompileResult { output: string; chapters: number; words: number }
function chapterNumber(path: string): number | null { const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/); return match ? Number.parseInt(match[1] ?? "", 10) : null; }
export function compileActiveBook(root: string): CompileResult {
  const project = readProject(root); const book = readBook(root); const bookRoot = join(root, "books", book.book_id); const chapters = listChapterFiles(bookRoot);
  if (!chapters.length) throw new Error("No manuscript chapters exist for the active book.");
  const numbers = chapters.map(chapterNumber); const seen = new Set<number>();
  for (const number of numbers) { if (number === null) continue; if (seen.has(number)) throw new Error(`Duplicate Chapter ${number} files prevent compilation.`); seen.add(number); }
  const numeric = [...seen].sort((a, b) => a - b); for (let i = 1; i <= (numeric.at(-1) ?? 0); i += 1) if (!seen.has(i)) throw new Error(`Missing Chapter ${i} prevents compilation.`);
  mkdirSync(join(root, "delivery"), { recursive: true });
  const body = chapters.map((path) => { const text = (readText(path) ?? "").trim(); return /^#\s+/m.test(text) ? text : `# ${basename(path, ".md")}\n\n${text}`; }).join("\n\n---\n\n");
  const output = join(root, "delivery", "manuscript.md"); const title = book.title || project.project_name; writeFileSync(output, `# ${title}\n\n${body}\n`, "utf8");
  return { output, chapters: chapters.length, words: countWords(body) };
}
