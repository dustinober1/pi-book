import { existsSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
  CanonSchema,
  ChapterQueueSchema,
  StoryThreadsSchema,
  type CanonState,
  type ChapterQueueState,
  type StoryThreadsState,
} from "../../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../../domain/v1-3-architecture-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../../domain/v1-3-research-schemas.js";
import { ResearchLedgerSchema, VoiceGuardrailsSchema, type ResearchLedger, type VoiceGuardrails } from "../../domain/v1-3-schemas.js";
import { listChapterFiles, listFilesRecursive, readText } from "../../infrastructure/files.js";
import { parseYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import { normalizeDocument } from "./normalize.js";
import { compareDeterministicText } from "./order.js";
import { mechanicalRules } from "./rules/mechanics.js";
import { projectConsistencyRules } from "./rules/project-consistency.js";
import { repetitionRules } from "./rules/repetition.js";
import { stylePatternRules } from "./rules/style-patterns.js";
import type { LintRule, ProjectContextArtifact, ProjectLintContext, ProseLintInput } from "./types.js";

const romanActNumbers = new Map([
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
].map((value, index) => [value.toLocaleLowerCase("en-US"), String(index + 1)]));

function portable(path: string): string {
  return path.replace(/\\/g, "/");
}

function canonicalActLabel(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/^act(?:[\s_-]+)/u, "").trim();
  const arabic = /^\d+$/u.test(normalized) ? Number(normalized) : 0;
  if (Number.isSafeInteger(arabic) && arabic > 0) return String(arabic);
  return romanActNumbers.get(normalized) ?? normalized;
}

