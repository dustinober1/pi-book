import type { LintClass, LintFinding, ProseLintResult, ReportOptions } from "./types.js";

const classes: readonly LintClass[] = ["mechanical", "consistency", "repetition", "style-pattern"];
const classTitles: Record<LintClass, string> = {
  mechanical: "Mechanical",
  consistency: "Consistency",
  repetition: "Repetition",
  "style-pattern": "Style pattern",
};

function matches(ruleId: string, prefixes?: readonly string[]): boolean {
  return prefixes === undefined || prefixes.length === 0 || prefixes.some((prefix) => ruleId.startsWith(prefix));
}

function inline(text: string, maximum = 160): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maximum).replace(/`/g, "'");
}

function location(finding: LintFinding): string {
  return `${finding.location.path}${finding.location.line === undefined ? "" : `:${finding.location.line}`}`;
}

export function renderProseLintMarkdown(result: ProseLintResult, options: ReportOptions = {}): string {
  const findings = result.findings.filter((finding) => matches(finding.ruleId, options.rulePrefixes));
  const failures = result.failures.filter((failure) => matches(failure.ruleId, options.rulePrefixes));
  const lines = [
    `# ${options.title ?? "Novel Forge deterministic prose lint"}`,
    "",
    `- Words scanned: ${result.wordCount}`,
    `- Findings: ${findings.length}`,
    `- Rule failures: ${failures.length}`,
    "",
  ];
  for (const lintClass of classes) {
    lines.push(`## ${classTitles[lintClass]}`, "");
    const grouped = findings.filter((finding) => finding.class === lintClass);
    if (grouped.length === 0) {
      lines.push("- none", "");
      continue;
    }
    for (const finding of grouped) {
      lines.push(
        `### ${location(finding)} — ${finding.ruleId}`,
        "",
        `- Confidence: ${finding.confidence}`,
        `- Message: ${inline(finding.message, 240)}`,
        `- Excerpt: \`${inline(finding.excerpt)}\``,
        `- Evidence: \`${inline(JSON.stringify(finding.evidence), 500)}\``,
        `- Review action: ${inline(finding.reviewAction, 300)}`,
        "",
      );
    }
  }
  lines.push("## Rule failures", "");
  if (failures.length === 0) lines.push("- none", "");
  else for (const failure of failures) lines.push(`- ${failure.ruleId}: ${inline(failure.message, 300)}`);
  lines.push("");
  return lines.join("\n");
}

export function renderProseLintJson(result: ProseLintResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

function isCrossDocument(finding: LintFinding): boolean {
  if (finding.class !== "repetition") return false;
  if (Number(finding.evidence.documentCount ?? finding.evidence.chapterCount ?? 0) >= 2) return true;
  const first = typeof finding.evidence.firstLocation === "string" ? finding.evidence.firstLocation.split(":")[0] : undefined;
  const second = typeof finding.evidence.secondLocation === "string" ? finding.evidence.secondLocation.split(":")[0] : undefined;
  return first !== undefined && second !== undefined && first !== second;
}

function priority(finding: LintFinding): number {
  if (finding.class === "mechanical" && finding.confidence === "high") return 0;
  if (isCrossDocument(finding)) return 1;
  if (finding.class === "consistency") return 2;
  if (finding.class === "style-pattern" && typeof finding.evidence.baselineMetric === "string") return 3;
  return 4;
}

function reviewText(result: ProseLintResult, selected: readonly LintFinding[], excerptLimit: number, failureMessageLimit = 100): string {
  const omitted = result.findings.length - selected.length;
  const lines = [
    "## Deterministic prose-lint evidence",
    "",
    "Deterministic findings are review evidence, not authorship detection or automatic revision instructions. Verify each item in manuscript context.",
    "",
  ];
  if (selected.length === 0) lines.push("- No findings selected within this evidence budget.");
  for (const finding of selected) {
    const excerptText = excerptLimit === 0 || finding.excerpt.trim() === "" ? "" : ` Excerpt: “${inline(finding.excerpt, excerptLimit)}”`;
    lines.push(`- ${location(finding)} — ${finding.ruleId} (${finding.confidence}): ${inline(finding.message, 140)}${excerptText}`);
  }
  lines.push("", `- ${omitted} ${omitted === 1 ? "finding" : "findings"} omitted from this bounded summary.`);
  if (result.failures.length > 0) {
    lines.push(`- Rule failures: ${result.failures.map((failure) => failureMessageLimit === 0
      ? failure.ruleId
      : `${failure.ruleId} — ${inline(failure.message, failureMessageLimit)}`).join("; ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderReviewLintEvidence(
  result: ProseLintResult,
  options: { maxFindings?: number; maxCharacters?: number } = {},
): string {
  const maxFindings = Math.max(0, Math.floor(options.maxFindings ?? 12));
  const maxCharacters = Math.max(0, Math.floor(options.maxCharacters ?? 6_000));
  if (maxCharacters === 0) return "";
  const ordered = result.findings.map((finding, index) => ({ finding, index }))
    .sort((left, right) => priority(left.finding) - priority(right.finding) || left.index - right.index)
    .map((item) => item.finding);
  const selected = ordered.slice(0, maxFindings);
  for (const excerptLimit of [160, 80, 40, 0]) {
    const rendered = reviewText(result, selected, excerptLimit);
    if (rendered.length <= maxCharacters) return rendered;
  }
  for (const failureMessageLimit of [40, 0]) {
    const rendered = reviewText(result, selected, 0, failureMessageLimit);
    if (rendered.length <= maxCharacters) return rendered;
  }
  while (selected.length > 0) {
    selected.pop();
    const rendered = reviewText(result, selected, 0, 0);
    if (rendered.length <= maxCharacters) return rendered;
  }
  const minimal = `## Deterministic prose-lint evidence\n\n- ${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"} omitted from this bounded summary.\n`;
  return minimal.slice(0, maxCharacters);
}
