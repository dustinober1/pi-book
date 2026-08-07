import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { buildChapterContext } from "../context/context-builder.js";
import {
  QualityBudgetDowngradeError,
  QualityBudgetStopError,
  runBudgetedQualityDraft,
} from "../application/budgeted-quality-draft.js";
import { minimumCallReservationTokens } from "../application/budgeted-quality-worker.js";
import { ForegroundEconomyTelemetry } from "../application/foreground-economy-telemetry.js";
import { runPersistentQualityDraft } from "../application/quality-persistent-run.js";
import { beginQualityPersistentRun, resumeQualityPersistentRun } from "../application/quality-run.js";
import { recordAuthorQuestion } from "../application/journey-trace.js";
import { runExplicitVoiceRecalibration } from "../application/recalibration.js";
import { findProjectRoot } from "../infrastructure/files.js";
import { directDraftDecision } from "../application/run.js";
import { modelExecutionProfileDeprecationAdvisory } from "../domain/model-execution-profile.js";
import { qualityStateWithOverride, resolveQualityConfig } from "../domain/quality-profile.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { readProject, requireProjectRoot } from "../project/store.js";
import { resolveRuntimeProfile } from "../application/runtime-profile-resolver.js";
import { parseDraftOptions, parseRunOptions } from "./arguments.js";
import { registerChapterStepCommand } from "./chapter-step-command.js";
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
  foregroundTelemetry?: ForegroundEconomyTelemetry;
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

