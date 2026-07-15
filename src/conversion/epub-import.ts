import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { inspectZipEntries } from "../application/adoption/archive-safety.js";
import { htmlToMarkdown, countTextWords, splitMarkdownSections } from "./html-to-markdown.js";
import type { ConversionAsset, ConversionDocument, ConversionEngine, ConversionSource } from "./types.js";

function array<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"] ?? "");
  return "";
}

function resolveArchivePath(base: string, reference: string): string {
  const path = posix.normalize(posix.join(posix.dirname(base), reference.split("#")[0] ?? ""));
  if (path.startsWith("../") || path.startsWith("/")) throw new Error(`Unsafe EPUB reference: ${reference}`);
  return path;
}

export const epubImportEngine: ConversionEngine = {
  name: "node-epub",
  version: "1",
  supports(source) { return source.extension === ".epub"; },
  async convert(source: ConversionSource): Promise<ConversionDocument> {
    const input = readFileSync(source.absolutePath);
    inspectZipEntries(input);
    const entries = unzipSync(input);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, textNodeName: "#text" });
    const container = entries["META-INF/container.xml"];
    if (!container) throw new Error("EPUB is missing META-INF/container.xml.");
    const rootfiles = array(parser.parse(strFromU8(container))?.container?.rootfiles?.rootfile);
    const opfPath = rootfiles[0]?.["full-path"];
    if (typeof opfPath !== "string" || !entries[opfPath]) throw new Error("EPUB package document could not be resolved.");
    const pkg = parser.parse(strFromU8(entries[opfPath]!))?.package;
    if (!pkg) throw new Error("EPUB package document is invalid.");
    const manifestItems = array<Record<string, unknown>>(pkg.manifest?.item);
    const manifest = new Map(manifestItems.map((item) => [String(item.id ?? ""), item]));
    const spine = array<Record<string, unknown>>(pkg.spine?.itemref).map((item) => String(item.idref ?? "")).filter(Boolean);
    if (!spine.length) throw new Error("EPUB spine contains no readable documents.");

    const assets: ConversionAsset[] = [];
    const assetByPath = new Map<string, string>();
    const markdownParts: string[] = [];
    for (const id of spine) {
      const item = manifest.get(id);
      const href = item?.href;
      if (typeof href !== "string") throw new Error(`EPUB spine item ${id} is missing from the manifest.`);
      const chapterPath = resolveArchivePath(opfPath, href);
      const chapter = entries[chapterPath];
      if (!chapter) throw new Error(`EPUB spine document is missing: ${chapterPath}`);
      let html = strFromU8(chapter);
      html = html.replace(/(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi, (_match, before: string, reference: string, after: string) => {
        const assetPath = resolveArchivePath(chapterPath, reference);
        const assetBytes = entries[assetPath];
        if (!assetBytes) return `${before}${reference}${after}`;
        let assetId = assetByPath.get(assetPath);
        if (!assetId) {
          assetId = `asset-${assets.length + 1}`;
          assetByPath.set(assetPath, assetId);
          const media = manifestItems.find((candidate) => {
            try { return typeof candidate.href === "string" && resolveArchivePath(opfPath, candidate.href) === assetPath; } catch { return false; }
          });
          assets.push({ id: assetId, originalName: posix.basename(assetPath), mediaType: String(media?.["media-type"] ?? "application/octet-stream"), bytes: assetBytes, caption: "", altText: "", sourceRef: assetPath });
        }
        return `${before}novelforge://${assetId}${after}`;
      });
      markdownParts.push(htmlToMarkdown(html));
    }
    const markdown = markdownParts.filter(Boolean).join("\n\n---\n\n");
    const metadata = pkg.metadata ?? {};
    return {
      markdown,
      sections: splitMarkdownSections(markdown, source.originalName),
      assets,
      metadata: {
        ...(text(metadata.title) ? { title: text(metadata.title) } : {}),
        ...(text(metadata.creator) ? { author: text(metadata.creator) } : {}),
        ...(text(metadata.language) ? { language: text(metadata.language) } : {}),
        ...(text(metadata.description) ? { description: text(metadata.description) } : {}),
        ...(text(metadata.identifier) ? { identifier: text(metadata.identifier) } : {}),
      },
      warnings: [],
      sourceWordCount: countTextWords(markdown),
    };
  },
};
