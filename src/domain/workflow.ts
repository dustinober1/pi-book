import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkflowSchema, type Stage, type WorkflowDefinition } from "./schemas.js";
import { parseYaml } from "../infrastructure/yaml.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW_PATH = join(PACKAGE_ROOT, "references", "pipeline", "novel-workflow.yaml");
let cached: WorkflowDefinition | null = null;

export function loadWorkflow(path = WORKFLOW_PATH): WorkflowDefinition {
  if (path === WORKFLOW_PATH && cached) return cached;
  const text = readFileSync(path, "utf8");
  const workflow = parseYaml<WorkflowDefinition>(text, WorkflowSchema, "novel-workflow.yaml");
  if (path === WORKFLOW_PATH) cached = workflow;
  return workflow;
}
export function nextStageAfterGate(gate: string): Stage {
  const next = loadWorkflow().gate_transitions[gate];
  if (!next) throw new Error(`Gate ${gate} has no transition in novel-workflow.yaml.`);
  return next;
}
export function gateOwnerStage(gate: string): Stage {
  const owner = loadWorkflow().gate_owners[gate];
  if (!owner) throw new Error(`Gate ${gate} has no owner in novel-workflow.yaml.`);
  return owner;
}
export function stageDefinition(stage: Stage) {
  const definition = loadWorkflow().stages.find((item) => item.id === stage);
  if (!definition) throw new Error(`Stage ${stage} is missing from novel-workflow.yaml.`);
  return definition;
}
