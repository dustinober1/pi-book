import { chapterLabel, read, resolveInput, words, printReport } from "./lib/audit-utils.mjs";
const input = process.argv[2] || process.cwd();
const minCountIndex = process.argv.indexOf("--min-count");
const minCount = minCountIndex >= 0 ? Number(process.argv[minCountIndex + 1]) || 2 : 2;
const { files } = resolveInput(input);
const counts = new Map();
for (const file of files) {
  const tokens = words(read(file));
  for (let size = 2; size <= 5; size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      const phrase = tokens.slice(i, i + size).join(" ");
      if (/^(the|a|an|and|of|to|in)(\s|$)/.test(phrase) && size === 2) continue;
      const item = counts.get(phrase) || { count: 0, files: new Set() };
      item.count += 1; item.files.add(chapterLabel(file)); counts.set(phrase, item);
    }
  }
}
const results = [...counts.entries()].filter(([, item]) => item.count >= minCount && item.files.size >= 1)
  .sort((a, b) => b[1].count - a[1].count || b[0].split(" ").length - a[0].split(" ").length).slice(0, 40)
  .map(([phrase, item]) => `“${phrase}” — ${item.count} uses across ${item.files.size} file(s)`);
printReport("Novel Forge n-gram audit", [["Repeated phrases for review", results]]);
