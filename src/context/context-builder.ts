import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { CanonSchema, ChapterQueueSchema, RemarkabilitySchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type RemarkabilityState, type StoryThreadsState } from "../domain/schemas.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5 } from "../domain/v1-3-audit-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, TasteProfileSchema, VoiceGuardrailsSchema, defaultTasteProfile, defaultVoiceGuardrails, type ResearchLedger, type TasteProfile, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { renderApprovedBookGuardrails } from "../application/book-strategy.js";
import { packetReferenceFindings } from "../application/integrity.js";
import { renderContextGuardrails, voiceSafetyFindings } from "../application/influence-palette.js";
import { creativeProjectStateHash } from "../application/project-hash.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { contextCacheKey, readContextCache, writeContextCache } from "../infrastructure/context-cache.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { assertRequiredContextIds, distillContext, type ContextCandidate } from "./context-distiller.js";
import type { ContextBuildReport } from "./context-report.js";
import { renderEndingContext, renderFactCards } from "./distillers/fact-cards.js";
import { CONTEXT_DISTILLER_VERSION, CONTEXT_SECTION_POLICY_VERSION, CONTEXT_SECTION_PRIORITY } from "./section-policies.js";
import { buildStoryGraph, resolveDraftingGraphContext, type StoryGraphBlockedSelection, type StoryGraphSelection } from "./story-graph.js";

export interface ChapterContextReport {
  estimatedTokens: number;
  included: string[];
  excluded: string[];
  graph: { maxDepth: 1 | 2; selections: StoryGraphSelection[]; blocked: StoryGraphBlockedSelection[] };
  build: ContextBuildReport;
  cache: { status: "hit" | "miss" | "write-failed"; key: string };
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
function hashText(text: string): string { return createHash("sha256").update(text).digest("hex"); }
function inferredProfile(maxChars: number): RuntimeProfileId { return maxChars <= 12_000 ? "tiny-local" : maxChars <= 24_000 ? "local" : "full"; }
function isBuildReport(value: unknown): value is ContextBuildReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<ContextBuildReport>;
  return report.schemaVersion === "1.0.0" && typeof report.renderedChars === "number" && Array.isArray(report.sections) && Array.isArray(report.warnings);
}
function candidate(input: {
  id: string; title: string; priority: number; required: boolean; body: string; cap: number; compact?: string; recordIds?: readonly string[]; fromEnd?: boolean;
}): ContextCandidate {
  const body = excerpt(input.body, input.cap, input.fromEnd ?? false);
  return {
    id: input.id,
    title: input.title,
    priority: input.priority,
    required: input.required,
    body,
    recordIds: input.recordIds ?? [],
    ...(input.compact ? { compactBody: input.compact } : {}),
  };
}

