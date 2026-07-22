import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { advanceChapterExecutionStep } from "../application/chapter-execution-stepper.js";
import { renderChapterStepResult, resolveChapterStepTarget } from "../application/chapter-execution-command.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { requireProjectRoot } from "../project/store.js";
import { parseChapterStepOptions } from "./arguments.js";
import { PiPrintWorker } from "./pi-print-worker.js";

export interface ChapterStepCommandOptions {
  createQualityWorker?: (root: string) => QualityWorker;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerChapterStepCommand(pi: ExtensionAPI, options: ChapterStepCommandOptions = {}): void {
  pi.registerCommand("novel-chapter-step", {
    description: "Advance one persisted scene or chapter execution stage without replaying completed work",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const parsed = parseChapterStepOptions(args);
        const target = resolveChapterStepTarget(root, {
          ...(parsed.chapter !== undefined ? { chapter: parsed.chapter } : {}),
          ...(parsed.runId !== undefined ? { runId: parsed.runId } : {}),
        });
        const provider = process.env.NOVEL_FORGE_QUALITY_PROVIDER?.trim();
        const model = process.env.NOVEL_FORGE_QUALITY_MODEL?.trim();
        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const result = await advanceChapterExecutionStep({
          root,
          chapter: target.chapter,
          runId: target.runId,
          worker,
          requiredCriticJobTypes: parsed.criticJobTypes,
          ...(provider ? { provider } : {}),
          ...(model ? { model } : {}),
        });
        context.ui.notify(renderChapterStepResult(target, result), "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  });
}
