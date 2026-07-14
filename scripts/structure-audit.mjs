import { chapterLabel, read, resolveInput, wordCount, printReport } from "./lib/audit-utils.mjs";
const { files } = resolveInput(process.argv[2] || process.cwd());
const chapters = files.map((file) => ({ file, words: wordCount(read(file)) }));
const total = chapters.reduce((sum, item) => sum + item.words, 0);
const findings = [];
for (const item of chapters) {
  const share = total ? item.words / total : 0;
  if (/\b(?:part|chapter)[-_ ]?\d+[abc]\b/i.test(chapterLabel(item.file))) findings.push(`${chapterLabel(item.file)} looks like unresolved A/B/C assembly scaffolding.`);
  if (share > 0.2 && chapters.length > 4) findings.push(`${chapterLabel(item.file)} holds ${(share * 100).toFixed(1)}% of manuscript words.`);
  if (item.words < 500) findings.push(`${chapterLabel(item.file)} is very short at ${item.words} words; confirm this is intentional.`);
}
printReport("Novel Forge structure audit", [["Manuscript summary", [`${chapters.length} chapter file(s), ${total} words`]], ["Structural review flags", findings]]);
