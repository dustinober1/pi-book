import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { readBook, readProject } from "../project/store.js";

export interface CompileResult {
  output: string;
  chapters: number;
  words: number;
}

export function compileActiveBook(root: string): CompileResult {
  const project = readProject(root);
  const book = readBook(root);
  const bookRoot = join(root, "books", book.book_id);
  const chapters = listChapterFiles(bookRoot);
  mkdirSync(join(root, "delivery"), { recursive: true });
  const body = chapters.map((path) => {
    const text = (readText(path) ?? "").trim();
    return /^#\s+/m.test(text) ? text : `# ${basename(path, ".md")}\n\n${text}`;
  }).join("\n\n---\n\n");
  const output = join(root, "delivery", "manuscript.md");
  const title = book.title || project.project_name;
  writeFileSync(output, `# ${title}\n\n${body}\n`, "utf8");
  return { output, chapters: chapters.length, words: countWords(body) };
}
