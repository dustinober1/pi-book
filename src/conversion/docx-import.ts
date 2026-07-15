import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { inspectZipEntries } from "../application/adoption/archive-safety.js";
import { htmlToMarkdown, countTextWords, splitMarkdownSections } from "./html-to-markdown.js";
import type { ConversionAsset, ConversionDocument, ConversionEngine, ConversionSource } from "./types.js";

function coreMetadata(entries: Record<string, Uint8Array>): Record<string, string> {
  const core = entries["docProps/core.xml"];
  if (!core) return {};
  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const value = parser.parse(strFromU8(core))?.coreProperties ?? {};
    return {
      ...(typeof value.title === "string" ? { title: value.title } : {}),
      ...(typeof value.creator === "string" ? { author: value.creator } : {}),
      ...(typeof value.subject === "string" ? { subject: value.subject } : {}),
      ...(typeof value.description === "string" ? { description: value.description } : {}),
      ...(typeof value.language === "string" ? { language: value.language } : {}),
    };
  } catch { return {}; }
}

export const docxImportEngine: ConversionEngine = {
  name: "node-docx",
  version: "1",
  supports(source) { return source.extension === ".docx"; },
  async convert(source: ConversionSource): Promise<ConversionDocument> {
    const input = readFileSync(source.absolutePath);
    inspectZipEntries(input);
    const entries = unzipSync(input);
    const assets: ConversionAsset[] = [];
    let imageIndex = 0;
    const result = await mammoth.convertToHtml({ buffer: input }, {
      styleMap: [
        "p[style-name='Scene Break'] => p.scene-break:fresh",
        "p[style-name='Caption'] => p.caption:fresh",
        "p[style-name='Block Quote'] => blockquote:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        imageIndex += 1;
        const bytes = Buffer.from(await image.read("base64"), "base64");
        const id = `asset-${imageIndex}`;
        assets.push({ id, originalName: `image-${imageIndex}`, mediaType: image.contentType || "application/octet-stream", bytes, caption: "", altText: "", sourceRef: id });
        return { src: `novelforge://${id}` };
      }),
    });
    const markdown = htmlToMarkdown(result.value);
    return {
      markdown,
      sections: splitMarkdownSections(markdown, source.originalName),
      assets,
      metadata: coreMetadata(entries),
      warnings: result.messages.map((message) => ({ code: `mammoth-${message.type}`, message: message.message, severity: "warning" as const })),
      sourceWordCount: countTextWords(markdown),
    };
  },
};

export function conversionAssetHash(asset: ConversionAsset): string {
  return createHash("sha256").update(asset.bytes).digest("hex");
}
