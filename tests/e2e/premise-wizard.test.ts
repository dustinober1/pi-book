import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPremiseWizardHandler, premiseWizardSnapshot } from "../../src/application/intake-wizard.js";
import { NovelEventRejection } from "../../src/application/event-rejection.js";
import { projectStateHash } from "../../src/application/project-hash.js";
import { createWizardRegistry } from "../../src/application/wizard.js";
import { defaultTasteProfile } from "../../src/domain/v1-3-schemas.js";
import { defaultPremiseLab, type PremiseVariant } from "../../src/domain/v1-4-schemas.js";
import { stringifyYaml } from "../../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../../src/project/store.js";

function variant(order: number): PremiseVariant {
  return {
    id: `PV-${String(order).padStart(3, "0")}`,
    order,
    title: `Variant ${order}`,
    premise: `Mara follows the signal through version ${order}.`,
    is_raw_idea_baseline: order === 1,
    preserved_seed_elements: ["Mara", "signal"],
    story_engine: `engine-${order}`,
    central_final_page_question: `What does Mara choose in version ${order}?`,
    immediate_gain: `Gain ${order}`,
    deferred_cost: `Cost ${order}`,
    irreversible_effect: `Effect ${order}`,
    differentiation: `Difference ${order}`,
    series_potential: `Potential ${order}`,
    accepted_tradeoffs: [`Tradeoff ${order}`],
    diagnostics: [`Observation ${order}`],
  };
}

function candidate() {
  const lab = defaultPremiseLab("book-01");
  lab.raw_idea = "Mara follows a signal no one else can hear.";
  lab.seed_elements = ["Mara", "signal"];
  lab.variants = [1, 2, 3].map(variant);
  return lab;
}

function setup() {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-premise-wizard-"));
  const root = initializeProject(parent, { projectName: "Premise Wizard", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "book-planning";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  const taste = defaultTasteProfile();
  taste.influences.push({ id: "INF-001", reference: "Private Author — Private Book", influence_type: "structure", admired_for: ["pressure"], not_for: ["copied plot"], derived_traits: ["causal escalation"], status: "approved" });
  writeFileSync(join(root, "series", "taste-profile.yaml"), stringifyYaml(taste), "utf8");
  return { parent, root };
}

function envelope(root: string, action: string, previewId: string) {
  return {
    proposal_id: `proposal-${action}`,
    workflow: "premise" as const,
    action,
    expected_stage: readProject(root).current_stage,
    expected_project_hash: projectStateHash(root),
    payload: { preview_id: previewId },
  };
}

test("premise snapshot excludes project root and private taste influences", () => {
  const { parent, root } = setup();
  try {
    const snapshot = premiseWizardSnapshot(root);
    const serialized = JSON.stringify(snapshot);
    assert.equal(snapshot.id, "premise");
    assert.match(serialized, /book-01/);
    assert.match(serialized, /selected_variant_id/);
    assert.equal(serialized.includes(root), false);
    assert.equal(serialized.includes("Private Author"), false);
    assert.equal(serialized.includes("INF-001"), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("comparison preview is opaque non-mutating and applies through premise-update", async () => {
  const { parent, root } = setup();
  try {
    const handler = createPremiseWizardHandler(root);
    const path = join(root, "books", "book-01", "premise-lab.yaml");
    const before = readFileSync(path, "utf8");
    const preview = handler.preview("comparison", { lab: candidate() }) as any;
    assert.match(preview.preview_id, /^premise-preview-/);
    assert.equal(preview.comparison.length, 3);
    assert.doesNotMatch(JSON.stringify(preview), /winner|rank|score|recommended/i);
    assert.equal(readFileSync(path, "utf8"), before);
    const result = await handler.apply(envelope(root, "save-comparison", preview.preview_id)) as any;
    assert.match(result.gitMessage, /premise-update/);
    assert.match(readFileSync(path, "utf8"), /PV-003/);
    await assert.rejects(() => handler.apply(envelope(root, "save-comparison", preview.preview_id)), /expired|unknown/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("selection preview appends an explicit writer decision and applies lab plus ledger atomically", async () => {
  const { parent, root } = setup();
  try {
    const handler = createPremiseWizardHandler(root);
    const comparison = handler.preview("comparison", { lab: candidate() }) as any;
    await handler.apply(envelope(root, "save-comparison", comparison.preview_id));
    const selection = handler.preview("selection", {
      variant_id: "PV-002",
      decided_at: "2026-07-16T12:00:00Z",
      evidence_refs: ["writer selected after comparison"],
    }) as any;
    assert.match(selection.preview_id, /^premise-preview-/);
    assert.equal(selection.decision.scope, "book-01");
    assert.equal(selection.decision.subject, "premise-selection");
    assert.equal(selection.decision.choice, "PV-002");
    const result = await handler.apply(envelope(root, "select-variant", selection.preview_id)) as any;
    assert.match(result.gitMessage, /premise-update/);
    assert.match(readFileSync(join(root, "books", "book-01", "premise-lab.yaml"), "utf8"), /selected_variant_id: PV-002/);
    assert.match(readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8"), /subject: premise-selection/);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("stale premise wizard proposals use structured rejection details", async () => {
  const { parent, root } = setup();
  try {
    const registry = createWizardRegistry(root, { premise: createPremiseWizardHandler(root) });
    const preview = registry.preview("premise", "comparison", { lab: candidate() }) as any;
    await assert.rejects(async () => registry.apply({
      ...envelope(root, "save-comparison", preview.preview_id),
      expected_project_hash: "stale",
    }), (error: unknown) => {
      assert.ok(error instanceof NovelEventRejection);
      assert.equal(error.detail.code, "stale-project-hash");
      return true;
    });
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
