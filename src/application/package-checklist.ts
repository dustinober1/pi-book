import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ReaderExperimentsSchema, type ProfileId, type ReaderExperimentsState } from "../domain/schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { openBlockingTickets } from "../review/review.js";
import { readBook, readProject, readTickets } from "../project/store.js";

export interface PackagingChecklistItem {
  id: "manuscript" | "manuscript-approval" | "canon-lock" | "blocking-tickets" | "reader-claims" | "package-artifact";
  label: string;
  complete: boolean;
  blocking: boolean;
  detail: string;
}

export interface PackagingChecklist {
  ready: boolean;
  items: PackagingChecklistItem[];
  summary: string;
}

export interface NextBookProposal {
  bookId: string;
  previousBook: string;
  profile: ProfileId;
  targetWords: number;
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function manuscriptReadiness(root: string, bookId: string): { complete: boolean; detail: string } {
  const files = listChapterFiles(join(root, "books", bookId));
  if (!files.length) return { complete: false, detail: "No manuscript chapters exist." };
  const numbers = files.map(chapterNumber).filter((value): value is number => value !== null);
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return { complete: false, detail: "Duplicate chapter numbers prevent reliable compilation." };
  const maximum = Math.max(0, ...unique);
  for (let number = 1; number <= maximum; number += 1) if (!unique.has(number)) return { complete: false, detail: `Chapter ${number} is missing.` };
  return { complete: true, detail: `${files.length} contiguous chapter file${files.length === 1 ? "" : "s"} are available.` };
}

function readerClaimDetail(root: string, bookId: string): string {
  const path = join(root, "books", bookId, "reader-experiments.yaml");
  const text = readText(path);
  if (!text) return "No reader evidence exists; the package must make no reader-validation claim.";
  const state = parseYaml<ReaderExperimentsState>(text, ReaderExperimentsSchema, "reader-experiments.yaml");
  const validated = state.experiments.filter((experiment) => experiment.verdict === "validated");
  return validated.length
    ? `${validated.length} experiment${validated.length === 1 ? "" : "s"} may support narrowly worded, segmented reader-evidence claims.`
    : "No validated experiment exists; package copy must not claim outside-reader validation.";
}

export function buildPackagingChecklist(root: string): PackagingChecklist {
  const project = readProject(root);
  const book = readBook(root);
  const manuscript = manuscriptReadiness(root, book.book_id);
  const tickets = openBlockingTickets(readTickets(root));
  const packagePath = join(root, "books", book.book_id, "package.md");
  const packageText = readText(packagePath)?.trim() ?? "";
  const items: PackagingChecklistItem[] = [
    { id: "manuscript", label: "Compilable manuscript", complete: manuscript.complete, blocking: true, detail: manuscript.detail },
    { id: "manuscript-approval", label: "Writer manuscript approval", complete: project.gates["manuscript-approval"] === "approved", blocking: true, detail: project.gates["manuscript-approval"] === "approved" ? "The writer approved the manuscript evidence." : "Manuscript approval is not recorded." },
    { id: "canon-lock", label: "Book canon lock", complete: book.canon_locked || ["locked", "packaged"].includes(book.status), blocking: true, detail: book.canon_locked ? "Accepted book facts are locked into series canon." : "Canon lock has not completed." },
    { id: "blocking-tickets", label: "Blocking revision tickets", complete: tickets.length === 0, blocking: true, detail: tickets.length ? `${tickets.length} blocking ticket${tickets.length === 1 ? " remains" : "s remain"}.` : "No blocking revision tickets remain." },
    { id: "reader-claims", label: "Reader-evidence claim limit", complete: true, blocking: false, detail: readerClaimDetail(root, book.book_id) },
    { id: "package-artifact", label: "Editorial package", complete: packageText.length > 40, blocking: false, detail: packageText.length > 40 ? "The package artifact contains substantive material." : "The package artifact will be created or completed by the packaging workflow." },
  ];
  const ready = items.filter((item) => item.blocking).every((item) => item.complete);
  return { ready, items, summary: ready ? "Packaging prerequisites are satisfied." : "Resolve incomplete blocking checklist items before final package approval." };
}

export function nextBookProposal(root: string): NextBookProposal {
  const project = readProject(root);
  const book = readBook(root);
  if (!book.canon_locked && !["locked", "packaged"].includes(book.status)) throw new Error("Lock or package the current book before creating the next book.");
  const booksRoot = join(root, "books");
  const existing = existsSync(booksRoot)
    ? readdirSync(booksRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^book-\d{2}$/.test(entry.name)).map((entry) => entry.name)
    : [];
  const next = existing.map((id) => Number.parseInt(id.slice(5), 10)).reduce((maximum, value) => Math.max(maximum, value), 0) + 1;
  if (next > 99) throw new Error("Novel Forge supports up to 99 books in one workspace.");
  return { bookId: `book-${String(next).padStart(2, "0")}`, previousBook: book.book_id, profile: project.default_profile, targetWords: book.target_words };
}