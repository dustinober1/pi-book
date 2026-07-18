import test from "node:test";
import assert from "node:assert/strict";
import { thrillerEvidenceTemplate, validateThrillerEvidenceLedger } from "../src/domain/thriller-evidence.js";

test("thriller evidence ledger requires provenance limits and stable ids", () => {
  const ledger = thrillerEvidenceTemplate();
  ledger.entries.push({ id: "EVD-001", artifact: "court export", version: "v2", exact_labels: [], source: "system", access_restriction: "sealed", permitted_readers: ["Elena"], proves: ["export exists"], does_not_prove: [], first_appearance: 2, supersedes: null });
  const findings = validateThrillerEvidenceLedger(ledger);
  assert.ok(findings.some((finding) => /exact label/.test(finding)));
  assert.ok(findings.some((finding) => /does not prove/.test(finding)));
});
