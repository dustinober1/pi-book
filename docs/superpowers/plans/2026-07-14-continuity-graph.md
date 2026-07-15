# Continuity Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, bounded graph-aware drafting-context selection derived from Novel Forge's existing validated YAML.

**Architecture:** A pure `story-graph.ts` module builds typed nodes and edges from canon, threads, chapter packets, plot entries, and research sources. A two-hop breadth-first resolver applies drafting safety policy and returns selected IDs plus explainable paths. `context-builder.ts` merges safe graph discoveries with explicit packet references without changing project schemas or author-facing commands.

**Tech Stack:** TypeScript 5.9, Node.js 22/24, built-in `node:test`, existing TypeBox domain types, no new dependencies.

## Global Constraints

- Canonical YAML remains the only source of truth.
- The graph is in-memory, deterministic, derived, and disposable.
- No schema version change.
- No external graph database, embeddings, Python, or hosted service.
- Drafting traversal is breadth-first and limited to at most two edges.
- Chapter and research-source nodes are terminal and cannot act as hubs.
- Auto-discovered facts and relationships must be locked.
- Auto-discovered threads must be open or advanced.
- Auto-discovered `book-NN` facts cannot come from a book later than the active book.
- Existing explicit packet references retain current behavior.
- Full typecheck, unit/e2e tests, and fixture evaluation must pass.

---

### Task 1: Specify graph construction and safe traversal with failing tests

**Files:**
- Create: `tests/story-graph.test.ts`

**Interfaces:**
- Consumes: existing `CanonState`, `StoryThreadsState`, `ChapterQueueState`, `PlotGridState`, `SourceRegisterState`, and `ChapterPacket` domain types.
- Produces expectations for `buildStoryGraph(input)` and `resolveDraftingGraphContext(graph, packet, options)`.

- [ ] **Step 1: Write tests for character-linked discovery**

Create fixtures where Chapter 3 explicitly references character `Mara` and fact `CAN-1`, while locked fact `CAN-2`, locked relationship `REL-1`, and open thread `ST-2` are connected to Mara but not explicitly referenced. Assert that all safe records are selected and every graph discovery has depth, reason, and path.

- [ ] **Step 2: Write tests for policy blocks**

Add provisional fact `CAN-P`, future fact `CAN-F` introduced in `book-02`, provisional relationship `REL-P`, and planned/paid-off/abandoned threads. Assert they are not selected and are listed in `blocked` with stable reasons.

- [ ] **Step 3: Write terminal-node tests**

Make one research source support two unrelated facts and make one prior chapter reference two unrelated facts. Seed only one side. Assert neither the source nor chapter node allows traversal into the unrelated fact.

- [ ] **Step 4: Write determinism and depth tests**

Resolve the same input twice and assert deep equality. Add a safe fact reachable only at depth three and assert it is excluded with default depth two.

- [ ] **Step 5: Run the focused test and verify RED**

Run:

```bash
node --import tsx --test tests/story-graph.test.ts
```

Expected: failure because `src/context/story-graph.ts` does not exist.

- [ ] **Step 6: Commit the failing specification**

```bash
git add tests/story-graph.test.ts
git commit -m "test: specify continuity graph retrieval"
```

### Task 2: Implement the pure story graph module

**Files:**
- Create: `src/context/story-graph.ts`
- Test: `tests/story-graph.test.ts`

**Interfaces:**
- Consumes:

```ts
export interface StoryGraphInput {
  bookId: string;
  canon: CanonState;
  threads: StoryThreadsState;
  queue: ChapterQueueState;
  plot: PlotGridState;
  sources: SourceRegisterState;
}
```

- Produces:

```ts
export function buildStoryGraph(input: StoryGraphInput): StoryGraph;
export function resolveDraftingGraphContext(
  graph: StoryGraph,
  packet: ChapterPacket,
  options?: { maxDepth?: 1 | 2 },
): StoryGraphResolution;
```

- [ ] **Step 1: Define typed nodes, edges, selections, and blocked records**

Use exact node types from the design. Keep maps internal and expose read-only arrays/maps sufficient for testing and resolution.

- [ ] **Step 2: Add deterministic node and edge construction**

