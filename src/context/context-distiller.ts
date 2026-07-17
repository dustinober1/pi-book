import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import type { ContextBuildReport, ContextSectionReport } from "./context-report.js";

export interface ContextCandidate {
  id: string;
  title: string;
  priority: number;
  required: boolean;
  body: string;
  compactBody?: string;
  recordIds: readonly string[];
}

export interface DistillContextOptions {
  profileId: RuntimeProfileId;
  maxChars: number;
}

export interface DistilledContext {
  text: string;
  report: ContextBuildReport;
}

function sectionText(title: string, body: string): string {
  return `\n## ${title}\n\n${body.trim()}`;
}

function reportFor(candidate: ContextCandidate, status: ContextSectionReport["status"], renderedChars: number, reason?: string): ContextSectionReport {
  return {
    id: candidate.id,
    title: candidate.title,
    required: candidate.required,
    priority: candidate.priority,
    status,
    sourceChars: candidate.body.length,
    renderedChars,
    estimatedTokens: Math.ceil(renderedChars / 4),
    recordIds: [...new Set(candidate.recordIds)].sort(),
    ...(reason ? { reason } : {}),
  };
}

function requiredVariants(candidate: ContextCandidate): { full: string; compact: string | null; minimum: number } {
  const full = sectionText(candidate.title, candidate.body);
  const compact = candidate.compactBody ? sectionText(candidate.title, candidate.compactBody) : null;
  return { full, compact, minimum: compact ? Math.min(full.length, compact.length) : full.length };
}

export function assertRequiredContextIds(requiredIds: readonly string[], availableIds: ReadonlySet<string>): void {
  const missing = [...new Set(requiredIds.filter((id) => !availableIds.has(id)))].sort();
  if (missing.length) throw new Error(`Missing required context record IDs: ${missing.join(", ")}`);
}

export function distillContext(candidates: readonly ContextCandidate[], options: DistillContextOptions): DistilledContext {
  if (!Number.isInteger(options.maxChars) || options.maxChars <= 0) throw new Error("Context maxChars must be a positive integer.");
  const ordered = candidates.map((candidate, index) => ({ candidate, index })).sort((left, right) => left.candidate.priority - right.candidate.priority || left.index - right.index);
  const required = ordered.filter((item) => item.candidate.required);
  const output: string[] = [];
  const reports = new Map<string, ContextSectionReport>();
  let remaining = options.maxChars;

  const totalMinimum = required.reduce((total, item) => total + requiredVariants(item.candidate).minimum, 0);
  if (totalMinimum > remaining) {
    const first = required.find((item) => requiredVariants(item.candidate).minimum > 0)?.candidate.id ?? "unknown";
    throw new Error(`Context budget cannot fit required context section: ${first}.`);
  }

  for (let index = 0; index < required.length; index += 1) {
    const candidate = required[index]!.candidate;
    const variants = requiredVariants(candidate);
    const laterMinimum = required.slice(index + 1).reduce((total, item) => total + requiredVariants(item.candidate).minimum, 0);
    if (variants.full.length + laterMinimum <= remaining) {
      output.push(variants.full);
      remaining -= variants.full.length;
      reports.set(candidate.id, reportFor(candidate, "included", variants.full.length));
      continue;
    }
    if (variants.compact && variants.compact.length + laterMinimum <= remaining) {
      output.push(variants.compact);
      remaining -= variants.compact.length;
      reports.set(candidate.id, reportFor(candidate, "compacted", variants.compact.length, "Full section was compacted to reserve space for all required context."));
      continue;
    }
    reports.set(candidate.id, reportFor(candidate, "blocked", 0, "Required section could not fit without dropping normative records."));
    throw new Error(`Context budget cannot fit required context section: ${candidate.id}.`);
  }

  for (const { candidate } of ordered.filter((item) => !item.candidate.required)) {
    const full = sectionText(candidate.title, candidate.body);
    if (full.length <= remaining) {
      output.push(full);
      remaining -= full.length;
      reports.set(candidate.id, reportFor(candidate, "included", full.length));
    } else {
      reports.set(candidate.id, reportFor(candidate, "omitted", 0, "Optional section exceeded the remaining context budget."));
    }
  }

  const text = output.join("");
  const sections = candidates.map((candidate) => reports.get(candidate.id) ?? reportFor(candidate, "omitted", 0, "Section was not selected."));
  const report: ContextBuildReport = {
    schemaVersion: "1.0.0",
    profileId: options.profileId,
    maxChars: options.maxChars,
    renderedChars: text.length,
    estimatedTokens: Math.ceil(text.length / 4),
    sections,
    warnings: sections.filter((section) => section.status === "omitted").map((section) => `Omitted optional context section: ${section.id}.`),
  };
  return { text, report };
}
