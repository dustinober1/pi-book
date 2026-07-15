import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { countTextWords, splitMarkdownSections } from "./html-to-markdown.js";
import type { ConversionDocument, ConversionEngine, ConversionSection, ConversionSource } from "./types.js";

function titleFromFile(path: string, index: number): string {
  const title = basename(path, extname(path)).replace(/^0*\d+\s*[-_. ]*\s*/, "").trim();
  return title || `Chapter ${index + 1}`;
}

export const plainImportEngine: ConversionEngine = {
  name: "plain-text",
  version: "1",
  supports(source) { return source.isDirectory || source.extension === ".md" || source.extension === ".txt"; },
  async convert(source: ConversionSource): Promise<ConversionDocument> {
    let sections: ConversionSection[];
    let markdown: string;
    if (source.isDirectory) {
      const paths = readdirSync(source.absolutePath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(md|txt)$/i.test(entry.name))
        .map((entry) => join(source.absolutePath, entry.name))
        .sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
      sections = paths.map((path, index) => {
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Chapter source must be a regular file: ${basename(path)}`);
        const content = readFileSync(path, "utf8").trim();
        return { headingLevel: 1, title: titleFromFile(path, index), markdown: content, sourceRef: basename(path) };
      });
      markdown = sections.map((section) => section.markdown).join("\n\n---\n\n");
    } else {
      markdown = readFileSync(source.absolutePath, "utf8").replace(/\r\n/g, "\n").trim();
      sections = splitMarkdownSections(markdown, source.originalName);
    }
    return { markdown, sections, assets: [], metadata: {}, warnings: [], sourceWordCount: countTextWords(markdown) };
  },
};
