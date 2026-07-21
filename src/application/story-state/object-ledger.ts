import { ObjectLedgerSchema, type ObjectCustodyRecord, type ObjectLedger } from "../../domain/object-ledger.js";
import { isDraftingAuthorityStatus } from "../../domain/story-record-status.js";
import { assertSchema } from "../../domain/schemas.js";

export interface ObjectLedgerFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

export function objectLedgerFindings(ledger: ObjectLedger): ObjectLedgerFinding[] {
  const findings: ObjectLedgerFinding[] = [];
  const blocker = (code: string, message: string, ids: string[]) => findings.push({ severity: "blocker", code, message, record_ids: ids });
  try {
    assertSchema<ObjectLedger>(ObjectLedgerSchema, ledger, "Object ledger");
  } catch (error) {
    blocker("invalid-object-ledger", error instanceof Error ? error.message : String(error), []);
    return findings;
  }
  const byId = new Map<string, ObjectCustodyRecord[]>();
  const byObject = new Map<string, ObjectCustodyRecord[]>();
  for (const record of ledger.records) {
    byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
    if (isDraftingAuthorityStatus(record.status)) byObject.set(record.object_ref, [...(byObject.get(record.object_ref) ?? []), record]);
  }
  for (const [id, records] of byId) if (records.length > 1) blocker("duplicate-object-record-id", `Object custody record ID ${id} is duplicated.`, records.map((record) => record.id));
  for (const record of ledger.records) {
    if (record.supersedes && !byId.has(record.supersedes)) blocker("missing-superseded-object-state", `${record.id} supersedes missing object state ${record.supersedes}.`, [record.id, record.supersedes]);
    if (record.supersedes === record.id) blocker("self-superseding-object-state", `${record.id} cannot supersede itself.`, [record.id]);
  }
  for (const [objectRef, records] of byObject) {
    const maximum = Math.max(...records.map((record) => record.version));
    const newest = records.filter((record) => record.version === maximum);
    if (newest.length > 1) blocker("ambiguous-object-state", `Object ${objectRef} has multiple authoritative custody records at version ${maximum}.`, newest.map((record) => record.id));
  }
  return findings;
}

export function assertObjectLedgerValid(ledger: ObjectLedger): void {
  const blockers = objectLedgerFindings(ledger).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Object ledger is invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

export function effectiveObjectCustody(ledger: ObjectLedger): Map<string, ObjectCustodyRecord> {
  assertObjectLedgerValid(ledger);
  const effective = new Map<string, ObjectCustodyRecord>();
  for (const record of ledger.records.filter((item) => isDraftingAuthorityStatus(item.status))) {
    const current = effective.get(record.object_ref);
    if (!current || record.version > current.version || (record.version === current.version && record.status === "LOCKED_CANON")) effective.set(record.object_ref, record);
  }
  return effective;
}
