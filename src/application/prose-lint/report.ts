import type { LintClass, LintFinding, ProseLintResult, ReportOptions } from "./types.js";
import { compareDeterministicText } from "./order.js";

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

function chapterLabel(path: string): string {
  return path.replace(/\\/g, "/").split("/").at(-1) ?? path;
}

function legacyLine(finding: LintFinding, text: string): string {
  return `${text} <!-- ${finding.ruleId} -->`;
}

function locationFiles(value: unknown): string {
  if (typeof value !== "string") return "";
  return [...new Set(value.split(", ").map((item) => chapterLabel(item.replace(/:\d+$/u, ""))))].join(", ");
}

function legacySections(result: ProseLintResult, options: ReportOptions): Array<[string, string[]]> {
  const findings = result.findings.filter((finding) => matches(finding.ruleId, options.rulePrefixes));
  const failures = result.failures.filter((failure) => matches(failure.ruleId, options.rulePrefixes));
  const withFailures = (lines: string[]) => [
    ...lines,
    ...failures.map((failure) => `Rule failure ${failure.ruleId}: ${inline(failure.message, 300)}`),
  ];
  switch (options.legacyReport) {
    case "ngram": {
      const lines = [...findings].sort((left, right) => {
        const countDifference = Number(right.evidence.count) - Number(left.evidence.count);
        if (countDifference !== 0) return countDifference;
        const leftWords = String(left.evidence.phrase ?? "").split(" ").length;
        const rightWords = String(right.evidence.phrase ?? "").split(" ").length;
        if (leftWords !== rightWords) return rightWords - leftWords;
        const leftPhrase = String(left.evidence.phrase ?? "");
        const rightPhrase = String(right.evidence.phrase ?? "");
        return compareDeterministicText(leftPhrase, rightPhrase);
      }).slice(0, 40).map((finding) => legacyLine(
        finding,
        `“${String(finding.evidence.phrase ?? "")}” — ${Number(finding.evidence.count)} uses across ${Number(finding.evidence.documentCount ?? finding.evidence.chapterCount ?? 0)} file(s)`,
      ));
      return [["Repeated phrases for review", withFailures(lines)]];
    }
    case "rhetoric": {
      const labels: Record<string, string> = {
        "style-pattern/negative-parallelism": "negative parallelism",
        "style-pattern/not-x-but-y": "not X but Y",
        "style-pattern/aphoristic-close": "aphoristic close",
        "style-pattern/three-part-cadence": "three-part cadence",
        "style-pattern/rhetorical-question": "rhetorical question",
        "style-pattern/fragment": "fragment",
        "style-pattern/em-dash": "em dash",
        "style-pattern/filter-word": "filter word",
        "style-pattern/body-language-repetition": "body-language repetition",
        "style-pattern/repeated-transition": "repeated transition",
        "style-pattern/paragraph-shape": "paragraph shape",
        "style-pattern/repeated-ending-syntax": "repeated ending syntax",
      };
      return [["Pattern counts", withFailures(findings.map((finding) => legacyLine(
        finding,
        `${chapterLabel(String(finding.evidence.localPath ?? finding.location.path))}: ${labels[finding.ruleId] ?? finding.ruleId} × ${Number(finding.evidence.localCount ?? finding.evidence.count ?? 1)}`,
      )))]];
    }
    case "continuity":
      return [["Potential conflicts", withFailures(findings.map((finding) => legacyLine(
        finding,
        `${chapterLabel(finding.location.path)} / ${String(finding.evidence.canonId ?? "canon")}: possible numeric divergence near “${inline(finding.excerpt, 140)}”`,
      )))]];
    case "integrity":
      return [["Integrity findings", withFailures(findings.map((finding) => legacyLine(finding, finding.message)))]];
    case "structure":
      return [
        ["Manuscript summary", [`${options.documentCount ?? 0} chapter file(s), ${result.wordCount} words`]],
        ["Structural review flags", withFailures(findings.map((finding) => legacyLine(finding, `${chapterLabel(finding.location.path)} ${finding.message.charAt(0).toLocaleLowerCase("en-US")}${finding.message.slice(1)}`)))],
      ];
    case "spelling":
      return [["Mixed-system findings", withFailures(findings.map((finding) => {
        const [first = "first", second = "second"] = String(finding.evidence.pair ?? "").split("/");
        return legacyLine(finding, `${first}/${second} mixed — US in ${locationFiles(finding.evidence.firstLocations)}; UK in ${locationFiles(finding.evidence.secondLocations)}`);
      }))]];
    case "temporal":
      return [["References requiring chronology review", withFailures(findings.map((finding) => legacyLine(
        finding,
        `${chapterLabel(finding.location.path)}:${finding.location.line ?? 1} — ${String(finding.evidence.marker ?? "marker")} — ${inline(finding.excerpt, 140)}`,
      )))]];
    case "mechanics": {
      const labels: Record<string, string> = {
        "mechanics/doubled-word": "doubled word",
        "mechanics/punctuation-spacing": "space before punctuation",
        "mechanics/repeated-punctuation": "repeated punctuation",
        "mechanics/drafting-marker": "drafting marker",
        "mechanics/unbalanced-punctuation": "unbalanced punctuation",
      };
      return [["Mechanical findings", withFailures(findings.map((finding) => legacyLine(
        finding,
        `${chapterLabel(finding.location.path)}:${finding.location.line ?? 1} — ${labels[finding.ruleId] ?? finding.ruleId} — ${inline(finding.excerpt, 140)}`,
      )))]];
    }
  }
  return [];
}

function renderLegacyProseLintMarkdown(result: ProseLintResult, options: ReportOptions): string {
  const lines = [`# ${options.title ?? "Novel Forge deterministic prose lint"}`, ""];
  for (const [heading, items] of legacySections(result, options)) {
    lines.push(`## ${heading}`, "", ...(items.length === 0 ? ["- none"] : items.map((item) => `- ${item}`)), "");
  }
  return lines.join("\n");
}

export function renderProseLintMarkdown(result: ProseLintResult, options: ReportOptions = {}): string {
  if (options.legacyReport !== undefined) return renderLegacyProseLintMarkdown(result, options);
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
    const countText = finding.ruleId === "repetition/near-duplicate"
      && typeof finding.evidence.fullFindingCount === "number"
      && typeof finding.evidence.omittedFindingCount === "number"
      ? ` Full match count: ${finding.evidence.fullFindingCount}; rule-cap omissions: ${finding.evidence.omittedFindingCount}.`
      : "";
    lines.push(`- ${location(finding)} — ${finding.ruleId} (${finding.confidence}): ${inline(finding.message, 140)}${countText}${excerptText}`);
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
