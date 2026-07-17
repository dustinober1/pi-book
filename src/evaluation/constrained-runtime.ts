import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import {
  ChapterPacketSchema,
  GenreConfigSchema,
  PlotGridSchema,
  ProfileIdSchema,
  assertSchema,
  type ChapterPacket,
  type GenreConfig,
  type PlotGridState,
  type ProfileId,
} from "../domain/schemas.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import { buildChapterContext } from "../context/context-builder.js";
import { bookPlanPrompt, draftPrompt, revisionPrompt } from "../application/prompts.js";
import { estimateInputTokens } from "../application/run-telemetry.js";
import { countWords } from "../infrastructure/files.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { initializeProject, readProject } from "../project/store.js";
import { getProfile } from "../profiles/index.js";
import { regressionChecklist, synthesizeTickets, type ReviewFinding } from "../review/review.js";

interface ArchitectureFixture {
  schema_version: "1.0.0";
  profile: ProfileId;
  project_type: "standalone" | "series";
  genre: GenreConfig;
  packet: ChapterPacket;
  plot: PlotGridState;
  sample_chapter: string;
  review_finding: ReviewFinding;
}

export interface ConstrainedRuntimeBenchmarkResult {
  scenario: string;
  runtimeProfile: RuntimeProfileId;
  promptChars: number;
  contextChars: number;
  estimatedInputTokens: number;
  stageSuccess: boolean;
  validationResult: "pass" | "fail";
  changedFileCount: number;
  changedBytes: number;
  elapsedMs: number;
  rssBytes: number;
}

export type DeterministicBenchmarkResult = Omit<ConstrainedRuntimeBenchmarkResult, "elapsedMs" | "rssBytes">;

const fixtureScenarios = [
  { scenario: "thriller-standalone-planning", directory: "thriller-standalone" },
  { scenario: "thriller-series-planning", directory: "thriller-series" },
  { scenario: "romantasy-standalone-planning", directory: "romantasy-standalone" },
  { scenario: "romantasy-series-planning", directory: "romantasy-series" },
] as const;

function loadFixture(evalRoot: string, directory: string): ArchitectureFixture {
  return YAML.parse(readFileSync(join(evalRoot, directory, "fixture.yaml"), "utf8")) as ArchitectureFixture;
}

function validateFixture(fixture: ArchitectureFixture): string[] {
  const failures: string[] = [];
  try {
    assertSchema(ProfileIdSchema, fixture.profile, "benchmark profile");
    assertSchema(GenreConfigSchema, fixture.genre, "benchmark genre");
    assertSchema(ChapterPacketSchema, fixture.packet, "benchmark packet");
    assertSchema(PlotGridSchema, fixture.plot, "benchmark plot");
    const profile = getProfile(fixture.profile);
    failures.push(...[
      ...profile.validateGenreConfig(fixture.genre),
      ...profile.validatePacket(fixture.packet),
      ...profile.validatePlot(fixture.plot),
    ].filter((finding) => finding.severity === "blocker" || finding.severity === "high").map((finding) => finding.message));
    if (!fixture.plot.chapters.some((chapter) => chapter.chapter === fixture.packet.chapter)) failures.push("packet chapter is missing from plot grid");
    if (countWords(fixture.sample_chapter) < 45) failures.push("sample chapter is too short");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  return failures;
}

function withSyntheticProject<T>(fixture: ArchitectureFixture, callback: (root: string) => T): T {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-constrained-benchmark-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Constrained Runtime Benchmark",
      projectType: fixture.project_type === "standalone" ? "standalone" : "planned-series",
      profile: fixture.profile,
      runtimeProfile: "full",
    });
    return callback(root);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function normalizedPrompt(prompt: string, root: string): string {
  return prompt.split(root).join("<PROJECT_ROOT>");
}

function planningResult(evalRoot: string, scenario: string, directory: string): ConstrainedRuntimeBenchmarkResult {
  const started = performance.now();
  const fixture = loadFixture(evalRoot, directory);
  const failures = validateFixture(fixture);
  return withSyntheticProject(fixture, (root) => {
    const prompt = normalizedPrompt(bookPlanPrompt(root), root);
    const context = JSON.stringify({ genre: fixture.genre, packet: fixture.packet, plot: fixture.plot });
    const changedBytes = stringifyYaml(fixture.genre).length
      + stringifyYaml(fixture.plot).length
      + stringifyYaml({ schema_version: "1.0.0", active_window: "benchmark", packets: [fixture.packet] }).length;
    return {
      scenario,
      runtimeProfile: "full",
      promptChars: prompt.length,
      contextChars: context.length,
      estimatedInputTokens: estimateInputTokens(prompt.length, context.length),
      stageSuccess: failures.length === 0,
      validationResult: failures.length === 0 ? "pass" : "fail",
      changedFileCount: 3,
      changedBytes,
      elapsedMs: Math.max(0, performance.now() - started),
      rssBytes: process.memoryUsage().rss,
    };
  });
}

