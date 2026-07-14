import { join } from "node:path";
import { CanonSchema, ChapterQueueSchema, PlotGridSchema, SourceRegisterSchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type PlotGridState, type SourceRegisterState, type StoryThreadsState } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook } from "../project/store.js";

export interface IntegrityFinding { severity: "blocker" | "warning"; message: string }
export function packetReferenceFindings(packet: ChapterPacket, canon: CanonState, threads: StoryThreadsState, sources: SourceRegisterState, plot: PlotGridState): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const canonIds = new Set([...canon.facts.map((item) => item.id), ...canon.relationships.map((item) => item.id)]);
  for (const id of packet.continuity_refs) if (!canonIds.has(id)) findings.push({ severity: "blocker", message: `Missing continuity reference ${id} for Chapter ${packet.chapter}.` });
  const threadById = new Map(threads.threads.map((thread) => [thread.id, thread]));
  for (const id of packet.story_thread_refs) {
    const thread = threadById.get(id);
    if (!thread) findings.push({ severity: "blocker", message: `Missing story-thread reference ${id} for Chapter ${packet.chapter}.` });
    else if (["paid-off", "abandoned"].includes(thread.status)) findings.push({ severity: "blocker", message: `Story thread ${id} is already ${thread.status}; reopen or replace it before Chapter ${packet.chapter}.` });
  }
  const sourceIds = new Set(sources.sources.map((source) => source.id));
  for (const id of packet.required_research) if (!sourceIds.has(id)) findings.push({ severity: "blocker", message: `Missing required research source ${id} for Chapter ${packet.chapter}.` });
  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter);
  if (!plotEntry) findings.push({ severity: "blocker", message: `Plot grid has no entry for Chapter ${packet.chapter}.` });
  else {
    for (const id of [...plotEntry.setup_ids, ...plotEntry.payoff_ids]) if (!threadById.has(id)) findings.push({ severity: "blocker", message: `Plot-grid thread ${id} does not exist in story-threads.yaml.` });
    if (!plotEntry.causality.trim() || /and then/i.test(plotEntry.causality)) findings.push({ severity: "warning", message: `Chapter ${packet.chapter} has weak causality: ${plotEntry.causality || "empty"}.` });
  }
  return findings;
}

export function collectProjectIntegrityFindings(root: string): IntegrityFinding[] {
  const book = readBook(root); const bookRoot = join(root, "books", book.book_id);
  const queueText = readText(join(bookRoot, "chapter-queue.yaml")); const canonText = readText(join(root, "series", "canon.yaml"));
  const threadsText = readText(join(root, "series", "story-threads.yaml")); const sourcesText = readText(join(root, "research", "source-register.yaml")); const plotText = readText(join(bookRoot, "plot-grid.yaml"));
  if (!queueText || !canonText || !threadsText || !sourcesText || !plotText) return [];
  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml");
  const canon = parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml");
  const threads = parseYaml<StoryThreadsState>(threadsText, StoryThreadsSchema, "story-threads.yaml");
  const sources = parseYaml<SourceRegisterState>(sourcesText, SourceRegisterSchema, "source-register.yaml");
  const plot = parseYaml<PlotGridState>(plotText, PlotGridSchema, "plot-grid.yaml");
  return queue.packets.filter((packet) => packet.status === "ready").flatMap((packet) => packetReferenceFindings(packet, canon, threads, sources, plot));
}
