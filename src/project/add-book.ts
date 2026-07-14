import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { SeriesArcSchema, type SeriesArcState } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { readBook, readProject, writeProjectEvent } from "./store.js";
import { bookTemplateFiles } from "./templates.js";
export interface AddBookOptions { force?: boolean }
export function addBook(root: string, targetWords = 100000, options: AddBookOptions = {}): string {
  const project = readProject(root); const currentBook = readBook(root);
  if (!options.force && !currentBook.canon_locked && !["locked", "packaged"].includes(currentBook.status)) throw new Error(`Lock the current book and complete its handoff before adding another book, or pass force explicitly.`);
  const booksRoot = join(root, "books"); const existing = existsSync(booksRoot) ? readdirSync(booksRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^book-\d{2}$/.test(entry.name)).map((entry) => entry.name).sort() : [];
  const nextNumber = existing.length + 1; if (nextNumber > 99) throw new Error("Novel Forge supports up to 99 books in one workspace."); const bookId = `book-${String(nextNumber).padStart(2, "0")}`; if (existsSync(join(booksRoot, bookId))) throw new Error(`${bookId} already exists.`);
  project.active_book = bookId; project.project_type = project.project_type === "standalone" ? "open-ended-series" : project.project_type; project.current_stage = "book-planning"; project.next_gate = "book-plan-approval";
  for (const gate of ["book-plan-approval", "first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-approval", "package-approval"]) project.gates[gate] = "open";
  const arcPath = join(root, "series", "series-arc.yaml"); const arcText = readText(arcPath) ?? 'schema_version: "1.0.0"\nbooks: []\nlong_arcs: []\n'; const arc = parseYaml<SeriesArcState>(arcText, SeriesArcSchema, "series-arc.yaml");
  const previous = arc.books.find((item) => item.id === currentBook.book_id); if (previous) previous.status = currentBook.canon_locked ? "locked" : "superseded-by-force";
  arc.books.push({ id: bookId, status: "active", role: "provisional installment", closes: [], carries: [] });
  const changes = [{ path: "PROJECT.yaml", content: stringifyYaml(project) }, { path: "series/series-arc.yaml", content: stringifyYaml(arc) }, ...Object.entries(bookTemplateFiles(bookId, nextNumber, project.default_profile, targetWords)).map(([path, content]) => ({ path, content }))];
  writeProjectEvent(root, changes, `Novel Forge: add ${bookId}`); mkdirSync(join(root, "books", bookId, "manuscript", "chapters"), { recursive: true }); return bookId;
}