function draftingResult(evalRoot: string): ConstrainedRuntimeBenchmarkResult {
  const started = performance.now();
  const fixture = loadFixture(evalRoot, "thriller-standalone");
  const failures = validateFixture(fixture);
  return withSyntheticProject(fixture, (root) => {
    const project = readProject(root);
    project.current_stage = "drafting";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    writeFileSync(join(root, "books", "book-01", "genre.yaml"), stringifyYaml(fixture.genre), "utf8");
    writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml({ ...fixture.plot, decisions: [] }), "utf8");
    writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      active_window: "benchmark",
      packets: [fixture.packet],
    }), "utf8");
    writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      facts: fixture.packet.continuity_refs.map((id) => ({
        id,
        category: "benchmark",
        subject: "Benchmark protagonist",
        fact: `Synthetic locked fact ${id}.`,
        source: "benchmark",
        status: "locked",
        introduced_in: "book-01",
      })),
      relationships: [],
    }), "utf8");
    writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
      schema_version: "1.0.0",
      threads: fixture.packet.story_thread_refs.map((id) => ({
        id,
        type: "benchmark",
        setup: `Synthetic thread ${id}.`,
        reader_knows: "The thread is active.",
        characters_know: {},
        status: "open",
        intended_payoff: "book-01",
        last_advanced_in: null,
      })),
    }), "utf8");
    const context = buildChapterContext(root, fixture.packet.chapter, 72_000, 2);
    const fullPrompt = normalizedPrompt(draftPrompt(context), root);
    const promptChars = Math.max(1, fullPrompt.length - context.text.length);
    return {
      scenario: "drafting-context",
      runtimeProfile: "full",
      promptChars,
      contextChars: context.text.length,
      estimatedInputTokens: estimateInputTokens(promptChars, context.text.length),
      stageSuccess: failures.length === 0,
      validationResult: failures.length === 0 ? "pass" : "fail",
      changedFileCount: 1,
      changedBytes: fixture.sample_chapter.length,
      elapsedMs: Math.max(0, performance.now() - started),
      rssBytes: process.memoryUsage().rss,
    };
  });
}

function revisionResult(evalRoot: string): ConstrainedRuntimeBenchmarkResult {
  const started = performance.now();
  const fixture = loadFixture(evalRoot, "thriller-standalone");
  const failures = validateFixture(fixture);
  return withSyntheticProject(fixture, (root) => {
    const tickets = synthesizeTickets({ schema_version: "1.0.0", tickets: [] }, [fixture.review_finding], 1);
    const ticket = tickets.tickets[0];
    if (!ticket) failures.push("review finding did not synthesize a ticket");
    else if (regressionChecklist(ticket).length <= fixture.review_finding.acceptanceTests.length) failures.push("regression checklist was not expanded");
    const basePrompt = normalizedPrompt(revisionPrompt(root, []), root);
    const fullPrompt = normalizedPrompt(revisionPrompt(root, ticket ? [ticket] : []), root);
    const contextChars = Math.max(1, fullPrompt.length - basePrompt.length);
    const changedBytes = stringifyYaml(tickets).length;
    return {
      scenario: "revision-ticket",
      runtimeProfile: "full",
      promptChars: basePrompt.length,
      contextChars,
      estimatedInputTokens: estimateInputTokens(basePrompt.length, contextChars),
      stageSuccess: failures.length === 0,
      validationResult: failures.length === 0 ? "pass" : "fail",
      changedFileCount: 1,
      changedBytes,
      elapsedMs: Math.max(0, performance.now() - started),
      rssBytes: process.memoryUsage().rss,
    };
  });
}

export function runConstrainedRuntimeBenchmark(evalRoot: string): ConstrainedRuntimeBenchmarkResult[] {
  return [
    ...fixtureScenarios.map(({ scenario, directory }) => planningResult(evalRoot, scenario, directory)),
    draftingResult(evalRoot),
    revisionResult(evalRoot),
  ];
}

export function deterministicBenchmarkView(results: ConstrainedRuntimeBenchmarkResult[]): DeterministicBenchmarkResult[] {
  return results.map(({ elapsedMs: _elapsedMs, rssBytes: _rssBytes, ...result }) => result);
}

export function benchmarkReportJson(results: ConstrainedRuntimeBenchmarkResult[]): string {
  return `${JSON.stringify({ schemaVersion: "1.0.0", results }, null, 2)}\n`;
}
