import { basename, join } from "node:path";
import { CanonSchema, ChapterQueueSchema, RemarkabilitySchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type RemarkabilityState, type StoryThreadsState } from "../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5 } from "../domain/v1-3-audit-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, TasteProfileSchema, VoiceGuardrailsSchema, defaultTasteProfile, defaultVoiceGuardrails, type ResearchLedger, type TasteProfile, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { renderApprovedBookGuardrails } from "../application/book-strategy.js";
import { packetReferenceFindings } from "../application/integrity.js";
import { renderContextGuardrails, voiceSafetyFindings } from "../application/influence-palette.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { buildStoryGraph, resolveDraftingGraphContext, type StoryGraphBlockedSelection, type StoryGraphSelection } from "./story-graph.js";

export interface ChapterContextReport {
  estimatedTokens: number;
  included: string[];
  excluded: string[];
  graph: { maxDepth: 1 | 2; selections: StoryGraphSelection[]; blocked: StoryGraphBlockedSelection[] };
}

export interface ChapterContext { root: string; bookId: string; packet: ChapterPacket; text: string; report: ChapterContextReport }
function excerpt(text: string, maxChars: number, fromEnd = false): string { if (text.length <= maxChars) return text; return fromEnd ? text.slice(-maxChars) : text.slice(0, maxChars); }
function selectPacket(queue: ChapterQueueState, requestedChapter?: number): ChapterPacket {
  const packet = requestedChapter ? queue.packets.find((item) => item.chapter === requestedChapter) : queue.packets.find((item) => item.status === "ready");
  if (!packet) throw new Error(requestedChapter ? `No packet found for Chapter ${requestedChapter}.` : "No ready chapter packet found.");
  if (packet.status !== "ready") throw new Error(`Chapter ${packet.chapter} packet is ${packet.status}, not ready.`);
  return packet;
}
function chapterNumber(path: string): number | null { const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/); return match ? Number.parseInt(match[1] ?? "", 10) : null; }
function previousChapterPath(files: string[], chapter: number): string | null { return files.find((path) => chapterNumber(path) === chapter - 1) ?? null; }
function buildBudgetedSections(sections: Array<{ title: string; body: string; required: boolean; cap: number }>, maxChars: number): string {
  let remaining = maxChars; const output: string[] = [];
  for (const section of sections) {
    const header = `\n## ${section.title}\n\n`; const minimum = section.required ? Math.min(300, section.body.length) : 0;
    if (remaining <= header.length + minimum) { if (section.required) throw new Error(`Context budget cannot fit required section: ${section.title}.`); continue; }
    const allowed = Math.min(section.cap, section.body.length, remaining - header.length);
    if (!section.required && allowed < 200) continue;
    output.push(header + excerpt(section.body, allowed, section.title === "Previous chapter ending/context")); remaining -= header.length + allowed;
  }
  return output.join("");
}

