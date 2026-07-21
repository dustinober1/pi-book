import { Type, type Static } from "@sinclair/typebox";

export const STORY_RECORD_STATUSES = [
  "LOCKED_CANON",
  "ACCEPTED_MANUSCRIPT_FACT",
  "CURRENT_STATE",
  "REQUIRED_FUTURE_EVENT",
  "PROPOSED_PLAN",
  "UNRESOLVED",
  "DEPRECATED",
] as const;

export const StoryRecordStatusSchema = Type.Union(
  STORY_RECORD_STATUSES.map((value) => Type.Literal(value)),
);
export type StoryRecordStatus = Static<typeof StoryRecordStatusSchema>;

const DRAFTING_STATUSES: ReadonlySet<StoryRecordStatus> = new Set([
  "LOCKED_CANON",
  "ACCEPTED_MANUSCRIPT_FACT",
  "CURRENT_STATE",
]);

export function isDraftingAuthorityStatus(status: StoryRecordStatus): boolean {
  return DRAFTING_STATUSES.has(status);
}
