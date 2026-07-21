import { StoryStateSchema, type StoryState, type StoryStateRecord } from "../../domain/story-state.js";
import { isDraftingAuthorityStatus } from "../../domain/story-record-status.js";
import { assertSchema } from "../../domain/schemas.js";

export interface StoryStateFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

function key(record: Pick<StoryStateRecord, "subject_ref" | "field">): string {
  return `${record.subject_ref}:${record.field}`;
}

export function storyStateFindings(state: StoryState): StoryStateFinding[] {
  const findings: StoryStateFinding[] = [];
  const blocker = (code: string, message: string, ids: string[]) => findings.push({ severity: "blocker", code, message, record_ids: ids });
  try {
    assertSchema<StoryState>(StoryStateSchema, state, "Story state");
  } catch (error) {
    blocker("invalid-story-state", error instanceof Error ? error.message : String(error), []);
    return findings;
  }
  const byId = new Map<string, StoryStateRecord[]>();
  const currentByKey = new Map<string, StoryStateRecord[]>();
  for (const record of state.records) {
    byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
    if (record.status === "CURRENT_STATE") currentByKey.set(key(record), [...(currentByKey.get(key(record)) ?? []), record]);
  }
  for (const [id, records] of byId) if (records.length > 1) blocker("duplicate-story-state-id", `Story state ID ${id} is duplicated.`, records.map((record) => record.id));
  for (const [stateKey, records] of currentByKey) {
    const maximumVersion = Math.max(...records.map((record) => record.version));
    const newest = records.filter((record) => record.version === maximumVersion);
    if (newest.length > 1) blocker("ambiguous-current-state", `Current state ${stateKey} has multiple records at version ${maximumVersion}.`, newest.map((record) => record.id));
  }
  for (const record of state.records) {
    if (record.supersedes && !byId.has(record.supersedes)) blocker("missing-superseded-state", `${record.id} supersedes missing state ${record.supersedes}.`, [record.id, record.supersedes]);
    if (record.supersedes === record.id) blocker("self-superseding-state", `${record.id} cannot supersede itself.`, [record.id]);
  }
  return findings;
}

export function assertStoryStateValid(state: StoryState): void {
  const blockers = storyStateFindings(state).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Story state is invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

export function effectiveStoryState(state: StoryState): Map<string, StoryStateRecord> {
  assertStoryStateValid(state);
  const effective = new Map<string, StoryStateRecord>();
  const eligible = state.records.filter((record) => isDraftingAuthorityStatus(record.status));
  for (const record of eligible) {
    const recordKey = key(record);
    const current = effective.get(recordKey);
    if (!current || record.version > current.version || (record.version === current.version && record.status === "LOCKED_CANON")) {
      effective.set(recordKey, record);
    }
  }
  return effective;
}
