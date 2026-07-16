import { join } from "node:path";
import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { premisePlanPrompt } from "./prompts.js";
import { beginPersistentRun, decideNextRun, type BeginPersistentRunOptions, type RunDecision } from "./run.js";

function premiseLab(root: string): PremiseLab | null {
  const book = readBook(root);
  const path = join(root, "books", book.book_id, "premise-lab.yaml");
  const text = readText(path);
  return text ? parseYaml<PremiseLab>(text, PremiseLabSchema, path) : null;
}

export function autopilotDecision(root: string, target: string): RunDecision {
  const project = readProject(root);
  const gate = project.next_gate;
  if (gate && project.gates[gate] === "pending") {
    if (gate === target) return { action: "target-reached", prompt: null, message: `Requested target ${target} is ready for writer approval.` };
    return { action: "human-gate", prompt: null, message: `Autopilot stopped for the writer decision at ${gate}.` };
  }
  if (gate && project.gates[gate] === "rejected") {
    return { action: "human-gate", prompt: null, message: `Autopilot stopped because ${gate} was rejected and requires writer-directed repair.` };
  }

  if (project.current_stage === "book-planning") {
    const lab = premiseLab(root);
    if (lab && lab.variants.length === 0) {
      return { action: "premise-plan", prompt: premisePlanPrompt(root), message: "Queued premise comparison before book architecture." };
    }
    if (lab && (!lab.selected_variant_id || !lab.selection_decision_id)) {
      return { action: "premise-selection", prompt: null, message: "Autopilot stopped so the writer can select a premise variant." };
    }
  }

  return decideNextRun(root, { until: target });
}

export function beginAutopilotRun(root: string, options: BeginPersistentRunOptions): RunDecision {
  const decision = autopilotDecision(root, options.target);
  if (!decision.prompt) return decision;
  return beginPersistentRun(root, options);
}
