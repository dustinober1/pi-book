import type {
  CanonState,
  ChapterPacket,
  ChapterQueueState,
  PlotGridState,
  SourceRegisterState,
  StoryThreadsState,
} from "../domain/schemas.js";

export type StoryGraphNodeType =
  | "chapter"
  | "character"
  | "entity"
  | "canon-fact"
  | "relationship"
  | "story-thread"
  | "research-source"
  | "story-element";

export type StoryGraphRecordNodeType =
  | "canon-fact"
  | "relationship"
  | "story-thread"
  | "research-source";

export type StoryGraphEdgeType =
  | "features-character"
  | "references"
  | "concerns"
  | "involves"
  | "known-by"
  | "last-advanced-in"
  | "sourced-from"
  | "requires-source"
  | "sets-up"
  | "pays-off"
  | "supports";

export type StoryGraphBlockReason = "provisional" | "future-book" | "inactive-thread";

export interface StoryGraphNode {
  id: string;
  type: StoryGraphNodeType;
  refId: string;
  label: string;
  sourcePath: string;
  status?: string;
  introducedIn?: string | null;
}

export interface StoryGraphNeighbor {
  nodeId: string;
  edgeType: StoryGraphEdgeType;
  provenance: string;
}

export interface StoryGraph {
  bookId: string;
  nodes: ReadonlyMap<string, StoryGraphNode>;
  adjacency: ReadonlyMap<string, readonly StoryGraphNeighbor[]>;
  referenceIndex: ReadonlyMap<string, readonly string[]>;
}

export interface StoryGraphInput {
  bookId: string;
  canon: CanonState;
  threads: StoryThreadsState;
  queue: ChapterQueueState;
  plot: PlotGridState;
  sources: SourceRegisterState;
}

export interface StoryGraphSelection {
  nodeId: string;
  refId: string;
  type: StoryGraphRecordNodeType;
  depth: number;
  reason: "explicit" | "graph-discovered";
  path: string[];
  sourcePath: string;
}

export interface StoryGraphBlockedSelection {
  nodeId: string;
  refId: string;
  type: Exclude<StoryGraphRecordNodeType, "research-source">;
  depth: number;
  reason: StoryGraphBlockReason;
  path: string[];
  sourcePath: string;
}

export interface StoryGraphResolution {
  maxDepth: 1 | 2;
  factIds: string[];
  relationshipIds: string[];
  threadIds: string[];
  sourceIds: string[];
  selections: StoryGraphSelection[];
  blocked: StoryGraphBlockedSelection[];
}

interface MutableGraph {
  bookId: string;
  nodes: Map<string, StoryGraphNode>;
  adjacency: Map<string, StoryGraphNeighbor[]>;
  referenceIndex: Map<string, string[]>;
  edgeKeys: Set<string>;
}

interface Visit {
  nodeId: string;
  depth: number;
  path: string[];
}

const RECORD_TYPES = new Set<StoryGraphNodeType>([
  "canon-fact",
  "relationship",
  "story-thread",
  "research-source",
]);

const TERMINAL_TYPES = new Set<StoryGraphNodeType>([
  "chapter",
  "research-source",
  "story-element",
]);

const TYPE_ORDER: Record<StoryGraphRecordNodeType, number> = {
  "canon-fact": 0,
  relationship: 1,
  "story-thread": 2,
  "research-source": 3,
};

