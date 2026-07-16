from pathlib import Path

root = Path('.')
path = root / 'src/domain/v1-4-schemas.ts'
text = path.read_text(encoding='utf-8')
export_line = '\nexport { PremiseLabSchema, PremiseVariantSchema, defaultPremiseLab, type PremiseLab, type PremiseVariant } from "./v1-4-premise-schemas.js";\n'
if 'v1-4-premise-schemas.js' not in text:
    path.write_text(text.rstrip() + export_line, encoding='utf-8')

path = root / 'src/domain/v1-4-schema-registry.ts'
path.write_text('''import type { TSchema } from "@sinclair/typebox";
import { DecisionLedgerSchema, IntakeSchema } from "./v1-4-schemas.js";
import { PremiseLabSchema } from "./v1-4-premise-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/^series\\/intake\\.yaml$/, IntakeSchema],
  [/^series\\/decision-ledger\\.yaml$/, DecisionLedgerSchema],
  [/^books\\/book-[0-9]{2}\\/premise-lab\\.yaml$/, PremiseLabSchema],
];

export function v14SchemaForPath(path: string): TSchema | null {
  const normalized = path.replace(/\\\\/g, "/").replace(/^\\.\\//, "");
  return registry.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}
''', encoding='utf-8')
