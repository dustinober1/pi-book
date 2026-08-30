import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { thrillerEvidenceTemplate, validateThrillerEvidenceLedger, type ThrillerEvidenceLedger } from "../src/domain/thriller-evidence.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-thriller-evidence-")); }

function ledgerWith(entry: Partial<ThrillerEvidenceLedger["entries"][number]> = {}): ThrillerEvidenceLedger {
  const base = thrillerEvidenceTemplate();
  base.entries.push({
    id: "EVD-001", artifact: "court export", version: "v2", exact_labels: ["Exhibit 14-B"],
    source: "system", access_restriction: "sealed pending review", permitted_readers: ["Elena"],
    proves: ["the export exists"], does_not_prove: ["the export is authentic"],
    first_appearance: 2, supersedes: null,
    ...entry,
  });
  return base;
}

test("thriller evidence schemas use the Pi-compatible string pattern constructor", () => {
  const source = readFileSync(new URL("../src/domain/thriller-evidence.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Type\.RegExp/);
  assert.match(source, /Type\.String\(\{ pattern: "\^EVD-\[0-9\]\{3\}\$" \}\)/);
});

test("thriller evidence ledger requires provenance limits and stable ids", () => {
  const ledger = thrillerEvidenceTemplate();
  ledger.entries.push({ id: "EVD-001", artifact: "court export", version: "v2", exact_labels: [], source: "system", access_restriction: "sealed", permitted_readers: ["Elena"], proves: ["export exists"], does_not_prove: [], first_appearance: 2, supersedes: null });
  const findings = validateThrillerEvidenceLedger(ledger);
  assert.ok(findings.some((finding) => /exact label/.test(finding)));
  assert.ok(findings.some((finding) => /does not prove/.test(finding)));
});

// The ledger was created at project init, schema-registered, and documented in
// SKILL.md, but no event allowlist permitted writing it — an agent told to
// maintain this file could never actually update it. research-update is the
// state-neutral evidence event, matching how historical-context.yaml and
// invention-ledger.yaml already reach it for historical-fiction books.
test("a valid thriller-evidence.yaml applies through research-update", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Reaches", projectType: "standalone", profile: "thriller" });
    const result = applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/thriller-evidence.yaml", content: stringifyYaml(ledgerWith()) }],
    });
    assert.ok(result.changed.includes("books/book-01/thriller-evidence.yaml"));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an incomplete thriller-evidence.yaml is rejected, not silently accepted", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Rejects", projectType: "standalone", profile: "thriller" });
    const ledger = ledgerWith({ exact_labels: [], does_not_prove: [] });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/thriller-evidence.yaml", content: stringifyYaml(ledger) }],
    }), /Thriller evidence validation blocked research-update/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("thriller-evidence.yaml is not a valid research-update path for other profiles", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Evidence Scoped", projectType: "standalone", profile: "romantasy" });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "research-update", expectedStage: "voice-intake", expectedProjectHash: projectStateHash(root),
      files: [{ path: "books/book-01/thriller-evidence.yaml", content: stringifyYaml(ledgerWith()) }],
    }), /is not allowed for research-update/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
