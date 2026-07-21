import { basename, join } from "node:path";
import { CanonSchema, ChapterQueueSchema, GenreConfigSchema, RemarkabilitySchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type GenreConfig, type RemarkabilityState, type StoryThreadsState } from "../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5 } from "../domain/v1-3-audit-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, TasteProfileSchema, VoiceGuardrailsSchema, defaultTasteProfile, defaultVoiceGuardrails, type ResearchLedger, type TasteProfile, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { DecisionLedgerSchema, type DecisionLedger } from "../domain/v1-4-schemas.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../domain/historical-fiction.js";
import { renderApprovedBookGuardrails } from "../application/book-strategy.js";
import { historicalIntegrityFindings } from "../application/historical-integrity.js";
import { packetReferenceFindings } from "../application/integrity.js";
import { renderContextGuardrails, voiceSafetyFindings } from "../application/influence-palette.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { allocateContext, type ContextAllocationReport, type ContextRecord, type ContextSection } from "./context-budget.js";
import { buildStoryGraph, resolveDraftingGraphContext, type StoryGraphBlockedSelection, type StoryGraphRecordNodeType, type StoryGraphSelection } from "./story-graph.js";

export interface ChapterContextReport {
  estimatedTokens: number;
  included: string[];
  excluded: string[];
  allocation: ContextAllocationReport;
  graph: { maxDepth: 1 | 2; selections: StoryGraphSelection[]; blocked: StoryGraphBlockedSelection[] };
}

export interface ChapterContext { root: string; bookId: string; packet: ChapterPacket; text: string; report: ChapterContextReport }

function selectPacket(queue: ChapterQueueState, requestedChapter?: number): ChapterPacket {
  const packet = requestedChapter ? queue.packets.find((item) => item.chapter === requestedChapter) : queue.packets.find((item) => item.status === "ready");
  if (!packet) throw new Error(requestedChapter ? `No packet found for Chapter ${requestedChapter}.` : "No ready chapter packet found.");
  if (packet.status !== "ready") throw new Error(`Chapter ${packet.chapter} packet is ${packet.status}, not ready.`);
  return packet;
}

