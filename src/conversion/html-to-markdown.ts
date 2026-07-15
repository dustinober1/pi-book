import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { ConversionSection } from "./types.js";

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, "");
}

export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*", strongDelimiter: "**" });
  service.use(gfm);
  service.addRule("sceneBreak", {
    filter(node) { return node.nodeName === "P" && /^(?:\*\s*\*\s*\*|#\s*#\s*#|—\s*—\s*—)$/.test(node.textContent?.trim() ?? ""); },
    replacement() { return "\n\n---\n\n"; },
  });
  return service.turndown(sanitizeHtml(html)).replace(/\n{4,}/g, "\n\n\n").trim();
}

export function countTextWords(text: string): number {
  return text.replace(/[`*_>#\[\]()~-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

export function splitMarkdownSections(markdown: string, sourceRef: string): ConversionSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const headings: Array<{ index: number; level: number; title: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (match) headings.push({ index, level: match[1]?.length ?? 1, title: match[2]?.trim() ?? "Untitled" });
  }
  if (!headings.length) return [{ headingLevel: 1, title: "Chapter 1", markdown: markdown.trim(), sourceRef }];
  const sections: ConversionSection[] = [];
  if (headings[0]!.index > 0) {
    const preface = lines.slice(0, headings[0]!.index).join("\n").trim();
    if (preface) sections.push({ headingLevel: 1, title: "Front Matter", markdown: preface, sourceRef });
  }
  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index]!;
    const end = headings[index + 1]?.index ?? lines.length;
    sections.push({ headingLevel: current.level, title: current.title, markdown: lines.slice(current.index, end).join("\n").trim(), sourceRef });
  }
  return sections;
}
