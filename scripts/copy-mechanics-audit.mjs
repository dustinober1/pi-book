import { chapterLabel, read, resolveInput, printReport } from "./lib/audit-utils.mjs";
const { files } = resolveInput(process.argv[2] || process.cwd());
const findings = [];
for (const file of files) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\b(\w+)\s+\1\b/i.test(line)) findings.push(`${chapterLabel(file)}:${index + 1} — doubled word — ${line.trim().slice(0,140)}`);
    if (/\s+[,.!?;:]/.test(line)) findings.push(`${chapterLabel(file)}:${index + 1} — space before punctuation — ${line.trim().slice(0,140)}`);
    if (/^[a-z][^:]{5,}/.test(line.trim()) && !/^https?:/.test(line.trim())) findings.push(`${chapterLabel(file)}:${index + 1} — lowercase sentence/paragraph start — ${line.trim().slice(0,140)}`);
  });
}
printReport("Novel Forge copy-mechanics audit", [["Mechanical findings", findings]]);
