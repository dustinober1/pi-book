import { TimelineLedgerSchema, type TimelineLedger, type TimelineRecord } from "../../domain/timeline-ledger.js";
import { isDraftingAuthorityStatus } from "../../domain/story-record-status.js";
import { assertSchema } from "../../domain/schemas.js";

export interface TimelineFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

export function timelineFindings(ledger: TimelineLedger): TimelineFinding[] {
  const findings: TimelineFinding[] = [];
  const blocker = (code: string, message: string, ids: string[]) => findings.push({ severity: "blocker", code, message, record_ids: ids });
  try {
    assertSchema<TimelineLedger>(TimelineLedgerSchema, ledger, "Timeline ledger");
  } catch (error) {
    blocker("invalid-timeline-ledger", error instanceof Error ? error.message : String(error), []);
    return findings;
  }
  const byId = new Map<string, TimelineRecord[]>();
  const bySequence = new Map<number, TimelineRecord[]>();
  for (const record of ledger.records) {
    byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
    if (isDraftingAuthorityStatus(record.status)) bySequence.set(record.sequence, [...(bySequence.get(record.sequence) ?? []), record]);
  }
  for (const [id, records] of byId) if (records.length > 1) blocker("duplicate-timeline-record-id", `Timeline record ID ${id} is duplicated.`, records.map((record) => record.id));
  for (const [sequence, records] of bySequence) {
    const distinctEvents = [...new Set(records.map((record) => `${record.time_ref}:${record.description}`))];
    if (distinctEvents.length > 1) blocker("duplicate-timeline-sequence", `Timeline sequence ${sequence} contains multiple authoritative events.`, records.map((record) => record.id));
  }
  return findings;
}

export function assertTimelineValid(ledger: TimelineLedger): void {
  const blockers = timelineFindings(ledger).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Timeline ledger is invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

export function orderedTimeline(ledger: TimelineLedger): TimelineRecord[] {
  assertTimelineValid(ledger);
  return ledger.records
    .filter((record) => isDraftingAuthorityStatus(record.status))
    .slice()
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}
