import { Type, type Static } from "@sinclair/typebox";

export const ThrillerEvidenceEntrySchema = Type.Object({
  id: Type.RegExp(/^EVD-[0-9]{3}$/), artifact: Type.String({ minLength: 1 }), version: Type.String({ minLength: 1 }),
  exact_labels: Type.Array(Type.String({ minLength: 1 })), source: Type.String({ minLength: 1 }), access_restriction: Type.String({ minLength: 1 }),
  permitted_readers: Type.Array(Type.String({ minLength: 1 })), proves: Type.Array(Type.String({ minLength: 1 })), does_not_prove: Type.Array(Type.String({ minLength: 1 })),
  first_appearance: Type.Integer({ minimum: 1 }), supersedes: Type.Union([Type.RegExp(/^EVD-[0-9]{3}$/), Type.Null()]),
});
export const ThrillerEvidenceLedgerSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), entries: Type.Array(ThrillerEvidenceEntrySchema) });
export type ThrillerEvidenceEntry = Static<typeof ThrillerEvidenceEntrySchema>;
export type ThrillerEvidenceLedger = Static<typeof ThrillerEvidenceLedgerSchema>;

export const thrillerEvidenceTemplate = (): ThrillerEvidenceLedger => ({ schema_version: "1.0.0", entries: [] });

export function validateThrillerEvidenceLedger(ledger: ThrillerEvidenceLedger): string[] {
  const findings: string[] = [];
  const ids = new Set<string>();
  for (const entry of ledger.entries) {
    if (ids.has(entry.id)) findings.push(`Duplicate evidence id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.exact_labels.length) findings.push(`${entry.id} must record at least one exact label.`);
    if (!entry.does_not_prove.length) findings.push(`${entry.id} must state what the artifact does not prove.`);
  }
  return findings;
}
