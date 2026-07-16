import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { SourceRegisterSchema, type SourceRegisterState } from "../src/domain/schemas.js";
import { ResearchLedgerSchema, defaultResearchLedger, type ResearchLedger } from "../src/domain/v1-3-schemas.js";
import { researchEvidenceFindings } from "../src/application/research-evidence.js";

function readyLedger(sourceIds: string[] = ["SRC-001"]): ResearchLedger {
  const ledger = defaultResearchLedger();
  ledger.items.push({
    id: "RES-001",
    lane: "story-world",
    claim: "The control room uses a two-person release procedure.",
    source_ids: sourceIds,
    confidence: "high",
    verified_on: "2026-07-15",
    fictionalization: { status: "simplified", reason: "Compress jurisdiction-specific detail." },
    knowledge_scope: { known_by: ["protagonist"], incorrectly_believed_by: [], unknown_to: ["antagonist"] },
    risk: ["procedure varies by jurisdiction"],
    dramatic_uses: ["procedural-constraint"],
    story_use: { chapters: [4], decision_affected: "The protagonist must recruit a second operator." },
    notes: "",
    status: "ready",
  });
  return ledger;
}

function sources(values: SourceRegisterState["sources"]): SourceRegisterState {
  return { schema_version: "1.0.0", sources: values };
}

test("all four research lanes remain valid typed evidence", () => {
  const lanes = ["taste-and-voice", "story-world", "human-authenticity", "reader-and-market"] as const;
  for (const [index, lane] of lanes.entries()) {
    const ledger = defaultResearchLedger();
    ledger.items.push({
      id: `RES-${String(index + 1).padStart(3, "0")}`,
      lane,
      claim: "",
      source_ids: [],
      confidence: "low",
      verified_on: null,
      fictionalization: { status: "unchanged", reason: "" },
      knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
      risk: [],
      dramatic_uses: [],
      story_use: { chapters: [], decision_affected: "" },
      notes: "",
      status: "researching",
    });
    parseYaml(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger.yaml");
  }
});

test("ready research is blocked when its supporting source is missing", () => {
  const findings = researchEvidenceFindings(readyLedger(), sources([]));
  assert.ok(findings.some((item) => item.code === "missing-source" && item.severity === "blocker"));
});

test("ready research requires source reliability, observation date, and explicit support linkage", () => {
  const findings = researchEvidenceFindings(readyLedger(), sources([{
    id: "SRC-001", type: "book", title: "Operations Manual", location: "local", verified_on: "2026-07-15", supports: [], notes: "",
  }]));
  assert.ok(findings.some((item) => item.code === "missing-source-reliability"));
  assert.ok(findings.some((item) => item.code === "source-support-mismatch"));
});

test("provenance-complete ready research passes evidence validation", () => {
  const register = sources([{
    id: "SRC-001", type: "primary-document", title: "Operations Manual", location: "local", verified_on: "2026-07-15", supports: [], notes: "",
    reliability: "primary", observed_on: "2026-07-15", supports_research_ids: ["RES-001"],
  } as SourceRegisterState["sources"][number]]);
  assert.deepEqual(researchEvidenceFindings(readyLedger(), register).filter((item) => item.severity === "blocker"), []);
});

test("legacy source-register records remain schema-readable", () => {
  const legacy = sources([{
    id: "SRC-001", type: "book", title: "Legacy", location: "local", verified_on: null, supports: [], notes: "",
  }]);
  parseYaml(stringifyYaml(legacy), SourceRegisterSchema, "source-register.yaml");
});
