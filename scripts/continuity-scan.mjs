import { existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { chapterLabel, read, resolveInput, printReport } from "./lib/audit-utils.mjs";
const { projectRoot, files } = resolveInput(process.argv[2] || process.cwd());
const findings = [];
if (!projectRoot || !existsSync(join(projectRoot, "series", "canon.yaml"))) {
  findings.push("No Novel Forge canon.yaml found; continuity comparison was not available.");
} else {
  const canon = YAML.parse(read(join(projectRoot, "series", "canon.yaml")));
  const locked = (canon.facts || []).filter((fact) => fact.status === "locked");
  for (const fact of locked) {
    const expectedNumbers = String(fact.fact).match(/\b\d+(?:\.\d+)?\b/g) || [];
    if (!expectedNumbers.length) continue;
    for (const file of files) {
      const text = read(file);
      if (!text.toLowerCase().includes(String(fact.subject).toLowerCase())) continue;
      const nearby = text.split(/\r?\n/).filter((line) => line.toLowerCase().includes(String(fact.subject).toLowerCase()));
      for (const line of nearby) {
        const seen = line.match(/\b\d+(?:\.\d+)?\b/g) || [];
        const divergent = seen.filter((number) => !expectedNumbers.includes(number));
        if (divergent.length) findings.push(`${chapterLabel(file)} / ${fact.id}: possible numeric divergence near “${line.trim().slice(0,140)}”`);
      }
    }
  }
}
printReport("Novel Forge continuity scan", [["Potential conflicts", findings]]);
