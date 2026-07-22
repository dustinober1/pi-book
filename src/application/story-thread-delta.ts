import { Value } from "@sinclair/typebox/value";
import type { SceneThreadDelta } from "../domain/scene-state-delta-artifact.js";
import {
  StoryThreadsV2Schema,
  normalizeStoryThreads,
  type CompatibleStoryThreadsState,
  type StoryThreadsV2State,
} from "../domain/story-thread-v2.js";

export interface ApplyAcceptedThreadChangesContext {
  bookId: string;
  chapter: number;
}

export function applyAcceptedThreadChanges(
  threads: CompatibleStoryThreadsState,
  changes: readonly SceneThreadDelta[],
  context: ApplyAcceptedThreadChangesContext,
): StoryThreadsV2State {
  if (!Number.isInteger(context.chapter) || context.chapter < 1) throw new Error("Story-thread changes require a positive chapter number.");
  const result = normalizeStoryThreads(threads);
  const byId = new Map(result.threads.map((thread) => [thread.id, thread]));
  const chapterRef = `${context.bookId}/chapter-${String(context.chapter).padStart(3, "0")}`;

  for (const change of changes) {
    const thread = byId.get(change.thread_id);
    if (!thread) throw new Error(`Accepted chapter thread change references unknown story thread ${change.thread_id}.`);
    if (thread.status === "paid-off" || thread.status === "abandoned") {
      throw new Error(`Story thread ${thread.id} is ${thread.status} and cannot ${change.operation}.`);
    }
    if (change.operation === "opened") {
      thread.status = "open";
      thread.opened_in ??= context.chapter;
    } else if (change.operation === "advanced") {
      thread.status = "advanced";
      thread.opened_in ??= context.chapter;
    } else {
      thread.status = "paid-off";
      thread.opened_in ??= context.chapter;
    }
    thread.last_touched_in = context.chapter;
    thread.last_advanced_in = chapterRef;
    thread.next_required_touch = null;
  }

  if (!Value.Check(StoryThreadsV2Schema, result)) throw new Error("Accepted story-thread changes produced an invalid story-thread ledger.");
  return result;
}
