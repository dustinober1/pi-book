import type { TSchema } from "@sinclair/typebox";
import { HistoricalContextSchema, InventionLedgerSchema } from "./historical-fiction.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^books\/book-[0-9]{2}\/historical-context\.yaml$/, HistoricalContextSchema],
  [/^books\/book-[0-9]{2}\/invention-ledger\.yaml$/, InventionLedgerSchema],
];

export function v15SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
