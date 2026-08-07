import { join } from "node:path";
import { ChapterContractSchema, chapterContractPath, type ChapterContract } from "../domain/chapter-contract.js";
import type { ChapterExecutionState } from "../domain/chapter-execution-state.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readProject } from "../project/store.js";
import {
  advanceChapterExecutionStep,
  type AdvanceChapterExecutionStepInput,
  type ChapterExecutionStepAction,
} from "./chapter-execution-stepper.js";
import { gateDetail } from "./gate-metadata.js";

/**
 * Drive the chapter execution state machine.
 *
 * `advanceChapterExecutionStep` advances exactly one node, and for two releases
 * its only non-test callers were the tool and the command, both of which return
 * after a single step. A chapter is roughly a dozen nodes per scene; a novel is
 * on the order of two thousand host-driven tool calls, each one requiring the
 * host model to read a checkpoint and correctly decide to continue. That is the
 * judgement load the scene machine exists to remove, reintroduced at the outer
 * loop — and it is the reason the automated path drafted whole chapters through
 * the quality orchestrator instead of using the scene machine at all.
 *
 * This loop adds no authority. It stops exactly where a single step stops, and
 * acceptance still ends in the same guarded commit at `chapter-commit`. What it
 * removes is the requirement that a model decide, a thousand times, to do the
 * obvious thing.
 */

export type ChapterExecutionStopReason =
  | "complete"
  | "blocked"
  | "paused"
  | "failed"
  | "awaiting-critic-selection"
  | "aborted"
  | "step-ceiling";

export interface RunChapterExecutionInput extends AdvanceChapterExecutionStepInput {
  /**
   * Backstop independent of every semantic stop below. A run that somehow fails
   * to progress terminates here rather than spinning; reaching it is a defect,
   * so the reason is reported rather than swallowed.
   */
  maximumSteps?: number;
  onStep?: (result: { action: ChapterExecutionStepAction; state: ChapterExecutionState }) => void;
}

export interface ChapterExecutionRunResult {
  state: ChapterExecutionState;
  actions: ChapterExecutionStepAction[];
  steps: number;
  stopReason: ChapterExecutionStopReason;
  committed: boolean;
}

/**
 * Generous by design: a long chapter with several scenes and a full repair
 * allowance legitimately visits many nodes, and the real stops are semantic.
 * This only exists so a defect cannot become an unbounded loop.
 */
const DEFAULT_MAXIMUM_STEPS = 400;

function stopReasonFor(state: ChapterExecutionState, action: ChapterExecutionStepAction): ChapterExecutionStopReason | null {
  // `awaiting-critic-review` is returned WITHOUT advancing when no critics were
  // requested, so a loop that treated it as progress would spin on it forever.
  if (action === "awaiting-critic-review") return "awaiting-critic-selection";
  if (state.status === "completed" || action === "complete") return "complete";
  if (state.status === "blocked") return "blocked";
  if (state.status === "paused") return "paused";
  if (state.status === "failed") return "failed";
  if (action === "stopped") return "blocked";
  return null;
}

/**
 * Whether a chapter can take the guarded scene path at all.
 *
 * Read-only and non-throwing: callers use it to choose between guarded scene
 * execution and the whole-chapter orchestrator, and a missing or incomplete
 * contract is an ordinary routing answer rather than an error. The reason is
 * returned so the caller can tell the writer which path ran and why — the
 * silent fallback to unguarded drafting is exactly what v2.0.0 set out to stop.
 */
export function chapterExecutionReadiness(root: string, bookId: string, chapter: number): { ready: boolean; reason: string } {
  const path = chapterContractPath(bookId, chapter);
  const text = readText(join(root, path));
  if (text === null) return { ready: false, reason: `no executable chapter contract exists at ${path}` };
  let contract: ChapterContract;
  try { contract = parseYaml<ChapterContract>(text, ChapterContractSchema, path); }
  catch { return { ready: false, reason: `the chapter contract at ${path} could not be read` }; }
  if (!contract.small_model_ready) {
    return { ready: false, reason: `the contract at ${path} is not small-model ready (${contract.missing_small_model_fields.join(", ") || "missing executable fields"})` };
  }
  return { ready: true, reason: `executable contract ${contract.contract_id}` };
}

/**
 * The gate check lives in `resolveChapterStepTarget`, which the tool and command
 * call — but a driver loop is exactly the caller that must not be able to cross
 * a writer gate, and it can be invoked with an explicit chapter and run ID that
 * skips target resolution entirely. Re-assert it here so the guarantee belongs
 * to the loop rather than to whoever remembered to resolve a target first.
 */
function assertNoActiveWriterGate(root: string): void {
  const project = readProject(root);
  const gate = project.next_gate;
  if (!gate) return;
  const status = project.gates[gate];
  if (status === "pending" || status === "rejected") {
    throw new Error(`Writer approval or repair is required before chapter execution: ${gateDetail(gate).title}.`);
  }
}

export async function runChapterExecution(input: RunChapterExecutionInput): Promise<ChapterExecutionRunResult> {
  const maximumSteps = input.maximumSteps ?? DEFAULT_MAXIMUM_STEPS;
  if (!Number.isInteger(maximumSteps) || maximumSteps < 1) throw new Error("Chapter execution step ceiling must be a positive integer.");
  // A driver loop must never be handed an empty critic selection: that is the
  // one input that makes the machine return without advancing.
  if (input.requiredCriticJobTypes !== undefined && input.requiredCriticJobTypes.length === 0) {
    throw new Error("Chapter execution requires at least one scene critic; an empty selection cannot advance critic-review.");
  }

  if (input.signal?.aborted) throw new Error("Chapter execution was aborted before its first step.");
  assertNoActiveWriterGate(input.root);

  const actions: ChapterExecutionStepAction[] = [];
  let state: ChapterExecutionState | undefined;
  let committed = false;

  for (let step = 0; step < maximumSteps; step += 1) {
    const result = await advanceChapterExecutionStep(input);
    state = result.state;
    actions.push(result.action);
    if (result.action === "chapter-committed") committed = true;
    input.onStep?.({ action: result.action, state: result.state });

    const stopReason = stopReasonFor(result.state, result.action);
    if (stopReason) return { state: result.state, actions, steps: actions.length, stopReason, committed };
    // Checked after a completed step so an abort never discards persisted work:
    // every node writes its state before returning, so the run resumes here.
    if (input.signal?.aborted) return { state: result.state, actions, steps: actions.length, stopReason: "aborted", committed };
  }

  if (!state) throw new Error("Chapter execution produced no step.");
  return { state, actions, steps: actions.length, stopReason: "step-ceiling", committed };
}
