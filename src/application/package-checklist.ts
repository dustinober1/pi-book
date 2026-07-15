import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ReaderExperimentsSchema, type ProfileId, type ReaderExperimentsState } from "../domain/schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { openBlockingTickets } from "../review/review.js";
import { readBook, readProject, readTickets } from "../project/store.js";
import { readReaderExperiment, readReaderIndex } from "./readers/store.js";
import { marketingMetadataFindings, publishingMetadataFindings, readMarketingMetadata, readPublishingMetadata } from "./packaging/metadata.js";

export type PackagingChecklistId =
  | "manuscript" | "manuscript-approval" | "canon-lock" | "blocking-tickets" | "reader-claims"
  | "publishing-metadata" | "marketing-metadata" | "assets" | "audiobook" | "export-readiness" | "package-artifact";

export interface PackagingChecklistItem {
  id: PackagingChecklistId;
  label: string;
  complete: boolean;
  blocking: boolean;
  detail: string;
  evidencePaths: string[];
  repairAction: string;
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
  const index = readReaderIndex(root, bookId);
  if (index.experiments.length) {
    const experiments = index.experiments.map((entry) => readReaderExperiment(root, bookId, entry.id));
    const validated = experiments.filter((experiment) => experiment.verdict === "validated");
    return validated.length
      ? `${validated.length} isolated experiment${validated.length === 1 ? "" : "s"} may support narrowly worded, segmented reader-evidence claims.`
      : "No validated v1.2 experiment exists; package copy must not claim outside-reader validation.";
  }
  const path = join(root, "books", bookId, "reader-experiments.yaml");
  const text = readText(path);
  if (!text) return "No reader evidence exists; the package must make no reader-validation claim.";
  const state = parseYaml<ReaderExperimentsState>(text, ReaderExperimentsSchema, "reader-experiments.yaml");
  const validated = state.experiments.filter((experiment) => experiment.verdict === "validated");
  return validated.length
    ? `${validated.length} legacy experiment${validated.length === 1 ? "" : "s"} may support narrowly worded, segmented reader-evidence claims.`
    : "No validated experiment exists; package copy must not claim outside-reader validation.";
}

function item(id: PackagingChecklistId, label: string, complete: boolean, blocking: boolean, detail: string, evidencePaths: string[], repairAction: string): PackagingChecklistItem {
  return { id, label, complete, blocking, detail, evidencePaths, repairAction };
}

