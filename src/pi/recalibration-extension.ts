import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  QualityBudgetDowngradeError,
  QualityBudgetStopError,
  runBudgetedQualityDraft,
} from "../application/budgeted-quality-draft.js";
import { runExplicitVoiceRecalibration } from "../application/recalibration.js";
import { qualityStateWithOverride, resolveQualityConfig } from "../domain/quality-profile.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { readProject, requireProjectRoot } from "../project/store.js";
import { resolveRuntimeProfile } from "../application/runtime-profile-resolver.js";
import { parseDraftOptions } from "./arguments.js";
import { registerNovelForge } from "./extension.js";
import { PiPrintWorker } from "./pi-print-worker.js";

type CommandDefinition = Parameters<ExtensionAPI["registerCommand"]>[1];

type Completion = { value: string; label: string; description?: string };

interface ReviewCommandDefinition {
  description?: string;
  getArgumentCompletions?: (prefix: string) => Completion[] | null;
  handler: (args: string, context: ExtensionCommandContext) => Promise<void> | void;
  [key: string]: unknown;
}

export interface NovelForgeExtensionOptions {
  createQualityWorker?: (root: string) => QualityWorker;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withRecalibration(definition: CommandDefinition): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    description: "Review a chapter, act, manuscript, series, or explicit voice recalibration",
    getArgumentCompletions(prefix: string): Completion[] | null {
      const existing = original.getArgumentCompletions?.(prefix) ?? [];
      const items = [...existing];
      if ("recalibration".startsWith(prefix) && !items.some((item) => item.value === "recalibration")) {
        items.push({ value: "recalibration", label: "recalibration", description: "Record a state-neutral voice recalibration audit" });
      }
      return items.length ? items : null;
    },
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      const scope = args.trim().split(/\s+/)[0] || "act";
      if (scope !== "recalibration") {
        await original.handler(args, context);
        return;
      }
      try {
        const root = requireProjectRoot(context.cwd);
        const result = runExplicitVoiceRecalibration(root);
        context.ui.notify(`Voice recalibration recorded. Stage remains ${result.stage}.`, "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  };
  return decorated as unknown as CommandDefinition;
}

function withQualityDraft(definition: CommandDefinition, options: NovelForgeExtensionOptions): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    description: "Draft the next approved chapter with economy or isolated higher-quality passes",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const draft = parseDraftOptions(args);
        const project = readProject(root);
        const qualityState = qualityStateWithOverride(project.quality, draft.quality);
        const runtime = resolveRuntimeProfile({ project: project.runtime?.profile });
        const provider = process.env.NOVEL_FORGE_QUALITY_PROVIDER?.trim();
        const model = process.env.NOVEL_FORGE_QUALITY_MODEL?.trim();
        let worker: QualityWorker | undefined;

        while (true) {
          const quality = resolveQualityConfig(qualityState);
          if (quality.tier === "economy") {
            await original.handler(args, context);
            return;
          }
          worker ??= options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
          try {
            const result = await runBudgetedQualityDraft({
              root,
              ...(draft.chapter !== undefined ? { chapter: draft.chapter } : {}),
              runtimeProfile: runtime,
              qualityConfig: quality,
              worker,
              ...(provider ? { provider } : {}),
              ...(model ? { model } : {}),
              onProgress(name) { context.ui.notify(`Quality pass: ${name}`, "info"); },
            });
            context.ui.notify(`${result.tier} quality draft complete for Chapter ${result.chapter}. ${result.calls.length} isolated model call(s); ${result.changed.length} canonical file(s) changed.`, "info");
            return;
          } catch (error) {
            if (error instanceof QualityBudgetDowngradeError) {
              context.ui.notify(`Quality budget downgraded ${error.fromTier} to ${error.toTier} at ${error.reason}. Restarting without canonical manuscript changes.`, "info");
              qualityState.tier = error.toTier;
              continue;
            }
            if (error instanceof QualityBudgetStopError) {
              context.ui.notify(`Quality budget stopped drafting at ${error.reason}. No canonical manuscript change was applied.`, "warning");
              return;
            }
            throw error;
          }
        }
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  };
  return decorated as unknown as CommandDefinition;
}

export function registerNovelForgeWithRecalibration(pi: ExtensionAPI, options: NovelForgeExtensionOptions = {}): void {
  const registerCommand = pi.registerCommand.bind(pi);
  const proxy = new Proxy(pi as object, {
    get(target, property, receiver) {
      if (property === "registerCommand") {
        return (name: string, definition: CommandDefinition): void => {
          const decorated = name === "novel-review"
            ? withRecalibration(definition)
            : name === "novel-draft"
              ? withQualityDraft(definition, options)
              : definition;
          registerCommand(name, decorated);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(pi) : value;
    },
  }) as ExtensionAPI;
  registerNovelForge(proxy);
}
