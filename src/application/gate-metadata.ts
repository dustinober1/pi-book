import type { ProjectState, Stage } from "../domain/schemas.js";

export interface GateDetail {
  title: string;
  owner: Stage;
  repairLabel: string;
  repairScope: "voice" | "book" | "chapter" | "act" | "manuscript" | "package";
}

const details: Record<string, GateDetail> = {
  "voice-approval": { title: "Voice Profile", owner: "voice-intake", repairLabel: "Repair voice profile", repairScope: "voice" },
  "book-plan-approval": { title: "Book Plan", owner: "book-planning", repairLabel: "Repair book plan", repairScope: "book" },
  "first-chapter-approval": { title: "First Chapter", owner: "drafting", repairLabel: "Review first chapter", repairScope: "chapter" },
  "act-1-review": { title: "Act I Review", owner: "act-review", repairLabel: "Repair Act I", repairScope: "act" },
  "midpoint-review": { title: "Midpoint Review", owner: "act-review", repairLabel: "Repair midpoint", repairScope: "act" },
  "pre-final-act-review": { title: "Pre-Final-Act Review", owner: "act-review", repairLabel: "Repair final-act entry", repairScope: "act" },
  "manuscript-approval": { title: "Manuscript", owner: "manuscript-review", repairLabel: "Repair manuscript", repairScope: "manuscript" },
  "package-approval": { title: "Book Package", owner: "packaging", repairLabel: "Repair package", repairScope: "package" },
};

export function gateDetail(gate: string): GateDetail {
  return details[gate] ?? { title: gate.replace(/-/g, " "), owner: "voice-intake", repairLabel: "Repair current gate", repairScope: "voice" };
}

export function gateEvidencePaths(project: ProjectState, gate: string): string[] {
  const book = `books/${project.active_book}`;
  if (gate === "voice-approval") return [
    "series/voice-profile.md",
    "series/taste-profile.yaml",
    "series/voice-guardrails.yaml",
    "series/voice-experiments/index.yaml",
  ];
  if (gate === "book-plan-approval") return [
    `${book}/book-bible.md`,
    `${book}/genre.yaml`,
    `${book}/plot-grid.yaml`,
    `${book}/remarkability.yaml`,
    `${book}/research-ledger.yaml`,
    `${book}/book-strategy.yaml`,
  ];
  if (gate === "first-chapter-approval") return [`${book}/manuscript/chapters/01-opening.md`, `${book}/review-report.md`];
  if (["act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-approval"].includes(gate)) return [`${book}/review-report.md`, `${book}/revision-tickets.yaml`];
  if (gate === "package-approval") return [`${book}/package.md`];
  return ["PROJECT.yaml"];
}