function chapterNumber(path: string): number | null {
  const value = Number.parseInt(basename(path).match(/^0*(\d+)(?:[-_ .]|$)/)?.[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function orderedFiles(root: string, files: readonly string[]): Array<{ absolute: string; path: string; number: number | null }> {
  return files.map((absolute) => {
    const path = portable(relative(root, absolute));
    return { absolute, path, number: chapterNumber(path) };
  }).sort((left, right) => {
    if (left.number !== null && right.number !== null && left.number !== right.number) return left.number - right.number;
    if (left.number !== null && right.number === null) return -1;
    if (left.number === null && right.number !== null) return 1;
    return compareDeterministicText(left.path, right.path);
  });
}

function readYaml<T>(path: string, schema: Parameters<typeof parseYaml<T>>[1], fallback: T): T {
  const text = readText(path);
  return text === null ? fallback : parseYaml<T>(text, schema, portable(path));
}

function documentsFor(files: readonly { absolute: string; path: string }[]) {
  return files.map((file, index) => {
    const text = readText(file.absolute);
    if (text === null) throw new Error(`Cannot read prose-lint manuscript: ${file.path}`);
    return normalizeDocument(file.path, text, index + 1);
  });
}

interface ProjectArtifacts {
  canon: CanonState;
  threads: StoryThreadsState;
  sources: SourceRegisterV13;
  research: ResearchLedger;
  queue: ChapterQueueState;
  plot: PlotGridPhase4;
}

function projectArtifacts(root: string, bookId: string, requested: ReadonlySet<ProjectContextArtifact>): ProjectArtifacts {
  const bookRoot = join(root, "books", bookId);
  return {
    canon: requested.has("canon")
      ? readYaml<CanonState>(join(root, "series", "canon.yaml"), CanonSchema, { schema_version: "1.0.0", facts: [], relationships: [] })
      : { schema_version: "1.0.0", facts: [], relationships: [] },
    threads: requested.has("threads")
      ? readYaml<StoryThreadsState>(join(root, "series", "story-threads.yaml"), StoryThreadsSchema, { schema_version: "1.0.0", threads: [] })
      : { schema_version: "1.0.0", threads: [] },
    sources: requested.has("sources")
      ? readYaml<SourceRegisterV13>(join(root, "research", "source-register.yaml"), SourceRegisterV13Schema, { schema_version: "1.0.0", sources: [] })
      : { schema_version: "1.0.0", sources: [] },
    research: requested.has("research")
      ? readYaml<ResearchLedger>(join(bookRoot, "research-ledger.yaml"), ResearchLedgerSchema, { schema_version: "1.0.0", items: [] })
      : { schema_version: "1.0.0", items: [] },
    queue: requested.has("queue")
      ? readYaml<ChapterQueueState>(join(bookRoot, "chapter-queue.yaml"), ChapterQueueSchema, { schema_version: "1.0.0", active_window: "", packets: [] })
      : { schema_version: "1.0.0", active_window: "", packets: [] },
    plot: requested.has("plot")
      ? readYaml<PlotGridPhase4>(join(bookRoot, "plot-grid.yaml"), PlotGridPhase4Schema, { schema_version: "1.0.0", acts: [], chapters: [] })
      : { schema_version: "1.0.0", acts: [], chapters: [] },
  };
}

function contextFor(
  root: string,
  bookId: string,
  chapterFiles: readonly { path: string; number: number | null }[],
  artifacts: ProjectArtifacts,
): ProjectLintContext {
  const { canon, threads, sources, research, queue, plot } = artifacts;
  const canonNames = [...new Set([
    ...canon.facts.map((fact) => fact.subject.trim()),
    ...canon.relationships.flatMap((relationship) => relationship.characters.map((name) => name.trim())),
  ].filter(Boolean))];

  return {
    projectRoot: root,
    bookId,
    chapterFiles,
    canonEntries: canon.facts.map((fact) => ({ id: fact.id, subject: fact.subject, fact: fact.fact, locked: fact.status === "locked" })),
    canonNames,
    canonIds: [...canon.facts.map((fact) => fact.id), ...canon.relationships.map((relationship) => relationship.id)],
    relationships: canon.relationships.map((relationship) => ({ id: relationship.id, characters: [...relationship.characters] })),
    threads: threads.threads.map((thread) => ({ id: thread.id, status: thread.status })),
    threadIds: threads.threads.map((thread) => thread.id),
    sourceIds: sources.sources.map((source) => source.id),
    researchIds: research.items.map((item) => item.id),
    packetReferences: queue.packets.flatMap((packet) => [
      ...packet.continuity_refs.map((id) => ({ chapter: packet.chapter, status: packet.status, kind: "canon" as const, id })),
      ...packet.story_thread_refs.map((id) => ({ chapter: packet.chapter, status: packet.status, kind: "thread" as const, id })),
      ...packet.required_research.map((id) => ({ chapter: packet.chapter, status: packet.status, kind: "source" as const, id })),
    ]),
    plotThreadReferences: plot.chapters.flatMap((chapter) => [...chapter.setup_ids, ...chapter.payoff_ids].map((id) => ({ chapter: chapter.chapter, id }))),
  };
}

function filesForScope(
  files: readonly { absolute: string; path: string; number: number | null }[],
  scope: string | undefined,
  artifacts: ProjectArtifacts,
) {
  const normalized = scope?.trim().toLocaleLowerCase("en-US");
  if (normalized === undefined || normalized === "" || normalized === "manuscript") return [...files];
  if (normalized !== "act" && !/^act(?:[\s_-]+)/u.test(normalized)) return [...files];
  const requestedId = normalized === "act" ? artifacts.queue.active_window.trim() : scope?.trim() ?? "";
  const requestedKey = canonicalActLabel(requestedId);
  const act = artifacts.plot.acts.find((item) => canonicalActLabel(item.id) === requestedKey);
  if (act === undefined) throw new Error(`Cannot resolve prose-lint act scope “${scope}”.`);
  const selected = files.filter((file) => file.number !== null && file.number >= act.start_chapter && file.number <= act.end_chapter);
  if (selected.length === 0) throw new Error(`No numbered Markdown files found for prose-lint act scope “${scope}”.`);
  return selected;
}

function defaultRules() {
  return [
    ...mechanicalRules,
    ...projectConsistencyRules,
    ...repetitionRules,
    ...stylePatternRules,
  ];
}

function requirementsFor(rules: readonly LintRule[]): {
  baselineMetrics: boolean;
  projectContext: boolean;
  artifacts: Set<ProjectContextArtifact>;
} {
  const artifacts = new Set<ProjectContextArtifact>();
  let baselineMetrics = false;
  let projectContext = false;
  for (const rule of rules) {
    baselineMetrics ||= rule.requirements?.baselineMetrics === true;
    if (rule.requirements?.projectContext !== undefined) {
      projectContext = true;
      for (const artifact of rule.requirements.projectContext) artifacts.add(artifact);
    }
  }
  return { baselineMetrics, projectContext, artifacts };
}

function isActScope(scope: string | undefined): boolean {
  const normalized = scope?.trim().toLocaleLowerCase("en-US");
  return normalized === "act" || (normalized !== undefined && /^act(?:[\s_-]+)/u.test(normalized));
}

export function loadProseLintInput(target: string, options: { scope?: string; rules?: readonly LintRule[] } = {}): ProseLintInput {
  const resolved = resolve(target);
  const rules = options.rules ?? defaultRules();
  try {
    if (!statSync(resolved).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error(`Cannot read prose-lint target: ${target}`);
  }

  if (existsSync(join(resolved, "PROJECT.yaml"))) {
    const project = readProject(resolved);
    const book = readBook(resolved, project.active_book);
    const chapterRoot = join(resolved, "books", book.book_id, "manuscript", "chapters");
    const allFiles = orderedFiles(chapterRoot, listChapterFiles(join(resolved, "books", book.book_id)));
    if (allFiles.length === 0) throw new Error(`No Markdown files found for active book ${book.book_id}.`);
    const requirements = requirementsFor(rules);
    if (isActScope(options.scope)) {
      requirements.artifacts.add("queue");
      requirements.artifacts.add("plot");
    }
    const artifacts = projectArtifacts(resolved, book.book_id, requirements.artifacts);
    const files = filesForScope(allFiles, options.scope, artifacts);
    const guardrailText = requirements.baselineMetrics ? readText(join(resolved, "series", "voice-guardrails.yaml")) : null;
    const guardrails = guardrailText === null ? undefined : parseYaml<VoiceGuardrails>(guardrailText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml");
    const acceptedMetrics = guardrails === undefined
      ? []
      : Object.entries(guardrails.baseline.metrics).filter(([, value]) => Number.isFinite(value));
    const baselineAccepted = guardrails?.baseline.path?.trim()
      && guardrails.baseline.content_hash?.trim()
      && acceptedMetrics.length > 0;
    const chapterFiles = allFiles.map(({ path, number }) => ({ path, number }));
    return {
      documents: documentsFor(files),
      ...(baselineAccepted ? { baselineMetrics: Object.fromEntries(acceptedMetrics) } : {}),
      ...(requirements.projectContext ? { projectContext: contextFor(resolved, book.book_id, chapterFiles, artifacts) } : {}),
      rules,
    };
  }

  let markdownFiles: string[];
  try {
    markdownFiles = listFilesRecursive(resolved, (path) => /\.md$/i.test(path));
  } catch {
    throw new Error(`Cannot read prose-lint target: ${target}`);
  }
  if (isActScope(options.scope)) {
    throw new Error(`Prose-lint act scope “${options.scope}” requires Novel Forge project metadata.`);
  }
  const files = orderedFiles(resolved, markdownFiles);
  if (files.length === 0) throw new Error(`No Markdown files found in prose-lint target: ${target}`);
  return { documents: documentsFor(files), rules };
}
