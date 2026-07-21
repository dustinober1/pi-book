import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveQualityConfig } from "../domain/quality-profile.js";
import { readProject } from "../project/store.js";

interface RecordedUsage {
  tokens: number;
  calls: number;
  costUsd: number;
}

function finiteNonnegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function reportUsage(value: unknown): RecordedUsage {
  if (!value || typeof value !== "object") return { tokens: 0, calls: 0, costUsd: 0 };
  const report = value as Record<string, unknown>;
  if (report.schemaVersion === "1.0.0") {
    // Version 1 reports were prepared-run headers, not proof that a model call occurred.
    return { tokens: 0, calls: 0, costUsd: 0 };
  }
  const totals = report.totals && typeof report.totals === "object" ? report.totals as Record<string, unknown> : {};
  const calls = Array.isArray(report.modelCalls) ? report.modelCalls.length : 0;
  return {
    tokens: finiteNonnegative(totals.totalTokens),
    calls,
    costUsd: finiteNonnegative(totals.costUsd),
  };
}

export function recordedBudgetUsage(root: string): RecordedUsage {
  const directory = join(root, ".pi-book", "runs");
  if (!existsSync(directory)) return { tokens: 0, calls: 0, costUsd: 0 };
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .reduce<RecordedUsage>((total, entry) => {
      const path = join(directory, entry.name, "run-report.json");
      if (!existsSync(path)) return total;
      try {
        const usage = reportUsage(JSON.parse(readFileSync(path, "utf8")) as unknown);
        return {
          tokens: total.tokens + usage.tokens,
          calls: total.calls + usage.calls,
          costUsd: total.costUsd + usage.costUsd,
        };
      } catch {
        return total;
      }
    }, { tokens: 0, calls: 0, costUsd: 0 });
}

function limit(value: number | null): string {
  return value === null ? "unlimited" : value.toLocaleString("en-US");
}

export function renderBudgetStatus(root: string): string {
  const project = readProject(root);
  const quality = resolveQualityConfig(project.quality);
  const usage = recordedBudgetUsage(root);
  const remaining = quality.budget.maximumTotalTokens === null
    ? "unlimited"
    : Math.max(0, quality.budget.maximumTotalTokens - usage.tokens).toLocaleString("en-US");
  return [
    "# Quality Budget",
    "",
    `Quality tier: ${quality.tier}`,
    `Adaptive allocation: ${quality.adaptive ? "enabled" : "disabled"}`,
    `Maximum total tokens: ${limit(quality.budget.maximumTotalTokens)}`,
    `Maximum tokens per chapter: ${limit(quality.budget.maximumTokensPerChapter)}`,
    `Maximum calls per chapter: ${limit(quality.budget.maximumCallsPerChapter)}`,
    `Budget exhaustion: ${quality.budget.onExhaustion}`,
    `Recorded tokens: ${usage.tokens.toLocaleString("en-US")}`,
    `Recorded model calls: ${usage.calls.toLocaleString("en-US")}`,
    `Recorded cost: $${usage.costUsd.toFixed(4)}`,
    `Remaining known tokens: ${remaining}`,
    "",
    "Only completed schema-2 model calls in locally retained run reports are counted. Missing usage remains unknown rather than being invented.",
  ].join("\n");
}
