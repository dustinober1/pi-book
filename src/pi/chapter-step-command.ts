import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { runChapterExecution, type ChapterExecutionRunResult } from "../application/chapter-execution-run.js";
import { advanceChapterExecutionStep } from "../application/chapter-execution-stepper.js";
import { renderChapterStepResult, resolveChapterStepTarget } from "../application/chapter-execution-command.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { requireProjectRoot } from "../project/store.js";
import { parseChapterStepOptions, parseSceneCriticSelection, type ChapterStepTargetId } from "./arguments.js";
import { PiPrintWorker } from "./pi-print-worker.js";
import { registerPlanChangeCommand } from "./plan-change-command.js";

export interface ChapterStepCommandOptions {
  createQualityWorker?: (root: string) => QualityWorker;
}

interface RunStepInput {
  root: string;
  chapter?: number;
  runId?: string;
  criticJobTypes: ReturnType<typeof parseSceneCriticSelection>;
  until: ChapterStepTargetId;
  worker: QualityWorker;
  signal?: AbortSignal;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runStep(input: RunStepInput) {
  const target = resolveChapterStepTarget(input.root, {
    ...(input.chapter !== undefined ? { chapter: input.chapter } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
  });
  const provider = process.env.NOVEL_FORGE_QUALITY_PROVIDER?.trim();
  const model = process.env.NOVEL_FORGE_QUALITY_MODEL?.trim();
  const stepInput = {
    root: input.root,
    chapter: target.chapter,
    runId: target.runId,
    worker: input.worker,
    requiredCriticJobTypes: input.criticJobTypes,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  };
  if (input.until === "chapter-complete") {
    const run = await runChapterExecution(stepInput);
    return { target, result: { action: run.actions[run.actions.length - 1]!, state: run.state }, run };
  }
  const result = await advanceChapterExecutionStep(stepInput);
  return { target, result, run: undefined };
}

function renderRun(run: ChapterExecutionRunResult): string {
  return [
    `Steps: ${run.steps}`,
    `Stop reason: ${run.stopReason}`,
    `Guarded chapter commit: ${run.committed ? "yes" : "no"}`,
  ].join("\n");
}

export function registerChapterStepCommand(pi: ExtensionAPI, options: ChapterStepCommandOptions = {}): void {
  registerPlanChangeCommand(pi);
  pi.registerTool({
    name: "novel_advance_chapter_step",
    label: "Novel Forge Advance Chapter Step",
    description: "Advance persisted scene or chapter execution using the prepared chapter contract, bounded context, isolated model jobs, deterministic validation, critics, repair, state delta, ordered acceptance, chapter validation, and guarded commit. Advances one stage by default, or drives the whole chapter with until=chapter-complete.",
    promptSnippet: "Advance Novel Forge chapter execution and inspect the returned checkpoint.",
    promptGuidelines: [
      "Use novel_advance_chapter_step for approved chapter drafting instead of composing a whole chapter in the host response or calling novel_apply_event with draft-chapter.",
      "Prefer until=chapter-complete: it runs the same persisted stages to the chapter's guarded commit and stops at exactly the same boundaries a single step would, without a tool call per stage.",
      "With the default until=next-checkpoint, call the tool one stage at a time and reuse the returned run_id on every subsequent call for that chapter.",
      "Continue only while the returned execution status is active. Stop on blocked, paused, cancelled, stopped, completed, or any writer gate.",
      "Do not write manuscript, run artifacts, PROJECT.yaml, BOOK.yaml, STATUS.md, HANDOFF.md, or canonical story ledgers directly.",
    ],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String()),
      chapter: Type.Optional(Type.Integer({ minimum: 1 })),
      run_id: Type.Optional(Type.String({ minLength: 1 })),
      // Enumerated so a wrong value — a genre profile, for instance — is
      // impossible to send rather than rejected after the call.
      critics: Type.Optional(Type.Array(Type.Union([
        Type.Literal("continuity"),
        Type.Literal("causality"),
        Type.Literal("character-intent"),
        Type.Literal("style"),
        Type.Literal("factuality"),
        Type.Literal("all"),
      ]), { minItems: 1, uniqueItems: true })),
      until: Type.Optional(Type.Union([
        Type.Literal("next-checkpoint"),
        Type.Literal("chapter-complete"),
      ])),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const root = requireProjectRoot(params.project_root || ctx.cwd);
        const criticJobTypes = parseSceneCriticSelection(params.critics?.join(","));
        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const { target, result, run } = await runStep({
          root,
          ...(params.chapter !== undefined ? { chapter: params.chapter } : {}),
          ...(params.run_id !== undefined ? { runId: params.run_id } : {}),
          criticJobTypes,
          until: params.until ?? "next-checkpoint",
          worker,
          ...(signal ? { signal } : {}),
        });
        const text = run
          ? `${renderChapterStepResult(target, result)}\n${renderRun(run)}`
          : renderChapterStepResult(target, result);
        return {
          content: [{ type: "text", text }],
          details: {
            run_id: target.runId,
            chapter: target.chapter,
            action: result.action,
            checkpoint: result.state.current_node,
            scene_id: result.state.current_scene_id,
            status: result.state.status,
            state: result.state,
            ...(run ? { steps: run.steps, stop_reason: run.stopReason, committed: run.committed, actions: run.actions } : {}),
          },
        };
      } catch (error) {
        const message = errorText(error);
        return {
          content: [{ type: "text", text: `Novel Forge chapter step blocked: ${message}` }],
          details: { error: message },
        };
      }
    },
  });

  pi.registerCommand("novel-chapter-step", {
    description: "Advance persisted scene or chapter execution without replaying completed work; --until chapter-complete drives the whole chapter",
    getArgumentCompletions: (prefix: string) => {
      const filtered = ["--until", "--critics", "--run"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value }));
      return filtered.length ? filtered : null;
    },
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const parsed = parseChapterStepOptions(args);
        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const { target, result, run } = await runStep({
          root,
          ...(parsed.chapter !== undefined ? { chapter: parsed.chapter } : {}),
          ...(parsed.runId !== undefined ? { runId: parsed.runId } : {}),
          criticJobTypes: parsed.criticJobTypes,
          until: parsed.until,
          worker,
        });
        const text = run
          ? `${renderChapterStepResult(target, result)}\n${renderRun(run)}`
          : renderChapterStepResult(target, result);
        context.ui.notify(text, "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  });
}
