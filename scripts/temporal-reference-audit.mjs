import { chapterLabel, read, resolveInput, printReport } from "./lib/audit-utils.mjs";
const { files } = resolveInput(process.argv[2] || process.cwd());
const pattern = /\b(tomorrow|yesterday|tonight|next (?:morning|week|month|year)|last (?:night|week|month|year)|soon|in \d+ (?:minutes|hours|days|weeks)|when the time came)\b/gi;
const findings = [];
for (const file of files) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(pattern)];
    for (const match of matches) findings.push(`${chapterLabel(file)}:${index + 1} — ${match[0]} — ${line.trim().slice(0,140)}`);
  });
}
printReport("Novel Forge temporal-reference audit", [["References requiring chronology review", findings]]);
