import { extname } from "node:path";
import { countWords, listChapterFiles, readText, safeSlug } from "../../infrastructure/files.js";
import { stringifyYaml, parseYaml } from "../../infrastructure/yaml.js";
import type { TransactionFileChange } from "../../infrastructure/transaction.js";
import { defaultPublishingMetadata, PublishingMetadataSchema, type PublishingMetadata } from "../../domain/v1-2-schemas.js";
import { readBook } from "../../project/store.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import type { AdoptionPreview, MappedAdoption } from "./types.js";
import { validateAdoptionMapping } from "./mapping.js";

export interface AdoptionApplyResult {
  chapters: number;
  words: number;
  paths: string[];
  reportPath: string;
  mapPath: string;
}

function assetFilename(originalName: string, hash: string): string {
  const extension = extname(originalName).toLowerCase();
  const stem = safeSlug(originalName.slice(0, extension ? -extension.length : undefined)) || "asset";
  return `${hash.slice(0, 12)}-${stem}${extension}`;
}

function replaceAssetReferences(markdown: string, destinations: Map<string, string>): string {
  let content = markdown;
  for (const [id, destination] of destinations) {
    const filename = destination.split("/").pop() ?? destination;
    content = content.replaceAll(`novelforge://${id}`, `../../assets/adopted/${filename}`);
  }
  return content;
}

function updatePublishing(root: string, book: ReturnType<typeof readBook>, mapped: MappedAdoption): PublishingMetadata {
  const path = `books/${book.book_id}/publishing.yaml`;
  const existing = readText(`${root}/${path}`);
  const publishing = existing
    ? parseYaml<PublishingMetadata>(existing, PublishingMetadataSchema, path)
    : defaultPublishingMetadata(book, Number.parseInt(book.book_id.slice(5), 10));
  if (mapped.metadata.title !== undefined) publishing.title = mapped.metadata.title;
  if (mapped.metadata.author !== undefined) publishing.author.name = mapped.metadata.author;
  if (mapped.metadata.language !== undefined) publishing.language = mapped.metadata.language;
  if (mapped.metadata.description !== undefined) publishing.descriptions.long = mapped.metadata.description;
  if (mapped.metadata.identifier !== undefined) publishing.identifiers.epub_isbn = mapped.metadata.identifier;
  publishing.verification_status = "unverified";
  return publishing;
}

export function applyAdoption(root: string, preview: AdoptionPreview, mapped: MappedAdoption): AdoptionApplyResult {
  const book = structuredClone(readBook(root));
  const bookRoot = `books/${book.book_id}`;
  if (listChapterFiles(`${root}/${bookRoot}`).length) throw new Error("The active book already contains manuscript chapters; adoption will not overwrite them.");
  const findings = validateAdoptionMapping(mapped, book.book_id);
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Adoption mapping is blocked:\n${blockers.map((finding) => `- ${finding.message}`).join("\n")}`);

  const assetDestinations = new Map<string, string>();
  const changes: TransactionFileChange[] = [];
  for (const asset of mapped.assets) {
    const destination = `${bookRoot}/assets/adopted/${assetFilename(asset.originalName, asset.hash)}`;
    assetDestinations.set(asset.id, destination);
    changes.push({ path: destination, content: asset.bytes, encoding: "binary" });
  }

  const accepted = mapped.sections.filter((section) => section.included);
  const usedNumbers = new Set(accepted.map((section) => section.number).filter((value): value is number => value !== null));
  let nextNumber = 1;
  const sectionRows: Array<{ id: string; source_order: number; kind: string; number: number | null; title: string; destination: string; source_refs: string[]; included: boolean }> = [];
  let chapterCount = 0;
  let words = 0;
  for (let index = 0; index < accepted.length; index += 1) {
    const section = accepted[index]!;
    let number = section.number;
    if ((section.kind === "chapter" || section.kind === "interlude") && number === null) {
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      number = nextNumber;
      usedNumbers.add(number);
    }
    let destination: string;
    if (section.kind === "chapter" || section.kind === "interlude") {
      chapterCount += 1;
      destination = `${bookRoot}/manuscript/chapters/${String(number).padStart(2, "0")}-${safeSlug(section.title) || `chapter-${number}`}.md`;
    } else if (section.kind === "front-matter") {
      destination = `${bookRoot}/manuscript/front-matter/${String(index + 1).padStart(2, "0")}-${safeSlug(section.title) || "front-matter"}.md`;
    } else {
      destination = `${bookRoot}/manuscript/back-matter/${String(index + 1).padStart(2, "0")}-${safeSlug(section.title) || "back-matter"}.md`;
    }
    const content = `${replaceAssetReferences(section.markdown, assetDestinations).trim()}\n`;
    words += countWords(content);
    changes.push({ path: destination, content });
    sectionRows.push({ id: section.id, source_order: section.sourceOrder, kind: section.kind, number, title: section.title, destination, source_refs: section.sourceRefs, included: true });
  }

  book.current_chapter = Math.max(0, ...sectionRows.map((row) => row.number ?? 0));
  book.actual_words = words;
  if (chapterCount > 0) book.status = "review";
  const mapPath = `${bookRoot}/adoption-map.yaml`;
  const reportPath = `${bookRoot}/adoption-report.md`;
  const adoptionMap = {
    schema_version: "1.0.0",
    source: { name: preview.source.originalName, type: preview.source.extension, hash: preview.source.sourceHash, bytes: preview.source.byteSize },
    engine: preview.engine,
    sections: sectionRows,
    assets: mapped.assets.map((asset) => ({ id: asset.id, hash: asset.hash, original_name: asset.originalName, destination: assetDestinations.get(asset.id) ?? "", media_type: asset.mediaType, caption: asset.caption, alt_text: asset.altText })),
    metadata_decisions: mapped.metadataDecisions,
    warnings: findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message),
  };
  const report = [
    "# Manuscript Adoption Report",
    "",
    `- Source: ${preview.source.originalName}`,
    `- Source hash: ${preview.source.sourceHash}`,
    `- Conversion engine: ${preview.engine.name} ${preview.engine.version}`,
    `- Imported manuscript sections: ${chapterCount}`,
    `- Imported words: ${words}`,
    `- Extracted assets: ${mapped.assets.length}`,
    "- Source files were read only and were not changed.",
    "- Discovered metadata remains unverified until the author confirms it.",
    "- No plot, canon, approval, review, or reader evidence was invented.",
    "",
    "## Section map",
    "",
    ...sectionRows.map((row) => `- ${row.destination} ← ${row.source_refs.join(", ")}`),
    "",
    "## Warnings",
    "",
    ...(adoptionMap.warnings.length ? adoptionMap.warnings.map((warning) => `- ${warning}`) : ["- None recorded."]),
    "",
  ].join("\n");
  const publishing = updatePublishing(root, book, mapped);
  changes.push(
    { path: mapPath, content: stringifyYaml(adoptionMap) },
    { path: reportPath, content: report },
    { path: `${bookRoot}/publishing.yaml`, content: stringifyYaml(publishing) },
    { path: `${bookRoot}/BOOK.yaml`, content: stringifyYaml(book) },
  );
  const result = applyGuidedProjectEvent(root, changes, "Novel Forge: adopt existing project", { lastAction: `Adopted ${chapterCount} manuscript sections` });
  return { chapters: chapterCount, words, paths: result.changed, reportPath, mapPath };
}