function chapterNumber(path: string): number | null {
  const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function previousChapterPath(files: string[], chapter: number): string | null {
  return files.find((path) => chapterNumber(path) === chapter - 1) ?? null;
}

function jsonRecord(id: string, value: unknown, required: boolean, priority: number): ContextRecord {
  return { id, body: JSON.stringify(value, null, 2), required, priority };
}

function textParagraphRecords(prefix: string, text: string, priorityBase: number): ContextRecord[] {
  return text
    .split(/\n\s*\n/u)
    .map((body) => body.trim())
    .filter(Boolean)
    .map((body, index, values) => ({
      id: `${prefix}:paragraph:${String(index + 1).padStart(4, "0")}`,
      body,
      required: false,
      priority: priorityBase + values.length - index,
    }));
}

function section(id: string, title: string, records: readonly ContextRecord[], maxChars: number): ContextSection {
  return { id, title, records, maxChars };
}

export function buildChapterContext(root: string, requestedChapter?: number, maxChars = 72000, graphDepth: 1 | 2 = 2): ChapterContext {
  const project = readProject(root);
  const book = readBook(root);
  const bookRoot = join(root, "books", book.book_id);
  const queueText = readText(join(bookRoot, "chapter-queue.yaml"));
  const canonText = readText(join(root, "series", "canon.yaml"));
  const threadsText = readText(join(root, "series", "story-threads.yaml"));
  const plotText = readText(join(bookRoot, "plot-grid.yaml"));
  const sourcesText = readText(join(root, "research", "source-register.yaml"));
  const researchText = readText(join(bookRoot, "research-ledger.yaml"));
  const strategyText = readText(join(bookRoot, "book-strategy.yaml"));
  const remarkabilityText = readText(join(bookRoot, "remarkability.yaml"));
  if (!queueText || !canonText || !threadsText || !plotText || !sourcesText || !researchText || !strategyText || !remarkabilityText) {
    throw new Error("Chapter context is missing queue, canon, thread, plot-grid, book strategy, research ledger, research source, or remarkability state.");
  }
  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml");
  const canon = parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml");
  const threads = parseYaml<StoryThreadsState>(threadsText, StoryThreadsSchema, "story-threads.yaml");
  const plot = parseYaml<PlotGridPhase4>(plotText, PlotGridPhase4Schema, "plot-grid.yaml");
  const sources = parseYaml<SourceRegisterV13>(sourcesText, SourceRegisterV13Schema, "source-register.yaml");
  const research = parseYaml<ResearchLedger>(researchText, ResearchLedgerSchema, "research-ledger.yaml");
  const strategy = parseYaml<BookStrategyPhase5>(strategyText, BookStrategyPhase5Schema, "book-strategy.yaml");
  const remarkability = parseYaml<RemarkabilityState>(remarkabilityText, RemarkabilitySchema, "remarkability.yaml");
  const packet = selectPacket(queue, requestedChapter);
  const profile = getProfile(book.profile);
  const profileBlockers = profile.validatePacket(packet).filter((finding) => finding.severity === "blocker");
  const referenceBlockers = packetReferenceFindings(packet, canon, threads, sources, plot, research).filter((finding) => finding.severity === "blocker");
  const blockers = [...profileBlockers.map((item) => item.message), ...referenceBlockers.map((item) => item.message)];
  if (blockers.length) throw new Error(`Chapter packet is not draftable:\n${blockers.map((item) => `- ${item}`).join("\n")}`);

  let historicalContext: HistoricalContext | null = null;
  let inventionLedger: InventionLedger | null = null;
  if (book.profile === "historical-fiction") {
    const historicalText = readText(join(bookRoot, "historical-context.yaml"));
    const inventionText = readText(join(bookRoot, "invention-ledger.yaml"));
    const genreText = readText(join(bookRoot, "genre.yaml"));
    const decisionsText = readText(join(root, "series", "decision-ledger.yaml"));
    if (!historicalText || !inventionText || !genreText || !decisionsText) {
      throw new Error("Historical drafting requires historical-context.yaml, invention-ledger.yaml, genre.yaml, and series/decision-ledger.yaml.");
    }
    historicalContext = parseYaml<HistoricalContext>(historicalText, HistoricalContextSchema, "historical-context.yaml");
    inventionLedger = parseYaml<InventionLedger>(inventionText, InventionLedgerSchema, "invention-ledger.yaml");
    const historicalBlockers = historicalIntegrityFindings({
      genre: parseYaml<GenreConfig>(genreText, GenreConfigSchema, "genre.yaml"),
      context: historicalContext,
      inventions: inventionLedger,
      research,
      sources,
      queue,
      plot,
      decisions: parseYaml<DecisionLedger>(decisionsText, DecisionLedgerSchema, "series/decision-ledger.yaml"),
    }).filter((finding) => finding.severity === "blocker");
    if (historicalBlockers.length) {
      throw new Error(`Historical context is not draftable:\n${historicalBlockers.map((item) => `- ${item.message}`).join("\n")}`);
    }
  }

  const tasteText = readText(join(root, "series", "taste-profile.yaml"));
  const guardrailsText = readText(join(root, "series", "voice-guardrails.yaml"));
  const voiceProfileText = readText(join(root, "series", "voice-profile.md")) ?? "";
  const taste = tasteText ? parseYaml<TasteProfile>(tasteText, TasteProfileSchema, "series/taste-profile.yaml") : defaultTasteProfile();
  const guardrails = guardrailsText ? parseYaml<VoiceGuardrails>(guardrailsText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml") : null;
  const voiceFindings = voiceSafetyFindings({ taste, voiceProfile: voiceProfileText, guardrails: guardrails ?? defaultVoiceGuardrails() });
  if (voiceFindings.length) throw new Error(`Voice originality validation blocked drafting:\n${voiceFindings.map((item) => `- ${item.message}`).join("\n")}`);
  const contextGuardrails = guardrails ? renderContextGuardrails(guardrails, packet.pov) : "";
  const bookGuardrails = renderApprovedBookGuardrails(strategy);

  const graphResolution = resolveDraftingGraphContext(
    buildStoryGraph({ bookId: book.book_id, canon, threads, queue, plot, sources, research }),
    packet,
    { maxDepth: graphDepth },
  );
  const selectionByKey = new Map(graphResolution.selections.map((selection) => [`${selection.type}:${selection.refId}`, selection]));
  const recordPolicy = (type: StoryGraphRecordNodeType, id: string): { required: boolean; priority: number } => {
    const selection = selectionByKey.get(`${type}:${id}`);
    if (selection?.reason === "explicit") return { required: true, priority: 95 };
    return { required: false, priority: selection?.depth === 1 ? 85 : 80 };
  };

  const factIds = new Set(graphResolution.factIds);
  const relationshipIds = new Set(graphResolution.relationshipIds);
  const threadIds = new Set(graphResolution.threadIds);
  const researchIds = new Set(graphResolution.researchIds);
  const chronologyRefs = new Set(Array.isArray(packet.profile_fields["chronology_refs"]) ? packet.profile_fields["chronology_refs"].filter((item): item is string => typeof item === "string") : []);
  const constraintRefs = new Set(Array.isArray(packet.profile_fields["constraint_refs"]) ? packet.profile_fields["constraint_refs"].filter((item): item is string => typeof item === "string") : []);
  const inventionRefs = new Set(Array.isArray(packet.profile_fields["invention_refs"]) ? packet.profile_fields["invention_refs"].filter((item): item is string => typeof item === "string") : []);
  const knowledgeBoundaryRef = typeof packet.profile_fields["knowledge_boundary"] === "string" ? packet.profile_fields["knowledge_boundary"] : null;
  const historicalChronology = historicalContext?.chronology.filter((item) => chronologyRefs.has(item.id)) ?? [];
  const historicalConstraints = historicalContext?.constraints.filter((item) => constraintRefs.has(item.id)) ?? [];
  const historicalKnowledge = historicalContext?.knowledge_boundaries.filter((item) => item.id === knowledgeBoundaryRef) ?? [];
  const historicalInventions = inventionLedger?.entries.filter((item) => inventionRefs.has(item.id)) ?? [];
  const historicalResearchIds = new Set([
    ...packet.required_research,
    ...historicalChronology.flatMap((item) => item.research_ids),
    ...historicalConstraints.flatMap((item) => item.research_ids),
    ...historicalKnowledge.flatMap((item) => item.research_ids),
    ...historicalInventions.flatMap((item) => item.research_ids),
  ]);
  for (const id of historicalResearchIds) researchIds.add(id);
  const relevantFacts = canon.facts.filter((fact) => factIds.has(fact.id));
  const relevantRelationships = canon.relationships.filter((relationship) => relationshipIds.has(relationship.id));
  const relevantThreads = threads.threads.filter((thread) => threadIds.has(thread.id));
  const relevantResearch = research.items.filter((item) => item.status === "ready" && researchIds.has(item.id));
  const historicalDirectSourceIds = [
    ...historicalChronology.flatMap((item) => item.source_ids),
    ...historicalConstraints.flatMap((item) => item.source_ids),
    ...historicalInventions.flatMap((item) => item.source_ids),
  ];
  const requiredSourceIds = new Set([
    ...historicalDirectSourceIds,
    ...packet.required_research.filter((id) => id.startsWith("SRC-")),
    ...relevantResearch.filter((item) => recordPolicy("research-item", item.id).required || historicalResearchIds.has(item.id)).flatMap((item) => item.source_ids),
  ]);
  const sourceIds = new Set([...graphResolution.sourceIds, ...relevantResearch.flatMap((item) => item.source_ids), ...historicalDirectSourceIds]);
  const relevantSources = sources.sources.filter((source) => sourceIds.has(source.id));
  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter) ?? null;
  const chapterFiles = listChapterFiles(bookRoot);
  const previousPath = previousChapterPath(chapterFiles, packet.chapter);
  const previous = previousPath ? readText(previousPath) ?? "" : "_No prior chapter exists._";
  const historicalUncertainties = historicalContext?.uncertainties.filter((item) =>
    (item.invention_ref && inventionRefs.has(item.invention_ref))
    || item.research_ids.some((id) => historicalResearchIds.has(id))) ?? [];

  const factRecords = relevantFacts.map((fact) => jsonRecord(fact.id, fact, recordPolicy("canon-fact", fact.id).required, recordPolicy("canon-fact", fact.id).priority));
  const relationshipRecords = relevantRelationships.map((relationship) => jsonRecord(relationship.id, relationship, recordPolicy("relationship", relationship.id).required, recordPolicy("relationship", relationship.id).priority));
  const threadRecords = relevantThreads.map((thread) => jsonRecord(thread.id, thread, recordPolicy("story-thread", thread.id).required, recordPolicy("story-thread", thread.id).priority));
  const researchRecords = relevantResearch.map((item) => {
    const policy = recordPolicy("research-item", item.id);
    return jsonRecord(item.id, item, policy.required || historicalResearchIds.has(item.id), Math.max(policy.priority, historicalResearchIds.has(item.id) ? 90 : 0));
  });
  const sourceRecords = relevantSources.map((source) => {
    const policy = recordPolicy("research-source", source.id);
    return jsonRecord(source.id, source, policy.required || requiredSourceIds.has(source.id), Math.max(policy.priority, requiredSourceIds.has(source.id) ? 90 : 0));
  });
  const historicalRecords: ContextRecord[] = historicalContext && inventionLedger ? [
    jsonRecord(`historical-scene:${packet.chapter}`, {
      risk: packet.profile_fields["historical_risk"],
      pressure: packet.profile_fields["historical_pressure"],
      material_world: packet.profile_fields["material_world"],
      language_conventions: historicalContext.language_conventions,
    }, true, 90),
    ...historicalChronology.map((item) => jsonRecord(item.id, item, true, 90)),
    ...historicalConstraints.map((item) => jsonRecord(item.id, item, true, 90)),
    ...historicalKnowledge.map((item) => jsonRecord(item.id, item, true, 90)),
    ...historicalInventions.map((item) => jsonRecord(item.id, item, true, 90)),
    ...historicalUncertainties.map((item, index) => jsonRecord(`historical-uncertainty:${String(index + 1).padStart(3, "0")}`, item, true, 90)),
  ] : [];
  const previousRecords = textParagraphRecords("previous", previous, 50);
  const profileRuleRecords = profile.draftingRules.map((rule, index) => ({ id: `profile-rule:${String(index + 1).padStart(3, "0")}`, body: rule, required: false, priority: 30 }));
  const voiceProfileRecords = textParagraphRecords("voice-profile", voiceProfileText, 30);
  const bookBibleRecords = textParagraphRecords("book-bible", readText(join(bookRoot, "book-bible.md")) ?? "", 30);

  const sections: ContextSection[] = [
    section("chapter-packet", "Approved chapter packet", [jsonRecord(`chapter-packet:${packet.chapter}`, packet, true, 100)], 12_000),
    section("canon", "Relevant canon facts", factRecords, 7_000),
    section("relationships", "Relevant relationship state", relationshipRecords, 6_000),
    section("threads", "Relevant story threads", threadRecords, 7_000),
    section("research", "Required ready research claims", researchRecords, 8_000),
    section("sources", "Graph-selected research provenance", sourceRecords, 5_000),
    section("historical", "Historical scene contract", historicalRecords, 14_000),
    section("plot", "Plot-grid entry", [jsonRecord(`plot:chapter:${packet.chapter}`, plotEntry, true, 70)], 5_000),
    section("previous", "Previous chapter ending/context", previousRecords, 12_000),
    section("remarkability", "Remarkability contract", [jsonRecord("remarkability:contract", remarkability, false, 30)], 6_000),
    section("profile-rules", "Profile rules", profileRuleRecords, 5_000),
    section("voice-guardrails", "Approved voice guardrails", contextGuardrails ? [{ id: `voice-guardrails:${packet.pov}`, body: contextGuardrails, required: true, priority: 70 }] : [], 6_000),
    section("book-guardrails", "Approved book guardrails", bookGuardrails ? [{ id: "book-guardrails", body: bookGuardrails, required: true, priority: 70 }] : [], 5_000),
    section("voice-profile", "Voice profile excerpt", voiceProfileRecords, 14_000),
    section("book-bible", "Active book bible excerpt", bookBibleRecords, 12_000),
    section("genre", "Genre configuration", [{ id: "genre-configuration", body: readText(join(bookRoot, "genre.yaml")) ?? "", required: false, priority: 30 }], 6_000),
  ];

  const allocation = allocateContext(sections, maxChars);
  const title = `# Drafting Context — Chapter ${packet.chapter}`;
  const text = title + allocation.text;
  const selected = new Set(allocation.report.includedRecordIds);
  const graphIncluded = graphResolution.selections
    .filter((selection) => selection.reason === "graph-discovered" && selected.has(selection.refId))
    .map((selection) => {
      if (selection.type === "canon-fact") return `graph canon ${selection.refId}`;
      if (selection.type === "story-thread") return `graph thread ${selection.refId}`;
      if (selection.type === "research-item") return `graph research ${selection.refId}`;
      if (selection.type === "research-source") return `graph source ${selection.refId}`;
      return `graph relationship ${selection.refId}`;
    });
  const included = [
    ...(selected.has(`chapter-packet:${packet.chapter}`) ? [`chapter packet ${packet.chapter}`] : []),
    ...relevantFacts.filter((fact) => selected.has(fact.id)).map((fact) => `canon ${fact.id}`),
    ...relevantRelationships.filter((relationship) => selected.has(relationship.id)).map((relationship) => `relationship ${relationship.id}`),
    ...relevantThreads.filter((thread) => selected.has(thread.id)).map((thread) => `thread ${thread.id}`),
    ...relevantResearch.filter((item) => selected.has(item.id)).map((item) => `research ${item.id}`),
    ...relevantSources.filter((source) => selected.has(source.id)).map((source) => `source ${source.id}`),
    ...historicalChronology.filter((item) => selected.has(item.id)).map((item) => `historical chronology ${item.id}`),
    ...historicalConstraints.filter((item) => selected.has(item.id)).map((item) => `historical constraint ${item.id}`),
    ...historicalKnowledge.filter((item) => selected.has(item.id)).map((item) => `historical knowledge ${item.id}`),
    ...historicalInventions.filter((item) => selected.has(item.id)).map((item) => `historical invention ${item.id}`),
    ...graphIncluded,
    ...(selected.has("remarkability:contract") ? ["remarkability contract"] : []),
    ...(selected.has(`voice-guardrails:${packet.pov}`) ? ["approved voice guardrails"] : []),
    ...(selected.has("book-guardrails") ? ["approved book guardrails"] : []),
    ...(allocation.report.includedRecordIds.some((id) => id.startsWith("previous:paragraph:"))
      ? [previousPath ? `previous chapter ${previousPath.slice(bookRoot.length + 1)}` : "no previous chapter"]
      : []),
  ];
  const policyExclusions = [
    "unreferenced canon",
    "unreferenced story threads",
    "unrequired research claims",
    ...(historicalContext ? ["unreferenced historical chronology", "unreferenced historical constraints", "unreferenced historical inventions", "unreferenced historical knowledge boundaries"] : []),
    "unapproved book guardrails",
    "non-adjacent chapters",
    "future books",
    "graph-blocked unsafe records",
    "raw public reviews",
    "raw influence references",
    "voice experiment source and variants",
    "reader experiment responses",
    "packaging files",
    "legacy artifacts",
  ];

  return {
    root,
    bookId: project.active_book,
    packet,
    text,
    report: {
      estimatedTokens: Math.ceil(text.length / 4),
      included,
      excluded: [...allocation.report.omittedRecordIds.map((id) => `omitted record ${id}`), ...policyExclusions],
      allocation: allocation.report,
      graph: { maxDepth: graphResolution.maxDepth, selections: graphResolution.selections, blocked: graphResolution.blocked },
    },
  };
}

export function manuscriptWordCount(root: string, bookId?: string): number {
  const project = readProject(root);
  const bookRoot = join(root, "books", bookId ?? project.active_book);
  return listChapterFiles(bookRoot).reduce((total, path) => total + countWords(readText(path) ?? ""), 0);
}
