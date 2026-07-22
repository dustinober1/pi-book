import { join } from "node:path";
import { ChapterQueueSchema, type ChapterQueueState } from "../domain/schemas.js";
import type { ChapterExecutionStepAction, AdvanceChapterExecutionStepResult } from "./chapter-execution-stepper.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { gateDetail } from "./gate-metadata.js";

export interface ResolveChapterStepTargetInput {
  chapter?: number;
  runId?: string;
}

export interface ChapterStepTarget {
  chapter: number;
  runId: string;
}

function readQueue(root: string, bookId: string): ChapterQueueState {
  const path = `books/${bookId}/chapter-queue.yaml`;
  const text = readText(join(root, path));
  if (text === null) throw new Error(`Chapter execution requires ${path}.`);
  return parseYaml<ChapterQueueState>(text, ChapterQueueSchema, path);
}

function defaultRunId(bookId: string, chapter: number): string {
  return `CHSTEP-${bookId}-${String(chapter).padStart(3, "0")}`;
}

function requireRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error("Chapter step run ID contains unsafe characters.");
}

export function resolveChapterStepTarget(root: string, input: ResolveChapterStepTargetInput = {}): ChapterStepTarget {
  const project = readProject(root);
  if (project.current_stage !== "drafting") {
    throw new Error(`Chapter execution requires the drafting stage; current stage is ${project.current_stage}.`);
  }
  if (project.next_gate) {
    const status = project.gates[project.next_gate];
    if (status === "pending" || status === "rejected") {
      throw new Error(`Writer approval or repair is required before chapter execution: ${gateDetail(project.next_gate).title}.`);
    }
  }

  const book = readBook(root);
  const ready = readQueue(root, book.book_id).packets
    .filter((packet) => packet.status === "ready")
    .sort((left, right) => left.chapter - right.chapter);
  const packet = input.chapter === undefined
    ? ready[0]
    : ready.find((candidate) => candidate.chapter === input.chapter);
  if (!packet) {
    throw new Error(input.chapter === undefined
      ? "No ready chapter packet is available for execution."
      : `Chapter ${input.chapter} does not have a ready packet.`);
  }

  const runId = input.runId ?? defaultRunId(book.book_id, packet.chapter);
  requireRunId(runId);
  return { chapter: packet.chapter, runId };
}

export function renderChapterStepResult(target: ChapterStepTarget, result: AdvanceChapterExecutionStepResult): string {
  const state = result.state;
  const action: ChapterExecutionStepAction = result.action;
  return [
    "Chapter execution advanced.",
    `Run: ${target.runId}`,
    `Chapter: ${target.chapter}`,
    `Action: ${action}`,
    `Checkpoint: ${state.current_node}`,
    `Scene: ${state.current_scene_id ?? "none"}`,
    `Status: ${state.status}`,
  ].join("\n");
}
