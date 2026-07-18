import type { ManuscriptDocument } from "./types.js";

const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const fencePattern = /^\s*(`{3,}|~{3,})/;
const headingPattern = /^\s{0,3}#{1,6}(?:\s|$)/;
const sceneBreaks = new Set(["***", "---", "___"]);

function tokensFor(text: string): string[] {
  return (text.match(wordPattern) ?? []).map((token) => token.toLowerCase());
}

function isExcludedMarkdownLine(line: string): boolean {
  const trimmed = line.trim();
  return headingPattern.test(line) || sceneBreaks.has(trimmed);
}

function sentencesForLine(line: string, lineNumber: number): Array<{ text: string; line: number }> {
  const matches = line.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [];
  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((text) => ({ text, line: lineNumber }));
}

export function normalizeDocument(path: string, text: string, order: number): ManuscriptDocument {
  const lines = text.split(/\r?\n/);
  const scanLines: string[] = [];
  let fenceDelimiter: { character: "`" | "~"; length: number } | undefined;

  for (const line of lines) {
    const fence = line.match(fencePattern);
    if (fenceDelimiter !== undefined) {
      scanLines.push("");
      const delimiter = fence?.[1];
      if (delimiter !== undefined
        && delimiter[0] === fenceDelimiter.character
        && delimiter.length >= fenceDelimiter.length) {
        fenceDelimiter = undefined;
      }
      continue;
    }

    const delimiter = fence?.[1];
    if (delimiter !== undefined) {
      fenceDelimiter = { character: delimiter[0] as "`" | "~", length: delimiter.length };
      scanLines.push("");
      continue;
    }

    scanLines.push(line);
  }

  const includedLines = scanLines.map((line) => isExcludedMarkdownLine(line) ? "" : line);
  const tokens = tokensFor(includedLines.join("\n"));
  const sentences = includedLines.flatMap((line, index) => line.trim() === "" ? [] : sentencesForLine(line, index + 1));
  const paragraphs: Array<{ text: string; line: number; tokens: readonly string[] }> = [];
  let paragraphLines: string[] = [];
  let paragraphStart = 0;

  const finishParagraph = () => {
    if (paragraphLines.length === 0) return;
    const paragraphText = paragraphLines.join(" ").trim();
    paragraphs.push({ text: paragraphText, line: paragraphStart, tokens: tokensFor(paragraphText) });
    paragraphLines = [];
    paragraphStart = 0;
  };

  for (const [index, line] of includedLines.entries()) {
    if (line.trim() === "") {
      finishParagraph();
      continue;
    }
    if (paragraphLines.length === 0) paragraphStart = index + 1;
    paragraphLines.push(line.trim());
  }
  finishParagraph();

  return {
    path,
    order,
    text,
    scanText: scanLines.join("\n"),
    lines,
    tokens,
    sentences,
    paragraphs,
    wordCount: tokens.length,
  };
}
