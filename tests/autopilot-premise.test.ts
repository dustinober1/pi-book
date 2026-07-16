import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotDecision } from "../src/application/autopilot.js";
import { defaultPremiseLab } from "../src/domain/v1-4-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function variant(order: number) {
  return {
    id: `PV-${String(order).padStart(3, "0")}`,
    order,
    title: `Version ${order}`,
    premise: `Version ${order}`,
    is_raw_idea_baseline: order === 1,
    preserved_seed_elements: ["Mara", "signal"],
    story_engine: `engine-${order}`,
    central_final_page_question: `Question ${order}?`,
    immediate_gain: `Gain ${order}`,
    deferred_cost: `Cost ${order}`,
    irreversible_effect: `Effect ${order}`,
    differentiation: `Difference ${order}`,
    series_potential: `Potential ${order}`,
    accepted_tradeoffs: [],
    diagnostics: [],
  };
}

test("autopilot stops for explicit premise selection before book planning", () => {
  const parent = mkdtempSync(join(tmpdir(), "nf-autopilot-premise-"));
  try {
    const root = initializeProject(parent, { projectName: "Premise Stop", projectType: "standalone", profile: "thriller" });
    const project = readProject(root);
    project.current_stage = "book-planning";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    const lab = defaultPremiseLab("book-01");
    lab.raw_idea = "Mara follows a signal.";
    lab.seed_elements = ["Mara", "signal"];
    lab.variants = [variant(1), variant(2), variant(3)];
    writeFileSync(join(root, "books", "book-01", "premise-lab.yaml"), stringifyYaml(lab), "utf8");
    const decision = autopilotDecision(root, "book-plan-approval");
    assert.equal(decision.action, "premise-selection");
    assert.equal(decision.prompt, null);
    assert.match(decision.message, /premise|writer/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
