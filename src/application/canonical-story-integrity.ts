import type { ChapterContract } from "../domain/chapter-contract.js";
import type { EntityRegistry } from "../domain/entity-registry.js";
import type { KnowledgeLedger } from "../domain/knowledge-ledger.js";
import type { CanonState, StoryThreadsState } from "../domain/schemas.js";
import type { StateLedger } from "../domain/state-ledger.js";
import { isEstablishedStoryRecordStatus } from "../domain/story-record-status.js";
import type { PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import type { ResearchLedger } from "../domain/v1-3-schemas.js";
import { entityRegistryFindings } from "./entity-registry.js";
import { knowledgeLedgerFindings } from "./knowledge-ledger.js";
import { stateLedgerFindings } from "./state-ledger.js";

export interface CanonicalStoryFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  record_ids: string[];
}

export interface CanonicalStoryInputs {
  entities: EntityRegistry;
  state: StateLedger;
  knowledge: KnowledgeLedger;
  canon: CanonState;
  threads: StoryThreadsState;
  research: ResearchLedger;
  plot: PlotGridPhase4;
  contracts?: Array<{ path: string; contract: ChapterContract }>;
}

function finding(severity: CanonicalStoryFinding["severity"], code: string, message: string, recordIds: string[] = []): CanonicalStoryFinding {
  return { severity, code, message, record_ids: recordIds };
}

function blocker(code: string, message: string, recordIds: string[] = []): CanonicalStoryFinding {
  return finding("blocker", code, message, recordIds);
}

function warning(code: string, message: string, recordIds: string[] = []): CanonicalStoryFinding {
  return finding("warning", code, message, recordIds);
}

function expectedContractPath(bookId: string, chapter: number): string {
  return `books/${bookId}/contracts/chapters/CH-${String(chapter).padStart(3, "0")}.yaml`;
}

function bookIdFromContractPath(path: string): string | null {
  return path.match(/^books\/(book-[0-9]{2})\/contracts\/chapters\/CH-[0-9]{3}\.yaml$/)?.[1] ?? null;
}

