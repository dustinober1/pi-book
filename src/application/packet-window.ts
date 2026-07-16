import type { ChapterPacket, ChapterQueueState } from "../domain/schemas.js";
import type { PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";

export interface PacketWindowPolicy {
  targetReady: number;
  refillThreshold: number;
}

export interface PacketWindowFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

export interface PacketWindowDecision {
  queue: ChapterQueueState;
  readyCount: number;
  targetCount: number;
  needsRefill: boolean;
  candidateChapters: number[];
  allPlannedComplete: boolean;
}

export const DEFAULT_PACKET_WINDOW_POLICY: PacketWindowPolicy = {
  targetReady: 6,
  refillThreshold: 2,
};

const terminalStatuses = new Set<ChapterPacket["status"]>(["drafted", "reviewed", "revised"]);

export function compactPacketWindow(queue: ChapterQueueState): ChapterQueueState {
  return {
    ...structuredClone(queue),
    packets: queue.packets.filter((packet) => !terminalStatuses.has(packet.status)),
  };
}

export function packetWindowDecision(
  queue: ChapterQueueState,
  plot: PlotGridPhase4,
  draftedChapters: ReadonlySet<number>,
  policy: PacketWindowPolicy = DEFAULT_PACKET_WINDOW_POLICY,
): PacketWindowDecision {
  const compacted = compactPacketWindow(queue);
  const ready = compacted.packets.filter((packet) => packet.status === "ready");
  const activeNumbers = new Set(compacted.packets.map((packet) => packet.chapter));
  const available = plot.chapters
    .map((chapter) => chapter.chapter)
    .sort((left, right) => left - right)
    .filter((chapter) => !draftedChapters.has(chapter) && !activeNumbers.has(chapter));
  const missing = Math.max(0, policy.targetReady - ready.length);
  const candidateChapters = available.slice(0, missing);
  const allPlannedComplete = plot.chapters.length > 0
    && plot.chapters.every((chapter) => draftedChapters.has(chapter.chapter));
  return {
    queue: compacted,
    readyCount: ready.length,
    targetCount: ready.length + candidateChapters.length,
    needsRefill: ready.length < policy.refillThreshold && candidateChapters.length > 0,
    candidateChapters,
    allPlannedComplete,
  };
}

export function packetWindowFindings(
  queue: ChapterQueueState,
  plot: PlotGridPhase4,
  draftedChapters: ReadonlySet<number>,
  policy: PacketWindowPolicy = DEFAULT_PACKET_WINDOW_POLICY,
): PacketWindowFinding[] {
  const findings: PacketWindowFinding[] = [];
  const seen = new Set<number>();
  const planned = new Set(plot.chapters.map((chapter) => chapter.chapter));
  let readyCount = 0;

  for (const packet of queue.packets) {
    if (seen.has(packet.chapter)) {
      findings.push({ severity: "blocker", code: "duplicate-packet-chapter", message: `Chapter ${packet.chapter} appears more than once in the active packet window.` });
    }
    seen.add(packet.chapter);
    if (!planned.has(packet.chapter)) {
      findings.push({ severity: "blocker", code: "unplanned-packet-chapter", message: `Chapter ${packet.chapter} is not present in the approved plot grid.` });
    }
    if (terminalStatuses.has(packet.status)) {
      findings.push({ severity: "blocker", code: "terminal-packet-in-window", message: `Chapter ${packet.chapter} has terminal status ${packet.status} and must leave the active window.` });
    }
    if (draftedChapters.has(packet.chapter)) {
      findings.push({ severity: "blocker", code: "drafted-chapter-requeued", message: `Chapter ${packet.chapter} already has manuscript prose and cannot be requeued.` });
    }
    if (packet.status === "ready") readyCount += 1;
  }

  if (readyCount > policy.targetReady) {
    findings.push({ severity: "blocker", code: "packet-window-too-large", message: `The active packet window contains ${readyCount} ready packets; the maximum is ${policy.targetReady}.` });
  }
  return findings;
}