function normalizeEntity(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

function characterNodeId(name: string): string {
  return `character:${normalizeEntity(name)}`;
}

function entityNodeId(subject: string): string {
  return `entity:${normalizeEntity(subject)}`;
}

function chapterNodeId(chapter: number): string {
  return `chapter:${chapter}`;
}

function canonFactNodeId(id: string): string {
  return `canon-fact:${id}`;
}

function relationshipNodeId(id: string): string {
  return `relationship:${id}`;
}

function storyThreadNodeId(id: string): string {
  return `story-thread:${id}`;
}

function researchSourceNodeId(id: string): string {
  return `research-source:${id}`;
}

function storyElementNodeId(id: string): string {
  return `story-element:${id}`;
}

function chapterNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(?:^|[^a-z0-9])chapter[-_ .]*0*(\d+)(?:[^0-9]|$)/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function bookNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^book-(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function addNode(graph: MutableGraph, node: StoryGraphNode): void {
  if (!graph.nodes.has(node.id)) graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) graph.adjacency.set(node.id, []);

  const indexed = graph.referenceIndex.get(node.refId) ?? [];
  if (!indexed.includes(node.id)) {
    indexed.push(node.id);
    indexed.sort();
    graph.referenceIndex.set(node.refId, indexed);
  }
}

function addEdge(
  graph: MutableGraph,
  from: string,
  to: string,
  edgeType: StoryGraphEdgeType,
  provenance: string,
): void {
  if (from === to || !graph.nodes.has(from) || !graph.nodes.has(to)) return;
  const key = [from, edgeType, to, provenance].join("|");
  const reverseKey = [to, edgeType, from, provenance].join("|");
  if (graph.edgeKeys.has(key) || graph.edgeKeys.has(reverseKey)) return;

  graph.edgeKeys.add(key);
  graph.edgeKeys.add(reverseKey);
  graph.adjacency.get(from)?.push({ nodeId: to, edgeType, provenance });
  graph.adjacency.get(to)?.push({ nodeId: from, edgeType, provenance });
}

function ensureChapterNode(graph: MutableGraph, bookId: string, chapter: number): string {
  const id = chapterNodeId(chapter);
  addNode(graph, {
    id,
    type: "chapter",
    refId: `chapter-${String(chapter).padStart(2, "0")}`,
    label: `Chapter ${chapter}`,
    sourcePath: `books/${bookId}/chapter-queue.yaml#chapter-${chapter}`,
  });
  return id;
}

function knownReferenceNodeIds(graph: MutableGraph, refId: string): string[] {
  return [...(graph.referenceIndex.get(refId) ?? [])]
    .filter((nodeId) => graph.nodes.get(nodeId)?.type !== "story-element")
    .sort();
}

function ensureStoryElementNode(graph: MutableGraph, bookId: string, refId: string): string {
  const existing = graph.referenceIndex.get(refId)?.find((nodeId) => graph.nodes.get(nodeId)?.type === "story-element");
  if (existing) return existing;

  const id = storyElementNodeId(refId);
  addNode(graph, {
    id,
    type: "story-element",
    refId,
    label: refId,
    sourcePath: `books/${bookId}/plot-grid.yaml#${refId}`,
  });
  return id;
}

function sortGraph(graph: MutableGraph): StoryGraph {
  for (const neighbors of graph.adjacency.values()) {
    neighbors.sort((a, b) =>
      a.nodeId.localeCompare(b.nodeId)
      || a.edgeType.localeCompare(b.edgeType)
      || a.provenance.localeCompare(b.provenance),
    );
  }
  return {
    bookId: graph.bookId,
    nodes: graph.nodes,
    adjacency: graph.adjacency,
    referenceIndex: graph.referenceIndex,
  };
}

export function buildStoryGraph(input: StoryGraphInput): StoryGraph {
  const graph: MutableGraph = {
    bookId: input.bookId,
    nodes: new Map(),
    adjacency: new Map(),
    referenceIndex: new Map(),
    edgeKeys: new Set(),
  };

  const knownCharacters = new Map<string, string>();
  const rememberCharacter = (name: string): void => {
    const normalized = normalizeEntity(name);
    if (!knownCharacters.has(normalized)) knownCharacters.set(normalized, name.trim() || name);
  };

  for (const packet of input.queue.packets) {
    for (const character of packet.character_refs) rememberCharacter(character);
  }
  for (const relationship of input.canon.relationships) {
    for (const character of relationship.characters) rememberCharacter(character);
  }
  for (const thread of input.threads.threads) {
    for (const character of Object.keys(thread.characters_know)) rememberCharacter(character);
  }

  for (const packet of input.queue.packets) ensureChapterNode(graph, input.bookId, packet.chapter);

  for (const [normalized, label] of [...knownCharacters.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    addNode(graph, {
      id: `character:${normalized}`,
      type: "character",
      refId: label,
      label,
      sourcePath: "derived:known-character",
    });
  }

  for (const fact of input.canon.facts) {
    addNode(graph, {
      id: canonFactNodeId(fact.id),
      type: "canon-fact",
      refId: fact.id,
      label: fact.fact,
      sourcePath: `series/canon.yaml#facts.${fact.id}`,
      status: fact.status,
      introducedIn: fact.introduced_in,
    });
  }

  for (const relationship of input.canon.relationships) {
    addNode(graph, {
      id: relationshipNodeId(relationship.id),
      type: "relationship",
      refId: relationship.id,
      label: relationship.state,
      sourcePath: `series/canon.yaml#relationships.${relationship.id}`,
      status: relationship.status,
    });
  }

  for (const thread of input.threads.threads) {
    addNode(graph, {
      id: storyThreadNodeId(thread.id),
      type: "story-thread",
      refId: thread.id,
      label: thread.setup,
      sourcePath: `series/story-threads.yaml#threads.${thread.id}`,
      status: thread.status,
    });
  }

  for (const source of input.sources.sources) {
    addNode(graph, {
      id: researchSourceNodeId(source.id),
      type: "research-source",
      refId: source.id,
      label: source.title,
      sourcePath: `research/source-register.yaml#sources.${source.id}`,
    });
  }

  for (const fact of input.canon.facts) {
    const subjectKey = normalizeEntity(fact.subject);
    const subjectNode = knownCharacters.has(subjectKey)
      ? characterNodeId(fact.subject)
      : entityNodeId(fact.subject);
    addNode(graph, {
      id: subjectNode,
      type: knownCharacters.has(subjectKey) ? "character" : "entity",
      refId: fact.subject,
      label: fact.subject,
      sourcePath: knownCharacters.has(subjectKey) ? "derived:known-character" : "derived:canon-subject",
    });
    addEdge(graph, canonFactNodeId(fact.id), subjectNode, "concerns", `series/canon.yaml#facts.${fact.id}.subject`);

    const sourceChapter = chapterNumber(fact.source);
    if (sourceChapter !== null) {
      const chapterId = ensureChapterNode(graph, input.bookId, sourceChapter);
      addEdge(graph, canonFactNodeId(fact.id), chapterId, "sourced-from", `series/canon.yaml#facts.${fact.id}.source`);
    }
  }

  for (const relationship of input.canon.relationships) {
    for (const character of relationship.characters) {
      const characterId = characterNodeId(character);
      addNode(graph, {
        id: characterId,
        type: "character",
        refId: character,
        label: character,
        sourcePath: "derived:known-character",
      });
      addEdge(
        graph,
        relationshipNodeId(relationship.id),
        characterId,
        "involves",
        `series/canon.yaml#relationships.${relationship.id}.characters`,
      );
    }
  }

  for (const thread of input.threads.threads) {
    for (const character of Object.keys(thread.characters_know)) {
      const characterId = characterNodeId(character);
      addNode(graph, {
        id: characterId,
        type: "character",
        refId: character,
        label: character,
        sourcePath: "derived:known-character",
      });
      addEdge(
        graph,
        storyThreadNodeId(thread.id),
        characterId,
        "known-by",
        `series/story-threads.yaml#threads.${thread.id}.characters_know`,
      );
    }

    const advancedChapter = chapterNumber(thread.last_advanced_in);
    if (advancedChapter !== null) {
      const chapterId = ensureChapterNode(graph, input.bookId, advancedChapter);
      addEdge(
        graph,
        storyThreadNodeId(thread.id),
        chapterId,
        "last-advanced-in",
        `series/story-threads.yaml#threads.${thread.id}.last_advanced_in`,
      );
    }
  }

  for (const packet of input.queue.packets) {
    const chapterId = ensureChapterNode(graph, input.bookId, packet.chapter);
    for (const character of packet.character_refs) {
      addEdge(
        graph,
        chapterId,
        characterNodeId(character),
        "features-character",
        `books/${input.bookId}/chapter-queue.yaml#chapter-${packet.chapter}.character_refs`,
      );
    }
    for (const ref of packet.continuity_refs) {
      for (const target of [canonFactNodeId(ref), relationshipNodeId(ref)]) {
        if (graph.nodes.has(target)) {
          addEdge(
            graph,
            chapterId,
            target,
            "references",
            `books/${input.bookId}/chapter-queue.yaml#chapter-${packet.chapter}.continuity_refs`,
          );
        }
      }
    }
    for (const ref of packet.story_thread_refs) {
      const target = storyThreadNodeId(ref);
      if (graph.nodes.has(target)) {
        addEdge(
          graph,
          chapterId,
          target,
          "references",
          `books/${input.bookId}/chapter-queue.yaml#chapter-${packet.chapter}.story_thread_refs`,
        );
      }
    }
    for (const ref of packet.required_research) {
      const target = researchSourceNodeId(ref);
      if (graph.nodes.has(target)) {
        addEdge(
          graph,
          chapterId,
          target,
          "requires-source",
          `books/${input.bookId}/chapter-queue.yaml#chapter-${packet.chapter}.required_research`,
        );
      }
    }
  }

  for (const entry of input.plot.chapters) {
    const chapterId = ensureChapterNode(graph, input.bookId, entry.chapter);
    for (const ref of entry.setup_ids) {
      const targets = knownReferenceNodeIds(graph, ref);
      const resolved = targets.length ? targets : [ensureStoryElementNode(graph, input.bookId, ref)];
      for (const target of resolved) {
        addEdge(
          graph,
          chapterId,
          target,
          "sets-up",
          `books/${input.bookId}/plot-grid.yaml#chapter-${entry.chapter}.setup_ids`,
        );
      }
    }
    for (const ref of entry.payoff_ids) {
      const targets = knownReferenceNodeIds(graph, ref);
      const resolved = targets.length ? targets : [ensureStoryElementNode(graph, input.bookId, ref)];
      for (const target of resolved) {
        addEdge(
          graph,
          chapterId,
          target,
          "pays-off",
          `books/${input.bookId}/plot-grid.yaml#chapter-${entry.chapter}.payoff_ids`,
        );
      }
    }
  }

  for (const source of input.sources.sources) {
    const sourceId = researchSourceNodeId(source.id);
    for (const ref of source.supports) {
      for (const target of knownReferenceNodeIds(graph, ref)) {
        if (target === sourceId) continue;
        addEdge(
          graph,
          sourceId,
          target,
          "supports",
          `research/source-register.yaml#sources.${source.id}.supports`,
        );
      }
    }
  }

  return sortGraph(graph);
}

function isRecordNode(node: StoryGraphNode): node is StoryGraphNode & { type: StoryGraphRecordNodeType } {
  return RECORD_TYPES.has(node.type);
}

function blockReason(node: StoryGraphNode, activeBookId: string): StoryGraphBlockReason | null {
  if (node.type === "canon-fact") {
    if (node.status !== "locked") return "provisional";
    const introduced = bookNumber(node.introducedIn);
    const active = bookNumber(activeBookId);
    if (introduced !== null && active !== null && introduced > active) return "future-book";
    return null;
  }
  if (node.type === "relationship") return node.status === "locked" ? null : "provisional";
  if (node.type === "story-thread") return node.status === "open" || node.status === "advanced" ? null : "inactive-thread";
  return null;
}

function selectionFor(node: StoryGraphNode, visit: Visit, reason: StoryGraphSelection["reason"]): StoryGraphSelection {
  if (!isRecordNode(node)) throw new Error(`Cannot select non-record graph node ${node.id}.`);
  return {
    nodeId: node.id,
    refId: node.refId,
    type: node.type,
    depth: visit.depth,
    reason,
    path: visit.path,
    sourcePath: node.sourcePath,
  };
}

function blockedSelectionFor(
  node: StoryGraphNode,
  visit: Visit,
  reason: StoryGraphBlockReason,
): StoryGraphBlockedSelection {
  if (node.type !== "canon-fact" && node.type !== "relationship" && node.type !== "story-thread") {
    throw new Error(`Cannot block unsupported graph node ${node.id}.`);
  }
  return {
    nodeId: node.id,
    refId: node.refId,
    type: node.type,
    depth: visit.depth,
    reason,
    path: visit.path,
    sourcePath: node.sourcePath,
  };
}

function compareSelections(a: StoryGraphSelection, b: StoryGraphSelection): number {
  const explicitOrder = (value: StoryGraphSelection): number => value.reason === "explicit" ? 0 : 1;
  return explicitOrder(a) - explicitOrder(b)
    || a.depth - b.depth
    || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
    || a.refId.localeCompare(b.refId)
    || a.nodeId.localeCompare(b.nodeId);
}

function compareBlocked(a: StoryGraphBlockedSelection, b: StoryGraphBlockedSelection): number {
  return a.depth - b.depth
    || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
    || a.refId.localeCompare(b.refId)
    || a.nodeId.localeCompare(b.nodeId);
}

function explicitSeedNodeIds(graph: StoryGraph, packet: ChapterPacket): Set<string> {
  const ids = new Set<string>();
  for (const ref of packet.continuity_refs) {
    for (const candidate of [canonFactNodeId(ref), relationshipNodeId(ref)]) {
      if (graph.nodes.has(candidate)) ids.add(candidate);
    }
  }
  for (const ref of packet.story_thread_refs) {
    const candidate = storyThreadNodeId(ref);
    if (graph.nodes.has(candidate)) ids.add(candidate);
  }
  for (const ref of packet.required_research) {
    const candidate = researchSourceNodeId(ref);
    if (graph.nodes.has(candidate)) ids.add(candidate);
  }
  return ids;
}

export function resolveDraftingGraphContext(
  graph: StoryGraph,
  packet: ChapterPacket,
  options?: { maxDepth?: 1 | 2 },
): StoryGraphResolution {
  const maxDepth = options?.maxDepth ?? 2;
  const explicitRecords = explicitSeedNodeIds(graph, packet);
  const visited = new Map<string, Visit>();
  const queue: Visit[] = [];
  const selections = new Map<string, StoryGraphSelection>();
  const blocked = new Map<string, StoryGraphBlockedSelection>();

  const enqueueSeed = (nodeId: string): void => {
    if (visited.has(nodeId) || !graph.nodes.has(nodeId)) return;
    const visit = { nodeId, depth: 0, path: [nodeId] };
    visited.set(nodeId, visit);
    queue.push(visit);
  };

  for (const character of [...new Set(packet.character_refs.map(characterNodeId))].sort()) enqueueSeed(character);
  for (const nodeId of [...explicitRecords].sort()) {
    enqueueSeed(nodeId);
    const node = graph.nodes.get(nodeId);
    const visit = visited.get(nodeId);
    if (node && visit && isRecordNode(node)) selections.set(nodeId, selectionFor(node, visit, "explicit"));
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const visit = queue[cursor++];
    if (!visit || visit.depth >= maxDepth) continue;
    const current = graph.nodes.get(visit.nodeId);
    if (!current) continue;

    const unsafeExplicit = explicitRecords.has(current.id) && blockReason(current, graph.bookId) !== null;
    if (TERMINAL_TYPES.has(current.type) || unsafeExplicit) continue;

    for (const neighbor of graph.adjacency.get(current.id) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      const node = graph.nodes.get(neighbor.nodeId);
      if (!node) continue;

      const next: Visit = {
        nodeId: node.id,
        depth: visit.depth + 1,
        path: [...visit.path, node.id],
      };
      visited.set(node.id, next);

      if (isRecordNode(node) && !explicitRecords.has(node.id)) {
        const reason = blockReason(node, graph.bookId);
        if (reason !== null) {
          blocked.set(node.id, blockedSelectionFor(node, next, reason));
          continue;
        }
        selections.set(node.id, selectionFor(node, next, "graph-discovered"));
      }

      queue.push(next);
    }
  }

  const orderedSelections = [...selections.values()].sort(compareSelections);
  const orderedBlocked = [...blocked.values()].sort(compareBlocked);
  const idsByType = (type: StoryGraphRecordNodeType): string[] => orderedSelections
    .filter((selection) => selection.type === type)
    .map((selection) => selection.refId);

  return {
    maxDepth,
    factIds: idsByType("canon-fact"),
    relationshipIds: idsByType("relationship"),
    threadIds: idsByType("story-thread"),
    sourceIds: idsByType("research-source"),
    selections: orderedSelections,
    blocked: orderedBlocked,
  };
}
