import type { KnowledgeLedger, KnowledgeRecord } from "../domain/knowledge-ledger.js";
import { isEstablishedStoryRecordStatus } from "../domain/story-record-status.js";

function available(record: KnowledgeRecord): boolean {
  return isEstablishedStoryRecordStatus(record.status) && record.knowledge !== "unknown";
}

export function knowledgeLedgerFindings(ledger: KnowledgeLedger): string[] {
  const findings: string[] = [];
  const ids = new Set<string>();
  const established = new Map<string, string>();
  for (const record of ledger.records) {
    if (ids.has(record.id)) findings.push(`Duplicate knowledge record ID ${record.id}.`);
    ids.add(record.id);
    if (!available(record)) continue;
    const key = `${record.knower_id}\u0000${record.fact_id}`;
    const existing = established.get(key);
    if (existing) findings.push(`Multiple established knowledge records exist for ${record.knower_id} and ${record.fact_id}: ${existing}, ${record.id}.`);
    else established.set(key, record.id);
  }
  return findings;
}

export function assertValidKnowledgeLedger(ledger: KnowledgeLedger): void {
  const findings = knowledgeLedgerFindings(ledger);
  if (findings.length) {
    throw new Error(`Knowledge ledger validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
  }
}

export function establishedKnowledgeRecords(ledger: KnowledgeLedger, knowerId?: string): KnowledgeRecord[] {
  assertValidKnowledgeLedger(ledger);
  return ledger.records.filter((record) => available(record) && (knowerId === undefined || record.knower_id === knowerId));
}

export function hasEstablishedKnowledge(ledger: KnowledgeLedger, knowerId: string, factId: string): boolean {
  return establishedKnowledgeRecords(ledger, knowerId).some((record) => record.fact_id === factId);
}

export function assertKnowledgeAvailable(ledger: KnowledgeLedger, knowerId: string, factId: string): void {
  if (!hasEstablishedKnowledge(ledger, knowerId, factId)) {
    throw new Error(`${knowerId} does not have established knowledge of ${factId}.`);
  }
}
