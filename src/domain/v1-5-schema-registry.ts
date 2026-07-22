import type { TSchema } from "@sinclair/typebox";
import { ChapterContractSchema } from "./chapter-contract.js";
import { ChapterDeltaSummarySchema } from "./chapter-delta-summary.js";
import { EntityRegistrySchema } from "./entity-registry.js";
import { HistoricalContextSchema, InventionLedgerSchema } from "./historical-fiction.js";
import { KnowledgeLedgerSchema } from "./knowledge-ledger.js";
import { ApprovedPlanChangeRecordSchema } from "./plan-change-request.js";
import { StateLedgerSchema } from "./state-ledger.js";
import { ThrillerEvidenceLedgerSchema } from "./thriller-evidence.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^books\/book-[0-9]{2}\/historical-context\.yaml$/, HistoricalContextSchema],
  [/^books\/book-[0-9]{2}\/invention-ledger\.yaml$/, InventionLedgerSchema],
  [/^books\/book-[0-9]{2}\/thriller-evidence\.yaml$/, ThrillerEvidenceLedgerSchema],
  [/^books\/book-[0-9]{2}\/contracts\/chapters\/CH-[0-9]{3}\.yaml$/, ChapterContractSchema],
  [/^books\/book-[0-9]{2}\/deltas\/CH-[0-9]{3}\.yaml$/, ChapterDeltaSummarySchema],
  [/^books\/book-[0-9]{2}\/plan-changes\/PC-[0-9]{3}\.yaml$/, ApprovedPlanChangeRecordSchema],
  [/^series\/entity-registry\.yaml$/, EntityRegistrySchema],
  [/^series\/state-ledger\.yaml$/, StateLedgerSchema],
  [/^series\/knowledge-ledger\.yaml$/, KnowledgeLedgerSchema],
];

export function v15SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
