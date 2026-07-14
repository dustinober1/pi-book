import { chapterLabel, read, resolveInput, printReport } from "./lib/audit-utils.mjs";
const pairs = [["color", "colour"], ["favor", "favour"], ["center", "centre"], ["theater", "theatre"], ["defense", "defence"], ["license", "licence"], ["practice", "practise"], ["gray", "grey"], ["analyze", "analyse"], ["traveler", "traveller"]];
const { files } = resolveInput(process.argv[2] || process.cwd());
const corpus = files.map((file) => [file, read(file).toLowerCase()]);
const findings = [];
for (const [us, uk] of pairs) {
  const usFiles = corpus.filter(([, text]) => new RegExp(`\\b${us}\\b`, "i").test(text)).map(([file]) => chapterLabel(file));
  const ukFiles = corpus.filter(([, text]) => new RegExp(`\\b${uk}\\b`, "i").test(text)).map(([file]) => chapterLabel(file));
  if (usFiles.length && ukFiles.length) findings.push(`${us}/${uk} mixed — US in ${usFiles.join(", ")}; UK in ${ukFiles.join(", ")}`);
}
printReport("Novel Forge spelling-consistency audit", [["Mixed-system findings", findings]]);
