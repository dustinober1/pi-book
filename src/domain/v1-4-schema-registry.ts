import type { TSchema } from "@sinclair/typebox";
import { DecisionLedgerSchema, IntakeSchema } from "./v1-4-schemas.js";
import { PremiseLabSchema } from "./v1-4-premise-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^series\/intake\.yaml$/, IntakeSchema],
  [/^series\/decision-ledger\.yaml$/, DecisionLedgerSchema],
  [/^books\/book-[0-9]{2}\/premise-lab\.yaml$/, PremiseLabSchema],
];

export function v14SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
