import type { ManuscriptDocument } from "./types.js";

function tokens(text: string): string[] {
  return (text.normalize("NFKC").match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).map((value) => value.toLocaleLowerCase("en-US"));
}

export function normalizeDocument(path: string, text: string, order: number): ManuscriptDocument {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let fenced = false;
  const scanLines = lines.map((line) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return ""; }
    return fenced || /^\s*~~~/.test(line) ? "" : line;
  });
  const scanText = scanLines.join("\n");
  const sentenceList: Array<{ text: string; line: number }> = [];
  for (const [index, line] of scanLines.entries()) {
    for (const sentence of line.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? []) if (sentence.trim()) sentenceList.push({ text: sentence.trim(), line: index + 1 });
  }
  const paragraphs: Array<{ text: string; line: number; tokens: readonly string[] }> = [];
  let paragraph = "";
  let paragraphLine = 1;
  for (const [index, line] of scanLines.entries()) {
    if (!line.trim()) {
      if (paragraph.trim()) paragraphs.push({ text: paragraph.trim(), line: paragraphLine, tokens: tokens(paragraph) });
      paragraph = "";
      paragraphLine = index + 2;
    } else {
      if (!paragraph) paragraphLine = index + 1;
      paragraph += `${paragraph ? " " : ""}${line.trim()}`;
    }
  }
  if (paragraph.trim()) paragraphs.push({ text: paragraph.trim(), line: paragraphLine, tokens: tokens(paragraph) });
  return { path, order, text, scanText, lines, tokens: tokens(scanText), sentences: sentenceList, paragraphs, wordCount: tokens(scanText).length };
}
