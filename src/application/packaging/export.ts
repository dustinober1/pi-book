import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import { strToU8, zipSync } from "fflate";
import type { PackageManifest, PublishingMetadata, ReaderExperimentFile } from "../../domain/v1-2-schemas.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../../domain/historical-fiction.js";
import type { TransactionFileChange } from "../../infrastructure/transaction.js";
import { countWords, listChapterFiles, readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import { exportWithPandoc } from "../../conversion/pandoc-export.js";
import { readReaderExperiment, readReaderIndex } from "../readers/store.js";
import { readMarketingMetadata, readPublishingMetadata } from "./metadata.js";

export interface PackageBuildOptions { preferPandoc?: boolean; pandocBinary?: string }
export interface PackageBuildResult { changes: TransactionFileChange[]; sourceHash: string; engine: string; chapters: number; words: number }

interface Artifact { path: string; format: string; content: string | Uint8Array; required: boolean; warning?: string }

function sha(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
function xml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
function csv(value: string): string { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }

function compileManuscript(root: string, bookId: string, title: string): { markdown: string; chapters: Array<{ title: string; markdown: string }>; words: number } {
  const paths = listChapterFiles(join(root, "books", bookId));
  if (!paths.length) throw new Error("No manuscript chapters exist for the active book.");
  const chapters = paths.map((path) => {
    const content = (readText(path) ?? "").trim();
    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(path, ".md");
    return { title: heading, markdown: /^#\s+/m.test(content) ? content : `# ${heading}\n\n${content}` };
  });
  const body = chapters.map((chapter) => chapter.markdown).join("\n\n---\n\n");
  return { markdown: `# ${title}\n\n${body}\n`, chapters, words: countWords(body) };
}

function markdownParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length === 1 ? HeadingLevel.HEADING_1 : heading[1]?.length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      paragraphs.push(new Paragraph({ text: heading[2] ?? "", heading: level }));
    } else if (/^---+$/.test(line.trim())) paragraphs.push(new Paragraph({ text: "* * *" }));
    else {
      const runs: TextRun[] = [];
      const pieces = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
      for (const piece of pieces) {
        if (piece.startsWith("**") && piece.endsWith("**")) runs.push(new TextRun({ text: piece.slice(2, -2), bold: true }));
        else if (piece.startsWith("*") && piece.endsWith("*")) runs.push(new TextRun({ text: piece.slice(1, -1), italics: true }));
        else runs.push(new TextRun(piece));
      }
      paragraphs.push(new Paragraph({ children: runs.length ? runs : [new TextRun("")] }));
    }
  }
  return paragraphs;
}

