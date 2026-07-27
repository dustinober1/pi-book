import { join } from "node:path";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { dialogueVoiceRules, mechanicalRules, normalizeDocument, runProseLint, stylePatternRules } from "./prose-lint/index.js";
import type { LintFinding } from "./prose-lint/index.js";

/**
 * Deterministic lint for a chapter draft at the moment it is submitted.
 *
 * The prose-lint engine already carried every style-tell rule, but it was only
 * reachable from act and manuscript review prompts — which run several chapters
 * after the voice has set, when changing it is expensive. This runs the same
 * rules against the submitted content, before the event applies, and reports
 * through the advisory channel so a finding reaches the writer without blocking
 * an otherwise valid draft.
 *
 * It reads the submitted text rather than the file on disk: at validation time
 * the draft has not been written yet, and reading disk would lint the previous
 * revision.
 */

/** Findings beyond this are summarised as a count rather than listed. */
const MAX_REPORTED_FINDINGS = 6;

export interface DraftLintReport {
  advisories: string[];
  findingCount: number;
  baselineApplied: boolean;
}

function acceptedBaselineMetrics(root: string): Record<string, number> | null {
  const text = readText(join(root, "series", "voice-guardrails.yaml"));
  if (text === null) return null;
  let guardrails: VoiceGuardrails;
  try {
    guardrails = parseYaml<VoiceGuardrails>(text, VoiceGuardrailsSchema, "series/voice-guardrails.yaml");
  } catch {
    return null;
  }
  if (!guardrails.baseline.path?.trim() || !guardrails.baseline.content_hash?.trim()) return null;
  const metrics = Object.entries(guardrails.baseline.metrics).filter(([, value]) => Number.isFinite(value));
  return metrics.length > 0 ? Object.fromEntries(metrics) : null;
}

function describe(finding: LintFinding): string {
  const line = finding.location.line === undefined ? "" : ` (line ${finding.location.line})`;
  const excerpt = finding.excerpt.trim() === "" ? "" : ` Excerpt: “${finding.excerpt.replace(/\s+/g, " ").slice(0, 120)}”`;
  return `${finding.ruleId}${line}: ${finding.message}${excerpt}`;
}

/**
 * Lints a submitted chapter draft. Returns advisories only — nothing here
 * rejects an event. Style findings are review evidence, not authorship
 * detection, and a deliberate voice choice can legitimately produce one.
 */
export function draftLintReport(root: string, chapter: number, path: string, content: string): DraftLintReport {
  const baselineMetrics = acceptedBaselineMetrics(root);
  const result = runProseLint({
    documents: [normalizeDocument(path, content, 1)],
    rules: [...mechanicalRules, ...stylePatternRules, ...dialogueVoiceRules],
    ...(baselineMetrics === null ? {} : { baselineMetrics }),
  });

  const advisories: string[] = [];
  if (result.findings.length > 0) {
    const shown = result.findings.slice(0, MAX_REPORTED_FINDINGS);
    const omitted = result.findings.length - shown.length;
    const tail = omitted > 0 ? ` ${omitted} further ${omitted === 1 ? "finding was" : "findings were"} omitted from this summary.` : "";
    advisories.push(
      `Deterministic prose lint reported ${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"} on chapter ${chapter}. `
      + `These are review evidence, not authorship detection; verify each in manuscript context and preserve intentional voice choices. `
      + `${shown.map(describe).join(" | ")}${tail}`,
    );
  }

  // Silence and "the strongest rules were disabled" must not look the same. The
  // absolute reference bands still apply without a baseline, but the drift rules
  // do not, and the writer is entitled to know which checks actually ran.
  if (baselineMetrics === null) {
    advisories.push(
      `No accepted voice baseline exists at series/voice-guardrails.yaml, so chapter ${chapter} was measured only against the absolute published-fiction reference bands, not against this book's own accepted voice. `
      + `Voice-drift findings could not be produced. Accept a baseline through the voice-profile workflow to enable them.`,
    );
  }

  return { advisories, findingCount: result.findings.length, baselineApplied: baselineMetrics !== null };
}
