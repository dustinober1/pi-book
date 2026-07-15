import { createHash, randomUUID } from "node:crypto";
import { docxImportEngine } from "../../conversion/docx-import.js";
import { epubImportEngine } from "../../conversion/epub-import.js";
import { plainImportEngine } from "../../conversion/plain-import.js";
import { detectPandoc, runPandocImport } from "../../conversion/pandoc.js";
import type { ConversionDocument, ConversionEngine, ConversionSource } from "../../conversion/types.js";
import type { ResolvedAdoptionSource } from "./source.js";
import type { AdoptionAsset, AdoptionPreview, AdoptionSection, AdoptionSectionKind, AdoptionWarning } from "./types.js";

export interface AdoptionDiscoveryOptions { preferPandoc?: boolean; pandocBinary?: string }

function kind(title: string): AdoptionSectionKind {
  if (/front matter|title page|copyright|dedication|contents/i.test(title)) return "front-matter";
  if (/^appendix\b/i.test(title)) return "appendix";
  if (/afterword|acknowledg|about the author|back matter/i.test(title)) return "back-matter";
  if (/interlude/i.test(title)) return "interlude";
  return "chapter";
}

function number(title: string, fallback: number): number {
  const match = title.match(/(?:chapter|ch\.?)[\s_-]*(\d+)/i);
  return match ? Number.parseInt(match[1] ?? String(fallback), 10) : fallback;
}

function wordCount(markdown: string): number {
  return markdown.replace(/[`*_>#\[\]()~-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function sourceShape(source: ResolvedAdoptionSource): ConversionSource {
  return { ...source };
}

async function convert(source: ConversionSource, options: AdoptionDiscoveryOptions): Promise<{ document: ConversionDocument; engineName: AdoptionPreview["engine"]["name"]; engineVersion: string; warnings: AdoptionWarning[] }> {
  const warnings: AdoptionWarning[] = [];
  if (options.preferPandoc !== false && (source.extension === ".docx" || source.extension === ".epub")) {
    const availability = await detectPandoc(options.pandocBinary ?? "pandoc");
    if (availability.available) {
      try {
        const document = await runPandocImport(source, source.extension === ".docx" ? "docx" : "epub", availability.path);
        return { document, engineName: "pandoc", engineVersion: availability.version, warnings };
      } catch (error) {
        warnings.push({ code: "pandoc-fallback", message: error instanceof Error ? error.message : "Pandoc failed; Node fallback used.", severity: "warning" });
      }
    } else {
      warnings.push({ code: "pandoc-unavailable", message: "Pandoc was not available; the Node fallback was used and layout fidelity may be reduced.", severity: "warning" });
    }
  }
  const engines: ConversionEngine[] = [docxImportEngine, epubImportEngine, plainImportEngine];
  const engine = engines.find((candidate) => candidate.supports(source));
  if (!engine) throw new Error(`No adoption conversion engine supports ${source.extension}.`);
  const document = await engine.convert(source);
  return { document, engineName: engine.name, engineVersion: engine.version, warnings };
}

export async function discoverAdoptionPreview(source: ResolvedAdoptionSource, options: AdoptionDiscoveryOptions = {}): Promise<AdoptionPreview> {
  const converted = await convert(sourceShape(source), options);
  let chapterNumber = 0;
  const sections: AdoptionSection[] = converted.document.sections.map((section, index) => {
    const sectionKind = kind(section.title);
    if (sectionKind === "chapter" || sectionKind === "interlude") chapterNumber += 1;
    const assigned = sectionKind === "chapter" || sectionKind === "interlude" ? number(section.title, chapterNumber) : null;
    return {
      id: `section-${index + 1}`,
      sourceOrder: index,
      kind: sectionKind,
      number: assigned,
      title: section.title,
      markdown: section.markdown,
      wordCount: wordCount(section.markdown),
      sourceRefs: [section.sourceRef],
      included: true,
    };
  });
  const assets: AdoptionAsset[] = converted.document.assets.map((asset, index) => ({
    id: asset.id || `asset-${index + 1}`,
    originalName: asset.originalName,
    mediaType: asset.mediaType,
    bytes: asset.bytes,
    hash: createHash("sha256").update(asset.bytes).digest("hex"),
    width: null,
    height: null,
    caption: asset.caption,
    altText: asset.altText,
    placementAfterSectionId: null,
  }));
  const proposedWordCount = sections.filter((section) => section.included).reduce((sum, section) => sum + section.wordCount, 0);
  return {
    previewId: randomUUID(),
    source: { originalName: source.originalName, extension: source.extension, byteSize: source.byteSize, sourceHash: source.sourceHash },
    engine: { name: converted.engineName, version: converted.engineVersion },
    sections,
    assets,
    metadataCandidates: converted.document.metadata,
    warnings: [...converted.warnings, ...converted.document.warnings],
    sourceWordCount: converted.document.sourceWordCount,
    proposedWordCount,
  };
}
