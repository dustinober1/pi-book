import type { StateLedger, StateRecord } from "../domain/state-ledger.js";
import { isEstablishedStoryRecordStatus } from "../domain/story-record-status.js";

function key(record: Pick<StateRecord, "subject_id" | "field">): string {
  return `${record.subject_id}\u0000${record.field}`;
}

export function establishedStateRecords(ledger: StateLedger): StateRecord[] {
  return ledger.records.filter((record) => isEstablishedStoryRecordStatus(record.status));
}

export function stateLedgerFindings(ledger: StateLedger): string[] {
  const findings: string[] = [];
  const ids = new Set<string>();
  const active = new Map<string, string>();
  for (const record of ledger.records) {
    if (ids.has(record.id)) findings.push(`Duplicate state record ID ${record.id}.`);
    ids.add(record.id);
    if (!record.subject_id.trim() || !record.field.trim()) findings.push(`State record ${record.id} has a blank subject or field.`);
    if (!isEstablishedStoryRecordStatus(record.status)) continue;
    const recordKey = key(record);
    const existing = active.get(recordKey);
    if (existing) {
      findings.push(`Multiple established state records exist for ${record.subject_id}.${record.field}: ${existing}, ${record.id}.`);
    } else {
      active.set(recordKey, record.id);
    }
  }
  return findings;
}

export function assertValidStateLedger(ledger: StateLedger): void {
  const findings = stateLedgerFindings(ledger);
  if (findings.length) {
    throw new Error(`State ledger validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
  }
}

export function stateValue(ledger: StateLedger, subjectId: string, field: string): unknown {
  assertValidStateLedger(ledger);
  return establishedStateRecords(ledger).find((record) => record.subject_id === subjectId && record.field === field)?.value;
}