export function buildChapterContext(root: string, requestedChapter?: number, maxChars = 72000): ChapterContext {
  const project = readProject(root); const book = readBook(root); const bookRoot = join(root, "books", book.book_id);
  const queueText = readText(join(bookRoot, "chapter-queue.yaml")); const canonText = readText(join(root, "series", "canon.yaml"));
  const threadsText = readText(join(root, "series", "story-threads.yaml")); const plotText = readText(join(bookRoot, "plot-grid.yaml"));
  const sourcesText = readText(join(root, "research", "source-register.yaml")); const researchText = readText(join(bookRoot, "research-ledger.yaml"));
  const strategyText = readText(join(bookRoot, "book-strategy.yaml")); const remarkabilityText = readText(join(bookRoot, "remarkability.yaml"));
  if (!queueText || !canonText || !threadsText || !plotText || !sourcesText || !researchText || !strategyText || !remarkabilityText) throw new Error("Chapter context is missing queue, canon, thread, plot-grid, book strategy, research ledger, research source, or remarkability state.");
  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml");
  const canon = parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml");
  const threads = parseYaml<StoryThreadsState>(threadsText, StoryThreadsSchema, "story-threads.yaml");
  const plot = parseYaml<PlotGridPhase4>(plotText, PlotGridPhase4Schema, "plot-grid.yaml");
  const sources = parseYaml<SourceRegisterV13>(sourcesText, SourceRegisterV13Schema, "source-register.yaml");
  const research = parseYaml<ResearchLedger>(researchText, ResearchLedgerSchema, "research-ledger.yaml");
  const strategy = parseYaml<BookStrategyPhase5>(strategyText, BookStrategyPhase5Schema, "book-strategy.yaml");
  const remarkability = parseYaml<RemarkabilityState>(remarkabilityText, RemarkabilitySchema, "remarkability.yaml");
  const packet = selectPacket(queue, requestedChapter); const profile = getProfile(book.profile);
  const profileBlockers = profile.validatePacket(packet).filter((finding) => finding.severity === "blocker");
  const referenceBlockers = packetReferenceFindings(packet, canon, threads, sources, plot, research).filter((finding) => finding.severity === "blocker");
  const blockers = [...profileBlockers.map((item) => item.message), ...referenceBlockers.map((item) => item.message)];
  if (blockers.length) throw new Error(`Chapter packet is not draftable:\n${blockers.map((item) => `- ${item}`).join("\n")}`);

  const tasteText = readText(join(root, "series", "taste-profile.yaml"));
  const guardrailsText = readText(join(root, "series", "voice-guardrails.yaml"));
  const voiceProfileText = readText(join(root, "series", "voice-profile.md")) ?? "";
  const taste = tasteText ? parseYaml<TasteProfile>(tasteText, TasteProfileSchema, "series/taste-profile.yaml") : defaultTasteProfile();
  const guardrails = guardrailsText ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml") : null;
  const voiceFindings = voiceSafetyFindings({ taste, voiceProfile: voiceProfileText, guardrails: guardrails ?? defaultVoiceGuardrails() });
  if (voiceFindings.length) throw new Error(`Voice originality validation blocked drafting:\n${voiceFindings.map((item) => `- ${item.message}`).join("\n")}`);
  const contextGuardrails = guardrails ? renderContextGuardrails(guardrails, packet.pov) : "";
  const bookGuardrails = renderApprovedBookGuardrails(strategy);

  const graphResolution = resolveDraftingGraphContext(buildStoryGraph({ bookId: book.book_id, canon, threads, queue, plot, sources, research }), packet);
  const factIds = new Set(graphResolution.factIds);
  const relationshipIds = new Set(graphResolution.relationshipIds);
  const threadIds = new Set(graphResolution.threadIds);
  const researchIds = new Set(graphResolution.researchIds);
  const relevantFacts = canon.facts.filter((fact) => factIds.has(fact.id));
  const relevantRelationships = canon.relationships.filter((relationship) => relationshipIds.has(relationship.id));
  const relevantThreads = threads.threads.filter((thread) => threadIds.has(thread.id));
  const relevantResearch = research.items.filter((item) => item.status === "ready" && researchIds.has(item.id));
  const sourceIds = new Set([...graphResolution.sourceIds, ...relevantResearch.flatMap((item) => item.source_ids)]);
  const relevantSources = sources.sources.filter((source) => sourceIds.has(source.id));
  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter) ?? null;
  const chapterFiles = listChapterFiles(bookRoot); const previousPath = previousChapterPath(chapterFiles, packet.chapter);
  const previous = previousPath ? readText(previousPath) ?? "" : "_No prior chapter exists._";
  const sections = [
    { title: "Approved chapter packet", body: JSON.stringify(packet, null, 2), required: true, cap: 12000 },
    { title: "Relevant canon facts", body: JSON.stringify(relevantFacts, null, 2), required: true, cap: 7000 },
    { title: "Relevant relationship state", body: JSON.stringify(relevantRelationships, null, 2), required: true, cap: 6000 },
    { title: "Relevant story threads", body: JSON.stringify(relevantThreads, null, 2), required: true, cap: 7000 },
    ...(relevantResearch.length ? [{ title: "Required ready research claims", body: JSON.stringify(relevantResearch, null, 2), required: true, cap: 8000 }] : []),
    ...(relevantSources.length ? [{ title: "Graph-selected research provenance", body: JSON.stringify(relevantSources, null, 2), required: true, cap: 5000 }] : []),
    { title: "Plot-grid entry", body: JSON.stringify(plotEntry, null, 2), required: true, cap: 5000 },
    { title: "Previous chapter ending/context", body: previous, required: true, cap: 12000 },
    { title: "Remarkability contract", body: JSON.stringify(remarkability, null, 2), required: false, cap: 6000 },
    { title: "Profile rules", body: profile.draftingRules.map((rule) => `- ${rule}`).join("\n"), required: false, cap: 5000 },
    ...(contextGuardrails ? [{ title: "Approved voice guardrails", body: contextGuardrails, required: true, cap: 6000 }] : []),
    ...(bookGuardrails ? [{ title: "Approved book guardrails", body: bookGuardrails, required: true, cap: 5000 }] : []),
    { title: "Voice profile excerpt", body: voiceProfileText, required: false, cap: 14000 },
    { title: "Active book bible excerpt", body: readText(join(bookRoot, "book-bible.md")) ?? "", required: false, cap: 12000 },
    { title: "Genre configuration", body: readText(join(bookRoot, "genre.yaml")) ?? "", required: false, cap: 6000 },
  ];
  const text = `# Drafting Context — Chapter ${packet.chapter}` + buildBudgetedSections(sections, maxChars);
  const graphIncluded = graphResolution.selections.filter((selection) => selection.reason === "graph-discovered").map((selection) => {
    if (selection.type === "canon-fact") return `graph canon ${selection.refId}`;
    if (selection.type === "story-thread") return `graph thread ${selection.refId}`;
    if (selection.type === "research-item") return `graph research ${selection.refId}`;
    if (selection.type === "research-source") return `graph source ${selection.refId}`;
    return `graph relationship ${selection.refId}`;
  });
  const included = [
    `chapter packet ${packet.chapter}`,
    ...relevantFacts.map((fact) => `canon ${fact.id}`),
    ...relevantRelationships.map((relationship) => `relationship ${relationship.id}`),
    ...relevantThreads.map((thread) => `thread ${thread.id}`),
    ...relevantResearch.map((item) => `research ${item.id}`),
    ...relevantSources.map((source) => `source ${source.id}`),
    ...graphIncluded,
    "remarkability contract",
    ...(contextGuardrails ? ["approved voice guardrails"] : []),
    ...(bookGuardrails ? ["approved book guardrails"] : []),
    previousPath ? `previous chapter ${previousPath.slice(bookRoot.length + 1)}` : "no previous chapter",
  ];
  return {
    root,
    bookId: project.active_book,
    packet,
    text,
    report: {
      estimatedTokens: Math.ceil(text.length / 4),
      included,
      excluded: ["unreferenced canon", "unreferenced story threads", "unrequired research claims", "unapproved book guardrails", "non-adjacent chapters", "future books", "graph-blocked unsafe records", "raw public reviews", "raw influence references", "voice experiment source and variants", "reader experiment responses", "packaging files", "legacy artifacts"],
      graph: { maxDepth: graphResolution.maxDepth, selections: graphResolution.selections, blocked: graphResolution.blocked },
    },
  };
}

export function manuscriptWordCount(root: string, bookId?: string): number { const project = readProject(root); const bookRoot = join(root, "books", bookId ?? project.active_book); return listChapterFiles(bookRoot).reduce((total, path) => total + countWords(readText(path) ?? ""), 0); }
