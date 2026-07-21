import { Type, type Static } from "@sinclair/typebox";

export const STORY_RECORD_STATUSES = [
  "locked-canon",
  "accepted-manuscript-fact",
  "current-state",
  "required-future-event",
  "proposed-plan",
  "unresolved",
  "deprecated",
] as const;

export const StoryRecordStatusSchema = Type.Union(
  STORY_RECORD_STATUSES.map((value) => Type.Literal(value)),
);
export type StoryRecordStatus = Static<typeof StoryRecordStatusSchema>;

const ESTABLISHED_STATUSES = new Set<StoryRecordStatus>([
  "locked-canon",
  "accepted-manuscript-fact",
  "current-state",
]);

export function isStoryRecordStatus(value: unknown): value is StoryRecordStatus {
  return typeof value === "string" && (STORY_RECORD_STATUSES as readonly string[]).includes(value);
}

export function isEstablishedStoryRecordStatus(status: StoryRecordStatus): boolean {
  return ESTABLISHED_STATUSES.has(status);
}