Build the known-character set first. Normalize only character/entity IDs. Preserve canonical IDs exactly. Deduplicate edges by `from|type|to|provenance` and sort adjacency lists before traversal.

- [ ] **Step 3: Add safe bounded breadth-first traversal**

Seed exact packet canon/thread/character refs. Traverse undirected adjacency, but do not expand from chapter or research-source nodes. Do not expand through blocked record nodes. Record the first shortest path to every node.

- [ ] **Step 4: Add selection and blocking policy**

Explicit fact/thread seeds are selected regardless of auto-discovery policy. Discovered facts and relationships require `locked`; discovered threads require `open` or `advanced`; future `book-NN` facts are blocked. Return sorted IDs and explainable selection objects.

- [ ] **Step 5: Run focused tests until GREEN**

```bash
node --import tsx --test tests/story-graph.test.ts
npm run typecheck
```

Expected: all story-graph tests pass and typecheck succeeds.

- [ ] **Step 6: Commit graph implementation**

```bash
git add src/context/story-graph.ts tests/story-graph.test.ts
git commit -m "feat: add derived continuity graph"
```

### Task 3: Integrate graph discoveries into chapter context

**Files:**
- Modify: `src/context/context-builder.ts`
- Modify: `tests/context.test.ts`

**Interfaces:**
- Consumes: `buildStoryGraph` and `resolveDraftingGraphContext` from Task 2.
- Produces: an extended `ChapterContext.report.graph` object while preserving `estimatedTokens`, `included`, and `excluded`.

- [ ] **Step 1: Add failing integration tests**

Extend the fixture with:

```yaml
- id: CAN-3
  category: injury
  subject: Mara
  fact: right knee bruised
  source: chapter-01
  status: locked
  introduced_in: book-01
```

Do not add `CAN-3` to `continuity_refs`. Assert it appears in context through graph discovery, an unrelated fact remains absent, and the graph report contains a path from Mara to `CAN-3`.

Add an unreferenced provisional Mara fact and assert it is absent and blocked. Add a directly referenced provisional fact and assert direct references retain existing behavior.

- [ ] **Step 2: Run context test and verify RED**

```bash
node --import tsx --test tests/context.test.ts
```

Expected: failure because graph discovery is not yet integrated.

- [ ] **Step 3: Merge selected graph IDs with explicit arrays**

Build the graph after existing packet validation. Resolve it for the selected packet. Merge records by exact ID while preserving source-file order.

- [ ] **Step 4: Add optional source provenance section and report**

Add a `Graph-selected research provenance` section only when selected source IDs are non-empty. Extend the report with:

```ts
graph: {
  maxDepth: 2;
  selections: StoryGraphSelection[];
  blocked: StoryGraphBlockedSelection[];
}
```

Add graph-discovered labels to `included` and graph policy boundaries to `excluded`.

- [ ] **Step 5: Run focused and full tests**

```bash
node --import tsx --test tests/story-graph.test.ts tests/context.test.ts
npm run typecheck
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit integration**

```bash
git add src/context/context-builder.ts tests/context.test.ts
git commit -m "feat: use continuity graph in drafting context"
```

### Task 4: Document behavior and verify release quality

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: final behavior from Tasks 2 and 3.
- Produces: user-facing explanation without exposing infrastructure complexity as a required workflow.

- [ ] **Step 1: Document graph-aware context**

Add a concise README section explaining that `/novel-draft` derives a local continuity graph from approved YAML, follows at most two safe links, records why context was selected, and does not require external services.

- [ ] **Step 2: Add changelog entry**

Record graph-aware context discovery, policy safeguards, provenance reporting, and the absence of new runtime dependencies.

- [ ] **Step 3: Run complete verification**

```bash
npm ci
npm run typecheck
npm test
npm run eval
npm pack --dry-run
```

Expected: zero failures; package contents include `src/context/story-graph.ts` and exclude tests/docs as governed by the existing `files` list.

- [ ] **Step 4: Review the final diff**

Confirm there are no schema changes, no new dependencies, no generated project-state files, and no unrelated refactors.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: explain graph-aware continuity context"
```
