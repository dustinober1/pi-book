import type { TSchema } from "@sinclair/typebox";
import { ChapterContractSchema } from "./chapter-contract.js";
import { EntityRegistrySchema } from "./entity-registry.js";
import { HistoricalContextSchema, InventionLedgerSchema } from "./historical-fiction.js";
import { KnowledgeLedgerSchema } from "./knowledge-ledger.js";
import { ObjectLedgerSchema } from "./object-ledger.js";
import { StoryStateSchema } from "./story-state.js";
import { ThrillerEvidenceLedgerSchema } from "./thriller-evidence.js";
import { TimelineLedgerSchema } from "./timeline-ledger.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^books\/book-[0-9]{2}\/historical-context\.yaml$/, HistoricalContextSchema],
  [/^books\/book-[0-9]{2}\/invention-ledger\.yaml$/, InventionLedgerSchema],
  [/^books\/book-[0-9]{2}\/thriller-evidence\.yaml$/, ThrillerEvidenceLedgerSchema],
  [/^books\/book-[0-9]{2}\/contracts\/chapters\/CH-[0-9]{3}\.yaml$/, ChapterContractSchema],
  [/^series\/entity-registry\.yaml$/, EntityRegistrySchema],
  [/^series\/story-state\.yaml$/, StoryStateSchema],
  [/^series\/knowledge-ledger\.yaml$/, KnowledgeLedgerSchema],
  [/^series\/object-ledger\.yaml$/, ObjectLedgerSchema],
  [/^series\/timeline-ledger\.yaml$/, TimelineLedgerSchema],
];

export function v15SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
