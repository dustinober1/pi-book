import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { advanceChapterExecutionStep } from "../application/chapter-execution-stepper.js";
import { renderChapterStepResult, resolveChapterStepTarget } from "../application/chapter-execution-command.js";
import type { QualityWorker } from "../domain/quality-worker.js";
import { requireProjectRoot } from "../project/store.js";
import { parseChapterStepOptions, parseSceneCriticSelection } from "./arguments.js";
import { PiPrintWorker } from "./pi-print-worker.js";

export interface ChapterStepCommandOptions {
  createQualityWorker?: (root: string) => QualityWorker;
}

interface RunStepInput {
  root: string;
  chapter?: number;
  runId?: string;
  criticJobTypes: ReturnType<typeof parseSceneCriticSelection>;
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
  const result = await advanceChapterExecutionStep({
    root: input.root,
    chapter: target.chapter,
    runId: target.runId,
    worker: input.worker,
    requiredCriticJobTypes: input.criticJobTypes,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  return { target, result };
}

export function registerChapterStepCommand(pi: ExtensionAPI, options: ChapterStepCommandOptions = {}): void {
  pi.registerTool({
    name: "novel_advance_chapter_step",
    label: "Novel Forge Advance Chapter Step",
    description: "Advance exactly one persisted scene or chapter execution stage using the prepared chapter contract, bounded context, isolated model jobs, deterministic validation, critics, repair, state delta, ordered acceptance, chapter validation, and guarded commit.",
    promptSnippet: "Advance one persisted Novel Forge chapter execution stage and inspect the returned checkpoint before calling again.",
    promptGuidelines: [
      "Use novel_advance_chapter_step for approved chapter drafting instead of composing a whole chapter in the host response or calling novel_apply_event with draft-chapter.",
      "Call the tool one stage at a time and reuse the returned run_id on every subsequent call for that chapter.",
      "Continue only while the returned execution status is active. Stop on blocked, paused, cancelled, stopped, completed, or any writer gate.",
      "Do not write manuscript, run artifacts, PROJECT.yaml, BOOK.yaml, STATUS.md, HANDOFF.md, or canonical story ledgers directly.",
    ],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String()),
      chapter: Type.Optional(Type.Integer({ minimum: 1 })),
      run_id: Type.Optional(Type.String({ minLength: 1 })),
      critics: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true })),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const root = requireProjectRoot(params.project_root || ctx.cwd);
        const criticJobTypes = parseSceneCriticSelection(params.critics?.join(","));
        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const { target, result } = await runStep({
          root,
          ...(params.chapter !== undefined ? { chapter: params.chapter } : {}),
          ...(params.run_id !== undefined ? { runId: params.run_id } : {}),
          criticJobTypes,
          worker,
          ...(signal ? { signal } : {}),
        });
        const text = renderChapterStepResult(target, result);
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
    description: "Advance one persisted scene or chapter execution stage without replaying completed work",
    async handler(args: string, context: ExtensionCommandContext): Promise<void> {
      try {
        const root = requireProjectRoot(context.cwd);
        const parsed = parseChapterStepOptions(args);
        const worker = options.createQualityWorker?.(root) ?? new PiPrintWorker({ cwd: root });
        const { target, result } = await runStep({
          root,
          ...(parsed.chapter !== undefined ? { chapter: parsed.chapter } : {}),
          ...(parsed.runId !== undefined ? { runId: parsed.runId } : {}),
          criticJobTypes: parsed.criticJobTypes,
          worker,
        });
        context.ui.notify(renderChapterStepResult(target, result), "info");
      } catch (error) {
        context.ui.notify(errorText(error), "warning");
      }
    },
  });
}