export function buildChapterContext(root: string, requestedChapter?: number, maxChars = 72_000, graphDepth: 1 | 2 = 2, runtimeProfileId?: RuntimeProfileId): ChapterContext {
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

  const tasteText = readText(join(root, "series", "taste-profile.yaml")) ?? "";
  const guardrailsText = readText(join(root, "series", "voice-guardrails.yaml")) ?? "";
  const voiceProfileText = readText(join(root, "series", "voice-profile.md")) ?? "";
  const bookBibleText = readText(join(bookRoot, "book-bible.md")) ?? "";
  const genreText = readText(join(bookRoot, "genre.yaml")) ?? "";
  const taste = tasteText ? parseYaml<TasteProfile>(tasteText, TasteProfileSchema, "series/taste-profile.yaml") : defaultTasteProfile();
  const guardrails = guardrailsText ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml") : null;
  const voiceFindings = voiceSafetyFindings({ taste, voiceProfile: voiceProfileText, guardrails: guardrails ?? defaultVoiceGuardrails() });
  if (voiceFindings.length) throw new Error(`Voice originality validation blocked drafting:\n${voiceFindings.map((item) => `- ${item.message}`).join("\n")}`);
  const contextGuardrails = guardrails ? renderContextGuardrails(guardrails, packet.pov) : "";
  const bookGuardrails = renderApprovedBookGuardrails(strategy);

  const graphResolution = resolveDraftingGraphContext(buildStoryGraph({ bookId: book.book_id, canon, threads, queue, plot, sources, research }), packet, { maxDepth: graphDepth });
  const factIds = new Set(graphResolution.factIds); const relationshipIds = new Set(graphResolution.relationshipIds); const threadIds = new Set(graphResolution.threadIds); const researchIds = new Set(graphResolution.researchIds);
  const relevantFacts = canon.facts.filter((fact) => factIds.has(fact.id));
  const relevantRelationships = canon.relationships.filter((relationship) => relationshipIds.has(relationship.id));
  const relevantThreads = threads.threads.filter((thread) => threadIds.has(thread.id));
  const relevantResearch = research.items.filter((item) => item.status === "ready" && researchIds.has(item.id));
  const sourceIds = new Set([...graphResolution.sourceIds, ...relevantResearch.flatMap((item) => item.source_ids)]);
  const relevantSources = sources.sources.filter((source) => sourceIds.has(source.id));
  const availableIds = new Set([
    ...canon.facts.map((item) => item.id), ...canon.relationships.map((item) => item.id), ...threads.threads.map((item) => item.id), ...research.items.map((item) => item.id), ...sources.sources.map((item) => item.id),
  ]);
  assertRequiredContextIds([...factIds, ...relationshipIds, ...threadIds, ...researchIds, ...sourceIds], availableIds);

  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter) ?? null;
  const chapterFiles = listChapterFiles(bookRoot); const previousPath = previousChapterPath(chapterFiles, packet.chapter);
  const previous = previousPath ? readText(previousPath) ?? "" : "_No prior chapter exists._";
  const profileId = runtimeProfileId ?? inferredProfile(maxChars);
  const candidates: ContextCandidate[] = [
    candidate({ id: "chapter-packet", title: "Approved chapter packet", priority: CONTEXT_SECTION_PRIORITY.chapterPacket, required: true, body: JSON.stringify(packet, null, 2), cap: 12_000, compact: renderFactCards(packet), recordIds: [`chapter-${packet.chapter}`] }),
    candidate({ id: "canon-facts", title: "Relevant canon facts", priority: CONTEXT_SECTION_PRIORITY.canonFacts, required: true, body: JSON.stringify(relevantFacts, null, 2), cap: 7_000, compact: renderFactCards(relevantFacts), recordIds: relevantFacts.map((item) => item.id) }),
    candidate({ id: "relationships", title: "Relevant relationship state", priority: CONTEXT_SECTION_PRIORITY.relationships, required: true, body: JSON.stringify(relevantRelationships, null, 2), cap: 6_000, compact: renderFactCards(relevantRelationships), recordIds: relevantRelationships.map((item) => item.id) }),
    candidate({ id: "story-threads", title: "Relevant story threads", priority: CONTEXT_SECTION_PRIORITY.storyThreads, required: true, body: JSON.stringify(relevantThreads, null, 2), cap: 7_000, compact: renderFactCards(relevantThreads), recordIds: relevantThreads.map((item) => item.id) }),
    ...(relevantResearch.length ? [candidate({ id: "research-claims", title: "Required ready research claims", priority: CONTEXT_SECTION_PRIORITY.researchClaims, required: true, body: JSON.stringify(relevantResearch, null, 2), cap: 8_000, compact: renderFactCards(relevantResearch), recordIds: relevantResearch.map((item) => item.id) })] : []),
    ...(relevantSources.length ? [candidate({ id: "research-sources", title: "Graph-selected research provenance", priority: CONTEXT_SECTION_PRIORITY.researchSources, required: true, body: JSON.stringify(relevantSources, null, 2), cap: 5_000, compact: renderFactCards(relevantSources), recordIds: relevantSources.map((item) => item.id) })] : []),
    candidate({ id: "plot-entry", title: "Plot-grid entry", priority: CONTEXT_SECTION_PRIORITY.plotEntry, required: true, body: JSON.stringify(plotEntry, null, 2), cap: 5_000, compact: renderFactCards(plotEntry), recordIds: [] }),
    candidate({ id: "previous-endpoint", title: "Previous chapter ending/context", priority: CONTEXT_SECTION_PRIORITY.previousEndpoint, required: true, body: previous, cap: 12_000, compact: renderEndingContext(previous), recordIds: [] , fromEnd: true }),
    ...(contextGuardrails ? [candidate({ id: "voice-guardrails", title: "Approved voice guardrails", priority: CONTEXT_SECTION_PRIORITY.voiceGuardrails, required: true, body: contextGuardrails, cap: 6_000, compact: contextGuardrails, recordIds: [] })] : []),
    ...(bookGuardrails ? [candidate({ id: "book-guardrails", title: "Approved book guardrails", priority: CONTEXT_SECTION_PRIORITY.bookGuardrails, required: true, body: bookGuardrails, cap: 5_000, compact: bookGuardrails, recordIds: [] })] : []),
    candidate({ id: "remarkability", title: "Remarkability contract", priority: CONTEXT_SECTION_PRIORITY.remarkability, required: false, body: JSON.stringify(remarkability, null, 2), cap: 6_000, compact: renderFactCards(remarkability), recordIds: [] }),
    candidate({ id: "profile-rules", title: "Profile rules", priority: CONTEXT_SECTION_PRIORITY.profileRules, required: false, body: profile.draftingRules.map((rule) => `- ${rule}`).join("\n"), cap: 5_000, recordIds: [] }),
    candidate({ id: "voice-profile", title: "Voice profile excerpt", priority: CONTEXT_SECTION_PRIORITY.voiceProfile, required: false, body: voiceProfileText, cap: 14_000, recordIds: [] }),
    candidate({ id: "book-bible", title: "Active book bible excerpt", priority: CONTEXT_SECTION_PRIORITY.bookBible, required: false, body: bookBibleText, cap: 12_000, recordIds: [] }),
    candidate({ id: "genre", title: "Genre configuration", priority: CONTEXT_SECTION_PRIORITY.genre, required: false, body: genreText, cap: 6_000, recordIds: [] }),
  ];

  const sourceHashes = Object.fromEntries(Object.entries({
    "chapter-queue.yaml": queueText, "series/canon.yaml": canonText, "series/story-threads.yaml": threadsText, "plot-grid.yaml": plotText,
    "research/source-register.yaml": sourcesText, "research-ledger.yaml": researchText, "book-strategy.yaml": strategyText, "remarkability.yaml": remarkabilityText,
    "series/taste-profile.yaml": tasteText, "series/voice-guardrails.yaml": guardrailsText, "series/voice-profile.md": voiceProfileText,
    "book-bible.md": bookBibleText, "genre.yaml": genreText, [previousPath ? `previous:${basename(previousPath)}` : "previous:none"]: previous,
  }).map(([path, text]) => [path, hashText(text)]));
  const key = contextCacheKey({ projectHash: creativeProjectStateHash(root), sourceHashes, runtimeProfile: profileId, distillerVersion: CONTEXT_DISTILLER_VERSION, sectionPolicyVersion: CONTEXT_SECTION_POLICY_VERSION });
  const cached = readContextCache(root, key);
  let text: string;
  let build: ContextBuildReport;
  let cacheStatus: ChapterContextReport["cache"]["status"] = "miss";
  if (cached && isBuildReport(cached.report)) {
    text = cached.text;
    build = cached.report;
    cacheStatus = "hit";
  } else {
    const header = `# Drafting Context — Chapter ${packet.chapter}`;
    const distilled = distillContext(candidates, { profileId, maxChars: maxChars - header.length });
    text = header + distilled.text;
    build = { ...distilled.report, maxChars, renderedChars: text.length, estimatedTokens: Math.ceil(text.length / 4) };
    try { writeContextCache(root, key, { text, report: build }); } catch { cacheStatus = "write-failed"; }
  }

  const graphIncluded = graphResolution.selections.filter((selection) => selection.reason === "graph-discovered").map((selection) => {
    if (selection.type === "canon-fact") return `graph canon ${selection.refId}`;
    if (selection.type === "story-thread") return `graph thread ${selection.refId}`;
    if (selection.type === "research-item") return `graph research ${selection.refId}`;
    if (selection.type === "research-source") return `graph source ${selection.refId}`;
    return `graph relationship ${selection.refId}`;
  });
  const included = [
    `chapter packet ${packet.chapter}`, ...relevantFacts.map((fact) => `canon ${fact.id}`), ...relevantRelationships.map((relationship) => `relationship ${relationship.id}`),
    ...relevantThreads.map((thread) => `thread ${thread.id}`), ...relevantResearch.map((item) => `research ${item.id}`), ...relevantSources.map((source) => `source ${source.id}`),
    ...graphIncluded, "remarkability contract", ...(contextGuardrails ? ["approved voice guardrails"] : []), ...(bookGuardrails ? ["approved book guardrails"] : []),
    previousPath ? `previous chapter ${previousPath.slice(bookRoot.length + 1)}` : "no previous chapter",
  ];
  return {
    root, bookId: project.active_book, packet, text,
    report: {
      estimatedTokens: Math.ceil(text.length / 4), included,
      excluded: ["unreferenced canon", "unreferenced story threads", "unrequired research claims", "unapproved book guardrails", "non-adjacent chapters", "future books", "graph-blocked unsafe records", "raw public reviews", "raw influence references", "voice experiment source and variants", "reader experiment responses", "packaging files", "legacy artifacts"],
      graph: { maxDepth: graphResolution.maxDepth, selections: graphResolution.selections, blocked: graphResolution.blocked }, build, cache: { status: cacheStatus, key },
    },
  };
}

export function manuscriptWordCount(root: string, bookId?: string): number { const project = readProject(root); const bookRoot = join(root, "books", bookId ?? project.active_book); return listChapterFiles(bookRoot).reduce((total, path) => total + countWords(readText(path) ?? ""), 0); }
