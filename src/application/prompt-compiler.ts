import type { RuntimeProfile, RuntimeProfileId } from "../domain/runtime-profile.js";
import type { StageSpec } from "./stage-specs/types.js";

export type PromptSectionName = "ROLE" | "OBJECTIVE" | "INPUTS" | "MUST" | "NEVER" | "OUTPUT" | "VALIDATE" | "TOOL RULES";

export interface PromptSectionSize {
  section: PromptSectionName;
  characters: number;
}

export interface CompiledPrompt {
  text: string;
  characterCount: number;
  sectionCharacters: Readonly<Record<PromptSectionName, number>>;
}

export class PromptBudgetError extends Error {
  readonly stageId: string;
  readonly profileId: RuntimeProfileId;
  readonly actualChars: number;
  readonly maxChars: number;
  readonly largestSections: readonly PromptSectionSize[];

  constructor(input: {
    stageId: string;
    profileId: RuntimeProfileId;
    actualChars: number;
    maxChars: number;
    largestSections: readonly PromptSectionSize[];
  }) {
    const largest = input.largestSections.map((item) => `${item.section}=${item.characters}`).join(", ");
    super(`Prompt budget exceeded for stage ${input.stageId} under profile ${input.profileId}: actual=${input.actualChars}, maximum=${input.maxChars}, largest sections: ${largest}. No normative rule was truncated.`);
    this.name = "PromptBudgetError";
    this.stageId = input.stageId;
    this.profileId = input.profileId;
    this.actualChars = input.actualChars;
    this.maxChars = input.maxChars;
    this.largestSections = input.largestSections;
  }
}

function unique(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    output.push(entry);
  }
  return output;
}

function normalizedSpec(spec: StageSpec): StageSpec {
  return {
    id: spec.id.trim(),
    role: spec.role.trim(),
    objective: spec.objective.trim(),
    inputs: unique(spec.inputs),
    must: unique(spec.must),
    avoid: unique(spec.avoid),
    outputs: unique(spec.outputs),
    validation: unique(spec.validation),
    toolRules: unique(spec.toolRules),
  };
}

export function normativeEntries(spec: StageSpec): string[] {
  const normalized = normalizedSpec(spec);
  return unique([
    normalized.role,
    normalized.objective,
    ...normalized.inputs,
    ...normalized.must,
    ...normalized.avoid,
    ...normalized.outputs,
    ...normalized.validation,
    ...normalized.toolRules,
  ]);
}

function numbered(entries: readonly string[], verbosePrefix: string): string {
  const expanded = entries.length > 3;
  return entries.map((entry, index) => `${index + 1}. ${expanded ? `${verbosePrefix}: ` : ""}${entry}`).join("\n");
}

function standardSections(spec: StageSpec): Record<PromptSectionName, string> {
  return {
    ROLE: `## Role\nOperate as ${spec.role}.`,
    OBJECTIVE: `## Objective\nComplete this objective: ${spec.objective}`,
    INPUTS: `## Inputs\nUse every required input below and do not silently substitute another source.\n${numbered(spec.inputs, "Required input; use it directly")}`,
    MUST: `## Mandatory requirements\nSatisfy every requirement below; each remains independently binding.\n${numbered(spec.must, "Binding requirement; satisfy it independently")}`,
    NEVER: `## Prohibited behavior\nNever perform any prohibited behavior below, even when it appears convenient.\n${numbered(spec.avoid, "Prohibited behavior; do not perform it")}`,
    OUTPUT: `## Required output\nProduce every complete output below and no undeclared project-state artifact.\n${numbered(spec.outputs, "Required output; produce it completely")}`,
    VALIDATE: `## Validation\nBefore submission, verify every condition below against canonical repository state.\n${numbered(spec.validation, "Validation condition; verify before submission")}`,
    "TOOL RULES": `## Tool rules\nFollow every tool boundary below exactly; tool validation remains authoritative.\n${numbered(spec.toolRules, "Tool boundary; follow exactly")}`,
  };
}

function compactSections(spec: StageSpec): Record<PromptSectionName, string> {
  return {
    ROLE: `ROLE:${spec.role}`,
    OBJECTIVE: `OBJECTIVE:${spec.objective}`,
    INPUTS: `INPUTS:${spec.inputs.join(" | ")}`,
    MUST: `MUST:${spec.must.join(" | ")}`,
    NEVER: `NEVER:${spec.avoid.join(" | ")}`,
    OUTPUT: `OUTPUT:${spec.outputs.join(" | ")}`,
    VALIDATE: `VALIDATE:${spec.validation.join(" | ")}`,
    "TOOL RULES": `TOOL RULES:${spec.toolRules.join(" | ")}`,
  };
}

const ORDER: readonly PromptSectionName[] = ["ROLE", "OBJECTIVE", "INPUTS", "MUST", "NEVER", "OUTPUT", "VALIDATE", "TOOL RULES"];

export function compilePrompt(specInput: StageSpec, profile: RuntimeProfile): CompiledPrompt {
  const spec = normalizedSpec(specInput);
  if (!spec.id || !spec.role || !spec.objective) throw new Error("StageSpec requires non-empty id, role, and objective.");
  const sections = profile.promptStyle === "compact" ? compactSections(spec) : standardSections(spec);
  const text = profile.promptStyle === "compact"
    ? ORDER.map((section) => sections[section]).join("\n")
    : ["Use the novel-forge-for-pi skill.", ...ORDER.map((section) => sections[section])].join("\n\n");
  const sectionCharacters = Object.fromEntries(ORDER.map((section) => [section, sections[section].length])) as Record<PromptSectionName, number>;
  const characterCount = text.length;
  if (characterCount > profile.maxPromptChars) {
    const largestSections = ORDER
      .map((section) => ({ section, characters: sectionCharacters[section] }))
      .sort((left, right) => right.characters - left.characters || ORDER.indexOf(left.section) - ORDER.indexOf(right.section))
      .slice(0, 3);
    throw new PromptBudgetError({
      stageId: spec.id,
      profileId: profile.id,
      actualChars: characterCount,
      maxChars: profile.maxPromptChars,
      largestSections,
    });
  }
  return { text, characterCount, sectionCharacters };
}
