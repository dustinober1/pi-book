import { chapterLabel, read, resolveInput, printReport } from "./lib/audit-utils.mjs";
const { files } = resolveInput(process.argv[2] || process.cwd());
const patterns = [
  ["negative parallelism", /\bnot\s+[^.!?]{1,50}[.!?]\s+not\s+/gi],
  ["not X but Y", /\bnot\s+[^,.;!?]{1,60}\s+but\s+/gi],
  ["aphoristic close", /(?:that was|there it was|of course|the truth was|the problem was)[^.!?]{0,100}[.!?]/gi],
  ["three-part cadence", /\b\w+(?:,\s+\w+){2}(?:,?\s+and\s+\w+)?/gi],
];
const findings = [];
for (const file of files) {
  const text = read(file);
  for (const [label, pattern] of patterns) {
    const count = [...text.matchAll(pattern)].length;
    if (count) findings.push(`${chapterLabel(file)}: ${label} × ${count}`);
  }
}
printReport("Novel Forge rhetorical-pattern audit", [["Pattern counts", findings]]);
