import type { ProseLintResult } from "./types.js";

export function renderProseLintJson(result: ProseLintResult): string { return `${JSON.stringify(result, null, 2)}\n`; }

export function renderProseLintMarkdown(result: ProseLintResult, title = "Novel Forge prose lint"): string {
  const lines = [`# ${title}`, "", `- Words: ${result.wordCount}`, `- Findings: ${result.findings.length}`, `- Failures: ${result.failures.length}`, ""];
  for (const item of result.findings) lines.push(`- ${item.location.path}:${item.location.line ?? 1} — ${item.ruleId} — ${item.message}`, `  - Excerpt: ${item.excerpt}`, `  - Review: ${item.reviewAction}`);
  if (result.failures.length) lines.push("", "## Rule failures", ...result.failures.map((item) => `- ${item.ruleId}: ${item.message}`));
  return `${lines.join("\n")}\n`;
}

export function renderReviewLintEvidence(result: ProseLintResult, options: { maxFindings?: number; maxCharacters?: number } = {}): string {
  const maxFindings = options.maxFindings ?? 20;
  const maxCharacters = options.maxCharacters ?? 5000;
  const selected = result.findings.slice(0, maxFindings);
  const omitted = Math.max(0, result.findings.length - selected.length);
  let output = ["## Deterministic prose-lint evidence", "", "These are local review signals, not authorship detection and not automatic prose judgments.", "", ...selected.map((item) => `- ${item.location.path}:${item.location.line ?? 1} — ${item.ruleId} — ${item.message} (${item.reviewAction})`), "", `Omitted findings: ${omitted}.`].join("\n");
  if (result.failures.length) output += `\nLint unavailable for ${result.failures.length} rule(s): ${result.failures.map((item) => item.ruleId).join(", ")}. Continue normal review.`;
  return output.length <= maxCharacters ? output : `${output.slice(0, Math.max(0, maxCharacters - 40))}\n\nOmitted findings: ${omitted}.`;
}
