import type { PlotGridState } from "../domain/schemas.js";

export interface ActBoundary {
  actId: string;
  startChapter: number;
  endChapter: number;
  gate: string | null;
}

export interface ActBoundaryFinding {
  severity: "blocker";
  code: "invalid-act-range" | "overlapping-acts" | "duplicate-act-gate";
  message: string;
}

export function actBoundaryFindings(plot: PlotGridState): ActBoundaryFinding[] {
  const findings: ActBoundaryFinding[] = [];
  const acts = [...plot.acts].sort((left, right) => left.start_chapter - right.start_chapter || left.end_chapter - right.end_chapter || left.id.localeCompare(right.id));
  const gates = new Map<string, string>();
  for (const act of acts) {
    if (act.start_chapter > act.end_chapter) {
      findings.push({ severity: "blocker", code: "invalid-act-range", message: `${act.id} starts after it ends.` });
    }
    if (act.gate) {
      const previous = gates.get(act.gate);
      if (previous) findings.push({ severity: "blocker", code: "duplicate-act-gate", message: `Act gate ${act.gate} is assigned to both ${previous} and ${act.id}.` });
      else gates.set(act.gate, act.id);
    }
  }
  for (let index = 1; index < acts.length; index += 1) {
    const previous = acts[index - 1];
    const current = acts[index];
    if (previous && current && current.start_chapter <= previous.end_chapter) {
      findings.push({ severity: "blocker", code: "overlapping-acts", message: `${previous.id} and ${current.id} overlap at Chapter ${current.start_chapter}.` });
    }
  }
  return findings;
}

export function resolveActBoundary(plot: PlotGridState, chapter: number): ActBoundary | null {
  const act = plot.acts.find((candidate) => chapter >= candidate.start_chapter && chapter <= candidate.end_chapter);
  return act ? { actId: act.id, startChapter: act.start_chapter, endChapter: act.end_chapter, gate: act.gate } : null;
}

export function requiredMilestoneGate(plot: PlotGridState, chapter: number): string | null {
  const boundary = resolveActBoundary(plot, chapter);
  return boundary?.endChapter === chapter ? boundary.gate : null;
}

export function reviewChapterRange(plot: PlotGridState, scope: string, activeGate?: string | null): { startChapter: number; endChapter: number } | null {
  const normalized = scope.trim().toLocaleLowerCase("en-US");
  if (normalized === "manuscript") return null;
  const act = activeGate
    ? plot.acts.find((candidate) => candidate.gate === activeGate)
    : plot.acts.find((candidate) => candidate.gate && (normalized === "act" || normalized === candidate.id.toLocaleLowerCase("en-US")));
  if (!act || !(normalized === "act" || normalized.startsWith("act") || normalized === act.id.toLocaleLowerCase("en-US"))) return null;
  return { startChapter: act.start_chapter, endChapter: act.end_chapter };
}