export function buildPackagingChecklist(root: string): PackagingChecklist {
  const project = readProject(root);
  const book = readBook(root);
  const base = `books/${book.book_id}`;
  const manuscript = manuscriptReadiness(root, book.book_id);
  const tickets = openBlockingTickets(readTickets(root));

  let publishingDetail = "Publishing metadata is complete.";
  let publishingComplete = true;
  let publishing;
  try {
    publishing = readPublishingMetadata(root, book.book_id);
    const findings = publishingMetadataFindings(publishing);
    const blockers = findings.filter((finding) => finding.blocking);
    publishingComplete = blockers.length === 0;
    publishingDetail = findings.length ? findings.map((finding) => finding.message).join(" ") : publishingDetail;
  } catch (error) {
    publishingComplete = false;
    publishingDetail = error instanceof Error ? error.message : "Publishing metadata is unavailable.";
  }

  let marketingDetail = "Marketing metadata has complete draft groups.";
  let marketingComplete = true;
  try {
    const marketing = readMarketingMetadata(root, book.book_id);
    const findings = marketingMetadataFindings(marketing);
    const blockers = findings.filter((finding) => finding.blocking);
    marketingComplete = blockers.length === 0;
    marketingDetail = findings.length ? findings.map((finding) => finding.message).join(" ") : marketingDetail;
  } catch (error) {
    marketingComplete = false;
    marketingDetail = error instanceof Error ? error.message : "Marketing metadata is unavailable.";
  }

  const assets = publishing?.assets ?? [];
  const missingAssets = assets.filter((asset) => !asset.path || !existsSync(join(root, asset.path)));
  const audiobookComplete = Boolean(publishing && (publishing.audiobook.narrator.trim() || publishing.audiobook.producer.trim() || publishing.identifiers.audiobook_isbn.trim()));
  const manifestPath = join(root, base, "exports", "package-manifest.yaml");
  const packagePath = join(root, base, "package.md");
  const packageText = readText(packagePath)?.trim() ?? "";
  const items: PackagingChecklistItem[] = [
    item("manuscript", "Compilable manuscript", manuscript.complete, true, manuscript.detail, [`${base}/manuscript/chapters/`], "Open the manuscript repair workflow."),
    item("manuscript-approval", "Writer manuscript approval", project.gates["manuscript-approval"] === "approved", true, project.gates["manuscript-approval"] === "approved" ? "The writer approved the manuscript evidence." : "Manuscript approval is not recorded.", ["PROJECT.yaml", `${base}/review-report.md`], "Return to manuscript review and record writer approval."),
    item("canon-lock", "Book canon lock", book.canon_locked || ["locked", "packaged"].includes(book.status), true, book.canon_locked ? "Accepted book facts are locked into series canon." : "Canon lock has not completed.", ["series/canon.yaml", "series/story-threads.yaml", `${base}/BOOK.yaml`], "Run the canon-lock workflow."),
    item("blocking-tickets", "Blocking revision tickets", tickets.length === 0, true, tickets.length ? `${tickets.length} blocking ticket${tickets.length === 1 ? " remains" : "s remain"}.` : "No blocking revision tickets remain.", [`${base}/revision-tickets.yaml`], "Resolve or explicitly accept every blocking revision ticket."),
    item("reader-claims", "Reader-evidence claim limit", true, false, readerClaimDetail(root, book.book_id), [`${base}/reader-kits/`, `${base}/reader-experiments.yaml`], "Review reader experiment limitations before writing validation claims."),
    item("publishing-metadata", "Publishing metadata", publishingComplete, true, publishingDetail, [`${base}/publishing.yaml`], "Complete the missing title, author, language, copyright, descriptions, keywords, and categories."),
    item("marketing-metadata", "Marketing draft package", marketingComplete, true, marketingDetail, [`${base}/marketing.yaml`], "Draft the missing positioning, audience, hook, retailer, launch, social, ad, audiobook, and series-page groups."),
    item("assets", "Publishing assets", missingAssets.length === 0, false, missingAssets.length ? `${missingAssets.length} referenced asset${missingAssets.length === 1 ? " is" : "s are"} missing.` : assets.length ? `${assets.length} referenced asset${assets.length === 1 ? " is" : "s are"} available.` : "No publishing assets are declared.", [`${base}/publishing.yaml`, `${base}/assets/`], "Repair missing asset paths and alt text."),
    item("audiobook", "Audiobook metadata", audiobookComplete, false, audiobookComplete ? "Audiobook metadata contains at least one production identifier." : "Narrator, producer, duration, ISBN, and distribution fields remain optional placeholders.", [`${base}/publishing.yaml`, `${base}/marketing.yaml`], "Complete audiobook production fields when an edition is planned."),
    item("export-readiness", "Export engine readiness", manuscript.complete && publishingComplete, true, manuscript.complete && publishingComplete ? "Required manuscript and metadata inputs are ready for DOCX, EPUB, Markdown, CSV, and XLSX generation." : "Export inputs remain incomplete.", [`${base}/manuscript/`, `${base}/publishing.yaml`], "Resolve manuscript and publishing metadata blockers."),
    item("package-artifact", "Editorial package", existsSync(manifestPath) || packageText.length > 40, false, existsSync(manifestPath) ? "A v1.2 package manifest exists." : packageText.length > 40 ? "The legacy package artifact contains substantive material." : "The packaging workflow will create the production package.", [`${base}/exports/package-manifest.yaml`, `${base}/package.md`], "Generate or regenerate the complete author package."),
  ];
  const ready = items.filter((check) => check.blocking).every((check) => check.complete);
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
