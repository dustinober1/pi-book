import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { budgetLedgerUsage } from "./budget-ledger.js";
import { resolveQualityConfig } from "../domain/quality-profile.js";
import { readBudgetLedger } from "../infrastructure/budget-ledger-store.js";
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
  const reportUsageTotals = recordedBudgetUsage(root);
  const ledger = readBudgetLedger(root);
  const usage = budgetLedgerUsage(ledger);
  const remaining = quality.budget.maximumTotalTokens === null
    ? "unlimited"
    : Math.max(0, quality.budget.maximumTotalTokens - usage.totalTokens - usage.activeReservedTokens).toLocaleString("en-US");
  const downgradeEvents = ledger.events.filter((event) => event.type === "downgrade").length;
  const stopEvents = ledger.events.filter((event) => event.type === "stop").length;
  return [
    "# Quality Budget",
    "",
    `Quality tier: ${quality.tier}`,
    `Adaptive allocation: ${quality.adaptive ? "enabled" : "disabled"}`,
    `Maximum total tokens: ${limit(quality.budget.maximumTotalTokens)}`,
    `Maximum tokens per chapter: ${limit(quality.budget.maximumTokensPerChapter)}`,
    `Maximum calls per chapter: ${limit(quality.budget.maximumCallsPerChapter)}`,
    `Budget exhaustion: ${quality.budget.onExhaustion}`,
    `Recorded tokens: ${usage.totalTokens.toLocaleString("en-US")}`,
    `Recorded model calls: ${usage.settledCalls.toLocaleString("en-US")}`,
    `Active reserved tokens: ${usage.activeReservedTokens.toLocaleString("en-US")}`,
    `Active reservations: ${usage.activeReservations.toLocaleString("en-US")}`,
    `Recorded downgrades: ${downgradeEvents.toLocaleString("en-US")}`,
    `Recorded stops: ${stopEvents.toLocaleString("en-US")}`,
    `Recorded cost: $${reportUsageTotals.costUsd.toFixed(4)}`,
    `Remaining known tokens: ${remaining}`,
    "",
    "The enforcement ledger counts settled calls and live reservations. Cost is read from privacy-safe schema-2 run reports; missing provider usage remains unknown rather than being invented.",
  ].join("\n");
}
