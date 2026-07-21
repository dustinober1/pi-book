import { KnowledgeLedgerSchema, type KnowledgeLedger, type KnowledgeRecord } from "../../domain/knowledge-ledger.js";
import { isDraftingAuthorityStatus } from "../../domain/story-record-status.js";
import { assertSchema } from "../../domain/schemas.js";

export interface KnowledgeLedgerFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

function key(record: Pick<KnowledgeRecord, "character_ref" | "fact_ref">): string {
  return `${record.character_ref}:${record.fact_ref}`;
}

export function knowledgeLedgerFindings(ledger: KnowledgeLedger): KnowledgeLedgerFinding[] {
  const findings: KnowledgeLedgerFinding[] = [];
  const blocker = (code: string, message: string, recordIds: string[]) => findings.push({
    severity: "blocker",
    code,
    message,
    record_ids: recordIds,
  });
  try {
    assertSchema<KnowledgeLedger>(KnowledgeLedgerSchema, ledger, "Knowledge ledger");
  } catch (error) {
    blocker("invalid-knowledge-ledger", error instanceof Error ? error.message : String(error), []);
    return findings;
  }
  const byId = new Map<string, KnowledgeRecord[]>();
  const authoritative = new Map<string, KnowledgeRecord[]>();
  for (const record of ledger.records) {
    byId.set(record.id, [...(byId.get(record.id) ?? []), record]);
    if (isDraftingAuthorityStatus(record.status)) authoritative.set(key(record), [...(authoritative.get(key(record)) ?? []), record]);
  }
  for (const [id, records] of byId) if (records.length > 1) blocker("duplicate-knowledge-record-id", `Knowledge record ID ${id} is duplicated.`, records.map((record) => record.id));
  for (const record of ledger.records) {
    if (record.supersedes && !byId.has(record.supersedes)) blocker("missing-superseded-knowledge", `${record.id} supersedes missing knowledge record ${record.supersedes}.`, [record.id, record.supersedes]);
    if (record.supersedes === record.id) blocker("self-superseding-knowledge", `${record.id} cannot supersede itself.`, [record.id]);
  }
  for (const [knowledgeKey, records] of authoritative) {
    const maximum = Math.max(...records.map((record) => record.version));
    const newest = records.filter((record) => record.version === maximum);
    if (newest.length > 1) blocker("ambiguous-character-knowledge", `Knowledge ${knowledgeKey} has multiple authoritative records at version ${maximum}.`, newest.map((record) => record.id));
  }
  return findings;
}

export function assertKnowledgeLedgerValid(ledger: KnowledgeLedger): void {
  const blockers = knowledgeLedgerFindings(ledger).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Knowledge ledger is invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

export function effectiveKnowledge(ledger: KnowledgeLedger): Map<string, KnowledgeRecord> {
  assertKnowledgeLedgerValid(ledger);
  const effective = new Map<string, KnowledgeRecord>();
  for (const record of ledger.records.filter((item) => isDraftingAuthorityStatus(item.status))) {
    const recordKey = key(record);
    const current = effective.get(recordKey);
    if (!current || record.version > current.version || (record.version === current.version && record.status === "LOCKED_CANON")) effective.set(recordKey, record);
  }
  return effective;
}
