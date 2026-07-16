import type { ChapterQueueState } from "../domain/schemas.js";
import type { PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";

export interface SceneDiversityFinding {
  code: string;
  severity: "high" | "medium" | "low";
  chapters: number[];
  evidence: string;
  problem: string;
  required_change: string;
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function neutral(value: string): boolean {
  const item = normalized(value);
  return !item || ["none", "unchanged", "no change", "static", "same", "holds", "neutral"].includes(item);
}

function conversationEngine(value: string): boolean {
  return /(?:interview|conversation|meeting|debrief|dialogue|briefing|interrogation)/i.test(value);
}

export function sceneDiversityFindings(queue: ChapterQueueState, plot: PlotGridPhase4): SceneDiversityFinding[] {
  const findings: SceneDiversityFinding[] = [];
  const packets = [...queue.packets].sort((a, b) => a.chapter - b.chapter);
  const plotByChapter = new Map(plot.chapters.map((chapter) => [chapter.chapter, chapter]));

  let runStart = 0;
  while (runStart < packets.length) {
    const engine = normalized(packets[runStart]?.scene_engine ?? "");
    let runEnd = runStart + 1;
    while (runEnd < packets.length && normalized(packets[runEnd]?.scene_engine ?? "") === engine) runEnd += 1;
    const run = packets.slice(runStart, runEnd);
    if (engine && run.length > 2) {
      findings.push({
        code: "consecutive-scene-engine",
        severity: "high",
        chapters: run.map((packet) => packet.chapter),
        evidence: `Chapters ${run.map((packet) => packet.chapter).join(", ")} use scene engine ${run[0]?.scene_engine ?? engine}.`,
        problem: "More than two consecutive chapters use the same scene engine.",
        required_change: "Change at least one scene engine or materially alter how pressure and state move through the sequence.",
      });
    }
    runStart = runEnd;
  }

  if (packets.length >= 6) {
    const counts = new Map<string, number>();
    for (const packet of packets) {
      const engine = normalized(packet.scene_engine);
      if (engine) counts.set(engine, (counts.get(engine) ?? 0) + 1);
    }
    for (const [engine, count] of counts) {
      if (count / packets.length > 0.5) {
        const chapters = packets.filter((packet) => normalized(packet.scene_engine) === engine).map((packet) => packet.chapter);
        findings.push({
          code: "whole-book-engine-dominance",
          severity: "medium",
          chapters,
          evidence: `${count} of ${packets.length} planned chapters use scene engine ${engine}.`,
          problem: "One scene engine dominates more than half of a sufficiently large chapter set.",
          required_change: "Review whether the dominant engine is intentional; diversify only where another engine better serves causality and reader experience.",
        });
      }
    }
  }

  for (const packet of packets) {
    const plotEntry = plotByChapter.get(packet.chapter);
    if (
      conversationEngine(packet.scene_engine)
      && neutral(packet.pressure_movement)
      && neutral(packet.character_movement)
      && neutral(packet.relationship_movement)
      && neutral(plotEntry?.state_change ?? "")
    ) {
      findings.push({
        code: "state-neutral-conversation",
        severity: "high",
        chapters: [packet.chapter],
        evidence: `Chapter ${packet.chapter} is a ${packet.scene_engine} with no recorded pressure, character, relationship, or plot-state movement.`,
        problem: "A dialogue-led scene does not change case, relationship, power, character, pressure, or plot state.",
        required_change: "Give the scene a concrete state change or remove/merge it if the information can be carried by a scene that changes state.",
      });
    }
  }

  for (let index = 1; index < packets.length; index += 1) {
    const previous = packets[index - 1];
    const current = packets[index];
    if (!previous || !current || current.chapter !== previous.chapter + 1) continue;
    const previousPlot = plotByChapter.get(previous.chapter);
    const currentPlot = plotByChapter.get(current.chapter);
    const previousVector = [previous.pressure_movement, previous.character_movement, previous.relationship_movement, previousPlot?.state_change ?? ""].map(normalized);
    const currentVector = [current.pressure_movement, current.character_movement, current.relationship_movement, currentPlot?.state_change ?? ""].map(normalized);
    if (previousVector.some(Boolean) && previousVector.every((value, vectorIndex) => value === currentVector[vectorIndex])) {
      findings.push({
        code: "indistinguishable-adjacent-chapters",
        severity: "medium",
        chapters: [previous.chapter, current.chapter],
        evidence: `Chapters ${previous.chapter} and ${current.chapter} record the same pressure, character, relationship, and plot-state movement.`,
        problem: "Adjacent chapters are indistinguishable at the state-change level.",
        required_change: "Differentiate the chapters by changing what becomes possible, costly, known, trusted, or irreversible in one of them.",
      });
    }
  }

  return findings;
}
