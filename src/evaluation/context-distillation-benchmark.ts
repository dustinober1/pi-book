import { RUNTIME_PROFILES, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { distillContext, type ContextCandidate } from "../context/context-distiller.js";

export interface ContextDistillationBenchmarkRow {
  profile: RuntimeProfileId;
  sourceChars: number;
  renderedChars: number;
  estimatedTokens: number;
  reductionPercent: number;
  requiredRetained: boolean;
  optionalOmitted: number;
  withinBudget: boolean;
}

export interface ContextDistillationBenchmarkReport {
  schemaVersion: "1.0.0";
  rows: ContextDistillationBenchmarkRow[];
  allRequiredRetained: boolean;
  allWithinBudget: boolean;
}

function candidates(): ContextCandidate[] {
  const privateText = "PRIVATE-CONTEXT-SENTINEL ";
  return [
    { id: "packet", title: "Approved chapter packet", priority: 10, required: true, body: privateText.repeat(160), compactBody: "chapter=12; purpose=force the archive choice; state_change=access revoked", recordIds: ["CH-012"] },
    { id: "canon", title: "Relevant canon facts", priority: 20, required: true, body: privateText.repeat(210), compactBody: "CAN-001|locked|Mara has archive access\nCAN-004|locked|The signal repeats every eleven minutes", recordIds: ["CAN-001", "CAN-004"] },
    { id: "threads", title: "Relevant story threads", priority: 30, required: false, body: privateText.repeat(125), compactBody: "ST-001|open|missing log", recordIds: ["ST-001"] },
    { id: "plot", title: "Plot-grid entry", priority: 40, required: true, body: privateText.repeat(85), compactBody: "chapter=12; causality=therefore; payoff=SET-008", recordIds: ["SET-008"] },
    { id: "previous", title: "Previous chapter ending/context", priority: 50, required: true, body: privateText.repeat(290), compactBody: privateText.repeat(70), recordIds: [] },
    { id: "voice", title: "Approved voice guardrails", priority: 60, required: true, body: "Preserve close third-person pressure. Avoid explanatory summary. ".repeat(18), compactBody: "must=close third-person pressure; avoid=explanatory summary", recordIds: [] },
    { id: "book", title: "Approved book guardrails", priority: 70, required: true, body: "Preserve costly choices and fair clue order. ".repeat(18), compactBody: "must=costly choices; must=fair clue order", recordIds: [] },
  ];
}

function round(value: number): number { return Math.round(value * 100) / 100; }

export function runContextDistillationBenchmark(): ContextDistillationBenchmarkReport {
  const source = candidates();
  const sourceChars = source.reduce((total, item) => total + item.body.length, 0);
  const profiles: RuntimeProfileId[] = ["tiny-local", "local", "full"];
  const rows = profiles.map((profile): ContextDistillationBenchmarkRow => {
    const result = distillContext(source, { profileId: profile, maxChars: RUNTIME_PROFILES[profile].maxContextChars });
    const required = result.report.sections.filter((section) => section.required);
    return {
      profile,
      sourceChars,
      renderedChars: result.text.length,
      estimatedTokens: Math.ceil(result.text.length / 4),
      reductionPercent: round((1 - result.text.length / sourceChars) * 100),
      requiredRetained: required.every((section) => section.status === "included" || section.status === "compacted"),
      optionalOmitted: result.report.sections.filter((section) => !section.required && section.status === "omitted").length,
      withinBudget: result.text.length <= RUNTIME_PROFILES[profile].maxContextChars,
    };
  });
  return {
    schemaVersion: "1.0.0",
    rows,
    allRequiredRetained: rows.every((row) => row.requiredRetained),
    allWithinBudget: rows.every((row) => row.withinBudget),
  };
}
