# Derived Continuity Graph Design

## Purpose

Add graph-aware context selection to Novel Forge without introducing a graph database, embeddings, automatic canon extraction, or a second source of truth. The graph is rebuilt in memory from validated project YAML and is disposable.

The first release improves chapter drafting context. It discovers bounded indirect dependencies that a chapter packet did not explicitly list while preserving the package's existing context budget, provenance, future-book boundaries, and human-controlled canon.

## Goals

- Build a deterministic in-memory graph from `canon.yaml`, `story-threads.yaml`, `chapter-queue.yaml`, `plot-grid.yaml`, and `source-register.yaml`.
- Seed retrieval from the active chapter packet's explicit canon, thread, and character references.
- Traverse at most two edges for drafting context.
- Auto-include only safe graph discoveries:
  - locked canon facts;
  - locked relationships;
  - open or advanced story threads;
  - supporting research sources and provenance chapters as terminal context evidence.
- Keep explicitly referenced provisional facts and other explicitly referenced records available under the existing validation rules.
- Prevent future-book canon from being auto-discovered.
- Explain every graph-selected item with its depth and traversal path.
- Preserve existing author-facing commands and project file formats.

## Non-goals

- Neo4j, a hosted graph service, Python, or a vector database.
- LLM extraction of entities or relationships from manuscript prose.
- Semantic passage retrieval.
- Automatic mutation of canon, threads, chapter packets, or inheritance files.
- Changes to project schemas in this release.
- Unbounded graph traversal or graph community summaries.

## Architecture

### `src/context/story-graph.ts`

A pure TypeScript module owns graph construction and bounded selection.

It exposes:

```ts
export type StoryGraphNodeType =
  | "chapter"
  | "character"
  | "entity"
  | "canon-fact"
  | "relationship"
  | "story-thread"
  | "research-source"
  | "story-element";

export interface StoryGraphInput {
  bookId: string;
  canon: CanonState;
  threads: StoryThreadsState;
  queue: ChapterQueueState;
  plot: PlotGridState;
  sources: SourceRegisterState;
}

export interface StoryGraphResolution {
  factIds: string[];
  relationshipIds: string[];
  threadIds: string[];
  sourceIds: string[];
  selections: StoryGraphSelection[];
  blocked: StoryGraphBlockedSelection[];
}

export function buildStoryGraph(input: StoryGraphInput): StoryGraph;
export function resolveDraftingGraphContext(
  graph: StoryGraph,
  packet: ChapterPacket,
  options?: { maxDepth?: 1 | 2 },
): StoryGraphResolution;
```

Graph nodes retain their canonical reference ID, source path, status, and optional book boundary. Edges retain a typed relationship and provenance string.

### Node construction

- Every chapter packet becomes a chapter node.
- Every packet character, relationship participant, and thread knowledge key contributes to the known-character set.
- Canon facts become canon-fact nodes and connect to a character node when their normalized subject matches a known character; otherwise they connect to an entity node.
- Relationships connect to every participating character.
- Threads connect to each character named in `characters_know` and to a parsed `last_advanced_in` chapter when available.
- Chapter packets connect to their explicit canon, thread, and character references.
- Plot-grid setup and payoff IDs connect chapters to the corresponding known node or to a story-element node.
- Research sources connect to every supported known ID.
- Canon fact `source` and `introduced_in` fields connect to a chapter when they contain a parseable chapter number.

All identifiers are normalized only for internal character/entity node IDs. Canon, relationship, thread, and source IDs remain exact.

### Traversal policy

The resolver performs deterministic breadth-first traversal from the packet's explicit canon, thread, and character seed nodes.

Drafting traversal has these rules:

- Maximum depth defaults to two and cannot exceed two.
- Chapter and research-source nodes are terminal. They may explain provenance but cannot bridge into unrelated records.
- A research source cannot pull in other facts merely because it supports several IDs.
- A chapter cannot pull in every other item referenced by that chapter.
- Explicit seed records are always selected if present in the graph.
- Graph-discovered canon facts must be locked and must not be introduced in a later `book-NN` than the active book.
- Graph-discovered relationships must be locked.
- Graph-discovered threads must be open or advanced.
- Character, entity, chapter, and story-element nodes participate in paths but are not returned as drafting records.
- Blocked candidate records are reported with a reason such as `provisional`, `inactive-thread`, or `future-book`.

Selections are ordered by explicit-before-discovered, then depth, record type, and reference ID. Rebuilding the same graph from the same YAML yields the same result and order.

## Context-builder integration

`buildChapterContext` continues to parse and validate the same files. After packet validation it builds the story graph and resolves graph context for the selected packet.

The existing directly referenced arrays are replaced with merged arrays keyed by ID:

- explicitly referenced records remain present;
- safe graph discoveries are added;
- no duplicate records are emitted.

The existing context sections and caps remain unchanged. A small optional `Graph-selected research provenance` section lists discovered source records only when sources were selected.

The context report gains a `graph` object containing:

- `maxDepth`;
- `selections`, including record type, reference ID, depth, reason, and readable path;
- `blocked`, including reference ID and policy reason.

The existing `included` and `excluded` arrays remain for backward compatibility. Graph-discovered record labels are added to `included`, and graph policy boundaries are added to `excluded`.

## Safety and failure behavior

- Missing references continue to be handled by the existing packet reference validator.
- A graph edge targeting an unknown ID is ignored unless it is a plot setup/payoff, in which case a terminal story-element node is created.
- Malformed chapter labels simply do not create chapter-provenance edges.
- Graph construction never writes project files.
- Graph traversal never changes statuses or resolves conflicts.
- The graph cannot reveal a later-book canon fact through auto-discovery.

## Testing

Unit tests cover:

- graph discovery of an unreferenced locked fact about a referenced character;
- discovery of a locked relationship and active thread;
- exclusion and reporting of provisional facts and relationships;
- exclusion and reporting of future-book facts;
- exclusion and reporting of planned, paid-off, and abandoned threads;
- terminal source and chapter nodes preventing hub traversal;
- deterministic ordering and two-hop depth enforcement.

Context integration tests cover:

- graph-discovered facts appearing in drafting context;
- unrelated facts remaining excluded;
- graph provenance appearing in the report;
- direct provisional references remaining available while unreferenced provisional facts stay blocked.

The repository's full `npm run typecheck`, `npm test`, and `npm run eval` suites must pass on Node 22 and Node 24 before merge.
