import type { ChapterQueueState } from "../domain/schemas.js";
import type { PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";

export interface SceneAuditFinding {
  code: "consecutive-scene-engine" | "scene-engine-dominance" | "state-neutral-conversation" | "indistinguishable-state-change";
  chapters: number[];
  evidence: string;
  problem: string;
  recurrenceKey: string;
}

const CONVERSATIONAL_ENGINES = ["interview", "conversation", "dialogue", "meeting", "briefing", "debrief", "interrogation", "questioning"];
const NEUTRAL_STATES = new Set(["", "none", "no change", "unchanged", "same", "status quo", "n/a", "neutral", "static", "holds"]);

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function isConversation(engine: string): boolean {
  const normalized = normalize(engine);
  return CONVERSATIONAL_ENGINES.some((value) => normalized.includes(value));
}

function isNeutral(value: string): boolean {
  return NEUTRAL_STATES.has(normalize(value));
}

export function sceneAuditFindings(queue: ChapterQueueState, plot: PlotGridPhase4): SceneAuditFinding[] {
  const findings: SceneAuditFinding[] = [];
  const packets = [...queue.packets].sort((a, b) => a.chapter - b.chapter);
  const stateByChapter = new Map(plot.chapters.map((entry) => [entry.chapter, entry.state_change]));

  for (let index = 0; index <= packets.length - 3; index += 1) {
    const run = packets.slice(index, index + 3);
    const engine = normalize(run[0]?.scene_engine ?? "");
    if (engine && run.every((packet) => normalize(packet.scene_engine) === engine)) {
      const chapters = run.map((packet) => packet.chapter);
      findings.push({
        code: "consecutive-scene-engine",
        chapters,
        evidence: `Chapters ${chapters.join(", ")} use the same scene engine: ${run[0]?.scene_engine}.`,
        problem: "More than two consecutive chapters use the same scene engine.",
        recurrenceKey: `scene-engine:${engine}`,
      });
    }
  }

  if (packets.length >= 6) {
    const counts = new Map<string, { label: string; chapters: number[] }>();
    for (const packet of packets) {
      const key = normalize(packet.scene_engine);
      if (!key) continue;
      const current = counts.get(key) ?? { label: packet.scene_engine, chapters: [] };
      current.chapters.push(packet.chapter);
      counts.set(key, current);
    }
    for (const [key, value] of counts) {
      if (value.chapters.length / packets.length > 0.5) {
        findings.push({
          code: "scene-engine-dominance",
          chapters: value.chapters,
          evidence: `${value.label} appears in ${value.chapters.length} of ${packets.length} planned chapters.`,
          problem: "One scene engine dominates more than half of a sufficiently large plan.",
          recurrenceKey: `scene-engine-dominance:${key}`,
        });
      }
    }
  }

  for (const packet of packets) {
    const stateChannels = [
      stateByChapter.get(packet.chapter) ?? "",
      packet.pressure_movement,
      packet.character_movement,
      packet.relationship_movement,
    ];
    if (isConversation(packet.scene_engine) && stateChannels.every(isNeutral)) {
      findings.push({
        code: "state-neutral-conversation",
        chapters: [packet.chapter],
        evidence: `Chapter ${packet.chapter} uses ${packet.scene_engine} while plot, pressure, character, and relationship movement remain neutral.`,
        problem: "A conversation-driven scene does not change case, relationship, power, character, pressure, or knowledge state.",
        recurrenceKey: "state-neutral-conversation",
      });
    }
  }

  for (let index = 1; index < packets.length; index += 1) {
    const previous = packets[index - 1];
    const current = packets[index];
    if (!previous || !current) continue;
    const previousState = normalize(stateByChapter.get(previous.chapter) ?? "");
    const currentState = normalize(stateByChapter.get(current.chapter) ?? "");
    if (previousState && previousState === currentState) {
      findings.push({
        code: "indistinguishable-state-change",
        chapters: [previous.chapter, current.chapter],
        evidence: `Chapters ${previous.chapter} and ${current.chapter} share the same normalized state change: ${previousState}.`,
        problem: "Adjacent chapters have indistinguishable state movement.",
        recurrenceKey: `state-change:${previousState}`,
      });
    }
  }

  return findings;
}