export function canonicalStoryFindings(input: CanonicalStoryInputs): CanonicalStoryFinding[] {
  const findings: CanonicalStoryFinding[] = [
    ...entityRegistryFindings(input.entities).map((message) => blocker("invalid-entity-registry", message)),
    ...stateLedgerFindings(input.state).map((message) => blocker("invalid-state-ledger", message)),
    ...knowledgeLedgerFindings(input.knowledge).map((message) => blocker("invalid-knowledge-ledger", message)),
  ];

  const entityIds = new Set(input.entities.entities.map((item) => item.id));
  const stateIds = new Set(input.state.records.map((item) => item.id));
  const establishedStateIds = new Set(input.state.records
    .filter((item) => isEstablishedStoryRecordStatus(item.status))
    .map((item) => item.id));
  const knowledgeIds = new Set(input.knowledge.records.map((item) => item.id));
  const canonIds = new Set([
    ...input.canon.facts.map((item) => item.id),
    ...input.canon.relationships.map((item) => item.id),
  ]);
  const threadIds = new Set(input.threads.threads.map((item) => item.id));
  const researchIds = new Set(input.research.items.map((item) => item.id));
  const plotIds = new Set(input.plot.chapters.map((item) => `PLOT-CH-${String(item.chapter).padStart(3, "0")}`));
  const knownRecordIds = new Set([
    ...entityIds,
    ...stateIds,
    ...knowledgeIds,
    ...canonIds,
    ...threadIds,
    ...researchIds,
    ...plotIds,
  ]);

  for (const record of input.state.records) {
    if (!entityIds.has(record.subject_id)) {
      findings.push(blocker("unknown-state-subject", `State record ${record.id} references missing entity ${record.subject_id}.`, [record.id, record.subject_id]));
    }
  }

  for (const record of input.knowledge.records) {
    if (record.knower_id !== "READER" && !entityIds.has(record.knower_id)) {
      findings.push(blocker("unknown-knowledge-knower", `Knowledge record ${record.id} references missing knower ${record.knower_id}.`, [record.id, record.knower_id]));
    }
    const knownFact = canonIds.has(record.fact_id)
      || input.entities.entities.some((item) => item.id === record.fact_id && ["secret", "claim", "event"].includes(item.category));
    if (!knownFact) {
      findings.push(warning("unregistered-knowledge-fact", `Knowledge record ${record.id} uses fact ID ${record.fact_id}, which is not yet registered as canon or an entity.`, [record.id, record.fact_id]));
    }
  }

  for (const item of input.contracts ?? []) {
    const contract = item.contract;
    const bookId = bookIdFromContractPath(item.path);
    if (!bookId) {
      findings.push(blocker("invalid-contract-path", `Chapter contract path ${item.path} is not canonical.`, [contract.contract_id]));
      continue;
    }
    const expectedPath = expectedContractPath(bookId, contract.chapter);
    if (item.path !== expectedPath) {
      findings.push(blocker("contract-path-mismatch", `Chapter contract ${contract.contract_id} must be stored at ${expectedPath}.`, [contract.contract_id]));
    }
    const expectedId = `CH-${String(contract.chapter).padStart(3, "0")}`;
    if (contract.contract_id !== expectedId) {
      findings.push(blocker("contract-id-mismatch", `Chapter contract ID ${contract.contract_id} does not match Chapter ${contract.chapter}.`, [contract.contract_id]));
    }
    if (contract.small_model_ready && contract.missing_small_model_fields.length > 0) {
      findings.push(blocker("contradictory-small-model-readiness", `Chapter contract ${contract.contract_id} is marked ready but still lists missing fields.`, [contract.contract_id]));
    }

    const enforceExecutableReferences = contract.source_kind === "approved-contract" || contract.small_model_ready;
    if (contract.source_kind === "approved-contract" && contract.required_record_ids.length === 0) {
      findings.push(blocker("missing-required-records", `Approved chapter contract ${contract.contract_id} must declare required record IDs.`, [contract.contract_id]));
    }
    if (!enforceExecutableReferences) continue;

    for (const id of contract.required_record_ids) {
      if (!knownRecordIds.has(id)) findings.push(blocker("missing-required-record", `Chapter contract ${contract.contract_id} references missing required record ${id}.`, [contract.contract_id, id]));
    }
    for (const id of contract.active_thread_ids) {
      if (!threadIds.has(id)) findings.push(blocker("missing-active-thread", `Chapter contract ${contract.contract_id} references missing active thread ${id}.`, [contract.contract_id, id]));
    }
    for (const id of contract.start_state_ids) {
      if (!establishedStateIds.has(id)) findings.push(blocker("missing-start-state", `Chapter contract ${contract.contract_id} requires established start state ${id}.`, [contract.contract_id, id]));
    }
    for (const mutation of contract.required_end_state) {
      if (!stateIds.has(mutation.record_id)) findings.push(blocker("missing-end-state-record", `Chapter contract ${contract.contract_id} mutates missing state record ${mutation.record_id}.`, [contract.contract_id, mutation.record_id]));
    }
    for (const id of contract.knowledge_boundary_ids) {
      const record = input.knowledge.records.find((candidate) => candidate.id === id);
      if (!record) {
        findings.push(blocker("missing-knowledge-boundary", `Chapter contract ${contract.contract_id} references missing knowledge boundary ${id}.`, [contract.contract_id, id]));
      } else if (record.knower_id !== contract.pov && record.knower_id !== "READER") {
        findings.push(blocker("knowledge-boundary-pov-mismatch", `Knowledge boundary ${id} applies to ${record.knower_id}, not chapter POV ${contract.pov}.`, [contract.contract_id, id, record.knower_id]));
      }
    }
  }

  return findings;
}

export function assertCanonicalStoryIntegrity(input: CanonicalStoryInputs): void {
  const blockers = canonicalStoryFindings(input).filter((item) => item.severity === "blocker");
  if (blockers.length) {
    throw new Error(`Canonical story integrity validation failed:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
}