async function nodeDocxBytes(markdown: string, metadata: PublishingMetadata): Promise<Uint8Array> {
  const document = new Document({
    creator: metadata.author.pen_name || metadata.author.name,
    title: metadata.title,
    description: metadata.descriptions.short,
    sections: [{ properties: {}, children: markdownParagraphs(markdown) }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

function stableModifiedDate(metadata: PublishingMetadata): string {
  const value = metadata.publication.date.trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00Z` : "2000-01-01T00:00:00Z";
}

function nodeEpubBytes(chapters: Array<{ title: string; markdown: string }>, metadata: PublishingMetadata): Uint8Array {
  const chapterFiles: Record<string, Uint8Array> = {};
  const manifest: string[] = [];
  const spine: string[] = [];
  const nav: string[] = [];
  chapters.forEach((chapter, index) => {
    const id = `chapter-${index + 1}`;
    const path = `OEBPS/${id}.xhtml`;
    const body = chapter.markdown.split(/\r?\n/).filter((line) => !/^#\s+/.test(line)).map((line) => `<p>${xml(line)}</p>`).join("\n");
    chapterFiles[path] = strToU8(`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(chapter.title)}</title></head><body><h1>${xml(chapter.title)}</h1>${body}</body></html>`);
    manifest.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    nav.push(`<li><a href="${id}.xhtml">${xml(chapter.title)}</a></li>`);
  });
  const identifier = metadata.identifiers.epub_isbn || `urn:uuid:${sha(metadata.title).slice(0, 32)}`;
  const opf = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${xml(identifier)}</dc:identifier><dc:title>${xml(metadata.title)}</dc:title><dc:creator>${xml(metadata.author.pen_name || metadata.author.name)}</dc:creator><dc:language>${xml(metadata.language || "en")}</dc:language><meta property="dcterms:modified">${stableModifiedDate(metadata)}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join("")}</manifest><spine>${spine.join("")}</spine></package>`;
  const navDoc = `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Contents</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>Contents</h1><ol>${nav.join("")}</ol></nav></body></html>`;
  return zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(navDoc),
    ...chapterFiles,
  }, { level: 6 });
}

function publishingRows(metadata: PublishingMetadata): Array<[string, string]> {
  return [
    ["title", metadata.title], ["subtitle", metadata.subtitle], ["series_name", metadata.series.name], ["series_number", String(metadata.series.number)],
    ["author", metadata.author.pen_name || metadata.author.name], ["language", metadata.language], ["copyright_holder", metadata.copyright.holder], ["copyright_year", metadata.copyright.year],
    ["paperback_isbn", metadata.identifiers.paperback_isbn], ["hardcover_isbn", metadata.identifiers.hardcover_isbn], ["epub_isbn", metadata.identifiers.epub_isbn], ["audiobook_isbn", metadata.identifiers.audiobook_isbn],
    ["short_description", metadata.descriptions.short], ["long_description", metadata.descriptions.long], ["keywords", metadata.keywords.join("; ")], ["categories", metadata.categories.join("; ")],
  ];
}

function publishingCsv(metadata: PublishingMetadata): string {
  return `field,value\n${publishingRows(metadata).map(([key, value]) => `${csv(key)},${csv(value)}`).join("\n")}\n`;
}

async function publishingWorkbook(metadata: PublishingMetadata): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Novel Forge";
  const sheet = workbook.addWorksheet("Publishing metadata");
  sheet.addRow(["field", "value"]);
  for (const row of publishingRows(metadata)) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 30 }, { width: 90 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function marketingFile(title: string, items: string[]): string { return `# ${title}\n\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "No draft content recorded."}\n`; }

function readerEvidenceCsv(experiments: ReaderExperimentFile[]): string {
  const rows = [["experiment_id", "status", "verdict", "target_reader", "immediate", "delayed", "continuation_rate", "purchase_intent_rate", "hook_recall_rate", "talkability_rate"]];
  for (const experiment of experiments) rows.push([experiment.id, experiment.status, experiment.verdict, experiment.target_reader, String(experiment.immediate_responses.length), String(experiment.delayed_responses.length), String(experiment.metrics.continuation_rate ?? ""), String(experiment.metrics.purchase_intent_rate ?? ""), String(experiment.metrics.delayed_hook_recall_rate ?? ""), String(experiment.metrics.talkability_rate ?? "")]);
  return `${rows.map((row) => row.map(csv).join(",")).join("\n")}\n`;
}

async function readerEvidenceWorkbook(experiments: ReaderExperimentFile[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Reader evidence");
  sheet.addRow(["experiment_id", "status", "verdict", "target_reader", "immediate", "delayed", "continuation_rate", "purchase_intent_rate", "hook_recall_rate", "talkability_rate"]);
  for (const experiment of experiments) sheet.addRow([experiment.id, experiment.status, experiment.verdict, experiment.target_reader, experiment.immediate_responses.length, experiment.delayed_responses.length, experiment.metrics.continuation_rate, experiment.metrics.purchase_intent_rate, experiment.metrics.delayed_hook_recall_rate, experiment.metrics.talkability_rate]);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => { column.width = 22; });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function sourceDigest(parts: Array<string | Uint8Array>): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

function historicalNote(context: HistoricalContext, ledger: InventionLedger): string | null {
  const disclosed = ledger.entries.filter((entry) => entry.disclosure !== "none");
  if (!disclosed.length) return null;
  const lines = [
    "# Historical Note",
    "",
    "This note identifies tracked narrative inventions and departures selected for disclosure. It does not claim evidence beyond the registered sources and research records.",
    "",
    "## Disclosed choices",
    "",
  ];
  for (const entry of disclosed) {
    const evidence = entry.source_ids.length || entry.research_ids.length
      ? `Registered evidence: ${[...entry.source_ids, ...entry.research_ids].join(", ")}.`
      : "Historical basis: declared narrative invention; no citation asserted.";
    lines.push(
      `- **${entry.id} — ${entry.classification} (${entry.disclosure})**: ${entry.claim}`,
      `  Rationale: ${entry.rationale}`,
      `  Story necessity: ${entry.story_necessity}`,
      `  ${evidence}`,
    );
  }
  if (context.uncertainties.length) {
    lines.push("", "## Declared uncertainty", "");
    for (const uncertainty of context.uncertainties) lines.push(`- ${uncertainty.id} (${uncertainty.kind}): ${uncertainty.statement}`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function buildPackageArtifacts(root: string, options: PackageBuildOptions = {}): Promise<PackageBuildResult> {
  const project = readProject(root);
  const book = readBook(root);
  const publishing = readPublishingMetadata(root, book.book_id);
  const marketing = readMarketingMetadata(root, book.book_id);
  const manuscript = compileManuscript(root, book.book_id, publishing.title || book.title || project.project_name);
  const readerIndex = readReaderIndex(root, book.book_id);
  const experiments = readerIndex.experiments.map((entry) => readReaderExperiment(root, book.book_id, entry.id));
  let renderedHistoricalNote: string | null = null;
  const historicalHashParts: string[] = [];
  if (book.profile === "historical-fiction") {
    const historicalPath = join(root, "books", book.book_id, "historical-context.yaml");
    const inventionPath = join(root, "books", book.book_id, "invention-ledger.yaml");
    const historicalText = readText(historicalPath);
    const inventionText = readText(inventionPath);
    if (!historicalText || !inventionText) throw new Error("Historical packaging requires historical-context.yaml and invention-ledger.yaml.");
    const context = parseYaml<HistoricalContext>(historicalText, HistoricalContextSchema, "historical-context.yaml");
    const ledger = parseYaml<InventionLedger>(inventionText, InventionLedgerSchema, "invention-ledger.yaml");
    historicalHashParts.push(historicalText, inventionText);
    renderedHistoricalNote = historicalNote(context, ledger);
  }
  const sourceHash = sourceDigest([
    manuscript.markdown,
    stringifyYaml(publishing),
    stringifyYaml(marketing),
    ...experiments.map((experiment) => stringifyYaml(experiment)),
    ...historicalHashParts,
  ]);

  let docx: Uint8Array;
  let epub: Uint8Array;
  let engine = "Node fallback";
  const conversionWarnings: string[] = [];
  if (options.preferPandoc !== false) {
    try {
      const pandoc = await exportWithPandoc(manuscript.markdown, publishing, options.pandocBinary ?? "pandoc");
      docx = pandoc.docx;
      epub = pandoc.epub;
      engine = pandoc.engine;
    } catch (error) {
      conversionWarnings.push(`${error instanceof Error ? error.message : "Pandoc export failed."} Node DOCX and EPUB fallbacks were used.`);
      docx = await nodeDocxBytes(manuscript.markdown, publishing);
      epub = nodeEpubBytes(manuscript.chapters, publishing);
    }
  } else {
    conversionWarnings.push("Pandoc was disabled; Node DOCX and EPUB fallbacks were used.");
    docx = await nodeDocxBytes(manuscript.markdown, publishing);
    epub = nodeEpubBytes(manuscript.chapters, publishing);
  }

  const base = `books/${book.book_id}/exports`;
  const conversionWarning = conversionWarnings.join(" ");
  const artifacts: Artifact[] = [
    { path: `${base}/manuscript.md`, format: "markdown", content: manuscript.markdown, required: true },
    { path: `${base}/manuscript.docx`, format: "docx", content: docx, required: true, warning: conversionWarning },
    { path: `${base}/manuscript.epub`, format: "epub", content: epub, required: true, warning: conversionWarning },
    { path: `${base}/publishing-metadata.csv`, format: "csv", content: publishingCsv(publishing), required: true },
    { path: `${base}/publishing-metadata.xlsx`, format: "xlsx", content: await publishingWorkbook(publishing), required: true },
    { path: `${base}/reader-evidence.csv`, format: "csv", content: readerEvidenceCsv(experiments), required: false },
    { path: `${base}/reader-evidence.xlsx`, format: "xlsx", content: await readerEvidenceWorkbook(experiments), required: false },
    { path: `${base}/retailer-copy.md`, format: "markdown", content: `# Retailer Copy\n\n## Short description\n\n${publishing.descriptions.short}\n\n## Long description\n\n${publishing.descriptions.long}\n\n## Keywords\n\n${publishing.keywords.map((item) => `- ${item}`).join("\n")}\n\n## Categories\n\n${publishing.categories.map((item) => `- ${item}`).join("\n")}\n`, required: true },
    { path: `${base}/launch-copy.md`, format: "markdown", content: marketingFile("Launch Copy", marketing.launch.items), required: false },
    { path: `${base}/social-posts.md`, format: "markdown", content: marketingFile("Social Posts", marketing.social.items), required: false },
    { path: `${base}/ad-variants.md`, format: "markdown", content: marketingFile("Advertising Variants", marketing.advertisements.items), required: false },
    { path: `${base}/audiobook-metadata.md`, format: "markdown", content: `# Audiobook Metadata\n\n- Narrator: ${publishing.audiobook.narrator}\n- Producer: ${publishing.audiobook.producer}\n- Duration placeholder: ${publishing.audiobook.duration_minutes} minutes\n- ISBN: ${publishing.identifiers.audiobook_isbn}\n- Distribution notes: ${publishing.audiobook.distribution_notes}\n\n${marketingFile("Audiobook Promotion", marketing.audiobook_promotion.items)}`, required: false },
    { path: `${base}/series-page-copy.md`, format: "markdown", content: marketingFile("Series Page Copy", marketing.series_page.items), required: false },
    ...(renderedHistoricalNote ? [{ path: `${base}/historical-note.md`, format: "markdown", content: renderedHistoricalNote, required: true }] : []),
  ];
  const generatedAt = new Date().toISOString();
  const manifest: PackageManifest = {
    schema_version: "1.0.0",
    generated_at: generatedAt,
    source_hash: sourceHash,
    engine,
    outputs: artifacts.map((artifact) => ({ path: artifact.path, format: artifact.format, hash: sha(artifact.content), required: artifact.required, status: "generated", warning: artifact.warning ?? "" })),
    warnings: [...new Set(artifacts.map((artifact) => artifact.warning ?? "").filter(Boolean))],
  };
  const report = [
    "# Novel Forge Packaging Report",
    "",
    `- Book: ${book.book_id}`,
    `- Generated: ${generatedAt}`,
    `- Source hash: ${sourceHash}`,
    `- Engine: ${engine}`,
    `- Chapters: ${manuscript.chapters.length}`,
    `- Words: ${manuscript.words}`,
    `- Outputs: ${artifacts.length}`,
    "",
    "## Fidelity and claim limits",
    "",
    ...(manifest.warnings.length ? manifest.warnings.map((warning) => `- ${warning}`) : ["- No conversion warning was recorded."]),
    "- Generated marketing files remain draft material unless their source groups are approved in marketing.yaml.",
    "- Reader-evidence claims remain limited to accepted human responses and the declared target segments.",
    "",
  ].join("\n");
  artifacts.push(
    { path: `${base}/package-manifest.yaml`, format: "yaml", content: stringifyYaml(manifest), required: true },
    { path: `${base}/package-report.md`, format: "markdown", content: report, required: true },
  );
  return { changes: artifacts.map((artifact) => typeof artifact.content === "string" ? { path: artifact.path, content: artifact.content } : { path: artifact.path, content: artifact.content, encoding: "binary" as const }), sourceHash, engine, chapters: manuscript.chapters.length, words: manuscript.words };
}