function withQualityDraft(
  definition: CommandDefinition,
  options: NovelForgeExtensionOptions,
  foreground: ForegroundEconomyTelemetry,
): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    description: "Draft the next approved chapter with economy or isolated higher-quality passes",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const draft = parseDraftOptions(args);
        const draftProfileAdvisory = draft.modelExecutionProfile ? modelExecutionProfileDeprecationAdvisory(draft.modelExecutionProfile) : null;
        if (draftProfileAdvisory) context.ui.notify(draftProfileAdvisory, "warning");
        const project = readProject(root);
        const qualityState = qualityStateWithOverride(project.quality, draft.quality);
        const runtime = resolveRuntimeProfile({ project: project.runtime?.profile });
        const provider = process.env.NOVEL_FORGE_QUALITY_PROVIDER?.trim();
        const model = process.env.NOVEL_FORGE_QUALITY_MODEL?.trim();
        let worker: QualityWorker | undefined;

        while (true) {
          const quality = resolveQualityConfig(qualityState);
          if (quality.tier === "economy") {
            const decision = directDraftDecision(root, draft.chapter);
            if (!decision.prompt) {
              await original.handler(args, context);
              return;
            }
            const chapterContext = buildChapterContext(root, draft.chapter, runtime.maxContextChars, runtime.graphDepth);
            try {
              foreground.begin({
                root,
                chapter: chapterContext.packet.chapter,
                runtimeProfile: runtime.id,
                minimumTokens: minimumCallReservationTokens({
                  callId: "economy-preflight",
                  stage: "drafting",
                  chapter: chapterContext.packet.chapter,
                  pass: "candidate",
                  prompt: decision.prompt,
                  context: chapterContext.text,
                  timeoutMs: 1,
                }),
                limits: quality.budget,
                ...(project.runtime?.telemetry !== undefined ? { telemetryEnabled: project.runtime.telemetry } : {}),
              });
            } catch (error) {
              if (error instanceof QualityBudgetStopError) {
                context.ui.notify(`Quality budget stopped economy drafting at ${error.reason}. No model call or canonical manuscript change occurred.`, "warning");
                return;
              }
              throw error;
            }
            try {
              await original.handler(args, context);
            } catch (error) {
              foreground.cancel();
              throw error;
            }
            return;
          }
          worker ??= options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
          try {
            const result = await runBudgetedQualityDraft({
              root,
              ...(draft.chapter !== undefined ? { chapter: draft.chapter } : {}),
              ...(draft.modelExecutionProfile ? { modelExecutionProfile: draft.modelExecutionProfile } : {}),
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

function withQualityRun(definition: CommandDefinition, options: NovelForgeExtensionOptions): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    description: "Run persistent guarded work with isolated higher-quality drafting when configured",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const parsed = parseRunOptions(args);
        const runProfileAdvisory = parsed.modelExecutionProfile ? modelExecutionProfileDeprecationAdvisory(parsed.modelExecutionProfile) : null;
        if (runProfileAdvisory) context.ui.notify(runProfileAdvisory, "warning");
        if (parsed.pause || parsed.cancel) {
          await original.handler(args, context);
          return;
        }
        const root = requireProjectRoot(context.cwd);
        let project = readProject(root);
        const provider = process.env.NOVEL_FORGE_QUALITY_PROVIDER?.trim();
        const model = process.env.NOVEL_FORGE_QUALITY_MODEL?.trim();

        if (parsed.resume) {
          const snapshot = project.automation.active_run?.quality_snapshot;
          if (!snapshot || resolveQualityConfig(snapshot).tier === "economy") {
            await original.handler(args, context);
            return;
          }
          const resumed = resumeQualityPersistentRun(root);
          if (!resumed.prompt) {
            context.ui.notify(resumed.message, resumed.action === "blocked" ? "warning" : "info");
            return;
          }
          project = readProject(root);
        } else {
          if (project.current_stage !== "drafting" || (!parsed.until && !parsed.maxChapters)) {
            await original.handler(args, context);
            return;
          }
          const state = qualityStateWithOverride(project.quality, parsed.quality);
          if (resolveQualityConfig(state).tier === "economy") {
            await original.handler(args, context);
            return;
          }
          const started = beginQualityPersistentRun(root, {
            target: parsed.until ?? "next-milestone",
            maxChapters: parsed.maxChapters ?? project.automation.max_chapters_per_run,
            ...(parsed.runtimeProfile ? { runtimeProfile: parsed.runtimeProfile } : {}),
            ...(parsed.modelExecutionProfile ? { modelExecutionProfile: parsed.modelExecutionProfile } : {}),
            ...(parsed.quality ? { quality: parsed.quality } : {}),
          });
          if (!started.prompt) {
            context.ui.notify(started.message, started.action === "blocked" ? "warning" : "info");
            return;
          }
          project = readProject(root);
        }

        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const active = project.automation.active_run;
        if (!active) throw new Error("Persistent quality run did not create an active checkpoint.");
        const result = await runPersistentQualityDraft({
          root,
          worker,
          maxChapters: active.requestedMaxChapters,
          ...(provider ? { provider } : {}),
          ...(model ? { model } : {}),
          onProgress(name) { context.ui.notify(`Quality run: ${name}`, "info"); },
        });
        const downgrade = result.downgradedTo ? ` Downgraded to ${result.downgradedTo}.` : "";
        const guarded = result.chapters.filter((item) => item.path === "guarded-scene-execution").length;
        const paths = result.chapters.length
          ? ` ${guarded} of ${result.chapters.length} used guarded scene execution.`
          : "";
        context.ui.notify(`Persistent quality run ${result.runId} ${result.status} at ${result.stopReason} after ${result.chapters.length} chapter(s).${paths}${downgrade}`, result.status === "stopped" ? "warning" : "info");
        // Advisories are the only place the unguarded-path disclosure appears.
        for (const advisory of result.advisories) context.ui.notify(advisory, "warning");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  };
  return decorated as unknown as CommandDefinition;
}

function registerForegroundTelemetryHooks(pi: ExtensionAPI, foreground: ForegroundEconomyTelemetry): void {
  const eventApi = pi as ExtensionAPI & { on?: ExtensionAPI["on"] };
  if (typeof eventApi.on !== "function") return;
  pi.on("before_agent_start", async (event) => {
    foreground.capturePrompt(event.prompt);
  });
  pi.on("model_select", async (event) => {
    foreground.captureModel(event.model);
  });
  pi.on("turn_end", async (event, context) => {
    foreground.complete(event.message, context.getContextUsage());
  });
}

/**
 * Count the questions a command actually put to the writer.
 *
 * Author actions are the half of the velocity metric that automation cannot
 * remove without crossing a boundary this project holds, so they have to be
 * counted where they happen rather than estimated. Wrapping the UI once here
 * covers every command instead of threading a counter through each handler,
 * and a question asked before a project exists is simply not recorded — there
 * is nowhere to record it, and inventing a home for it would be worse than the
 * known undercount.
 */
function withQuestionRecording(definition: CommandDefinition): CommandDefinition {
  const original = definition as unknown as ReviewCommandDefinition;
  const decorated: ReviewCommandDefinition = {
    ...original,
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      const ui = context.ui as { input?: unknown; select?: unknown };
      const note = (): void => {
        try {
          const root = findProjectRoot(context.cwd);
          if (root) recordAuthorQuestion(root, readProject(root).runtime?.telemetry);
        } catch { /* diagnostic only */ }
      };
      const recordingUi = new Proxy(context.ui as object, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if ((property === "input" || property === "select") && typeof value === "function") {
            return (...args: unknown[]) => { note(); return (value as (...items: unknown[]) => unknown).apply(target, args); };
          }
          return typeof value === "function" ? (value as (...items: unknown[]) => unknown).bind(target) : value;
        },
      });
      void ui;
      await original.handler(args, { ...context, ui: recordingUi } as ExtensionCommandContext);
    },
  };
  return decorated as unknown as CommandDefinition;
}

export function registerNovelForgeWithRecalibration(pi: ExtensionAPI, options: NovelForgeExtensionOptions = {}): void {
  const foreground = options.foregroundTelemetry ?? new ForegroundEconomyTelemetry();
  registerForegroundTelemetryHooks(pi, foreground);
  const registerCommand = pi.registerCommand.bind(pi);
  const proxy = new Proxy(pi as object, {
    get(target, property, receiver) {
      if (property === "registerCommand") {
        return (name: string, definition: CommandDefinition): void => {
          const decorated = name === "novel-review"
            ? withRecalibration(definition)
            : name === "novel-draft"
              ? withQualityDraft(definition, options, foreground)
              : name === "novel-run"
                ? withQualityRun(definition, options)
                : definition;
          registerCommand(name, withQuestionRecording(decorated));
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(pi) : value;
    },
  }) as ExtensionAPI;
  registerNovelForge(proxy);
  registerChapterStepCommand(pi, options);
}
