import type { RunOptions } from "../application/run.js";

export const allowedUntilTargets = ["voice-approval", "book-plan-approval", "first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-review", "next-milestone"] as const;
export function tokens(args: string): string[] { return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^["']|["']$/g, "")) ?? []; }
export function flagValue(items: string[], flag: string): string | undefined { const index = items.indexOf(flag); return index >= 0 ? items[index + 1] : undefined; }
export function parseRunOptions(args: string): RunOptions {
  const items = tokens(args);
  const approve = flagValue(items, "--approve");
  const until = flagValue(items, "--until");
  const rawMax = flagValue(items, "--max-chapters");
  const resume = items.includes("--resume");
  const pause = items.includes("--pause");
  const cancel = items.includes("--cancel");
  if ([resume, pause, cancel].filter(Boolean).length > 1) throw new Error("Use only one of --resume, --pause, or --cancel; these controls are mutually exclusive.");
  if ((resume || pause || cancel) && (approve || until || rawMax || items.includes("--no-prose") || items.includes("--review-only"))) {
    throw new Error("Run-control flags cannot be combined with approval, target, chapter, no-prose, or review-only options.");
  }
  if (until && !allowedUntilTargets.includes(until as never)) throw new Error(`Unknown --until target: ${until}. Allowed: ${allowedUntilTargets.join(", ")}.`);
  let maxChapters: number | undefined;
  if (rawMax !== undefined) { maxChapters = Number.parseInt(rawMax, 10); if (!Number.isInteger(maxChapters) || maxChapters < 1 || maxChapters > 10) throw new Error("--max-chapters must be an integer from 1 to 10."); }
  return {
    ...(approve ? { approve } : {}),
    ...(until ? { until } : {}),
    ...(maxChapters ? { maxChapters } : {}),
    resume,
    pause,
    cancel,
    noProse: items.includes("--no-prose"),
    reviewOnly: items.includes("--review-only"),
    stopOnWarning: items.includes("--stop-on-warning"),
  };
}
