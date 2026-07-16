import type { TSchema } from "@sinclair/typebox";
import { DecisionLedgerSchema, IntakeSchema } from "./v1-4-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^series\/intake\.yaml$/, IntakeSchema],
  [/^series\/decision-ledger\.yaml$/, DecisionLedgerSchema],
];

export function v14SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
