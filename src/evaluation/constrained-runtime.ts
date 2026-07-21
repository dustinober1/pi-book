import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { preparePrompt } from "../application/prepared-prompt.js";
import { compilePrompt } from "../application/prompt-compiler.js";
import { projectStateHash } from "../application/events.js";
import { bookPlanPrompt, revisionPrompt } from "../application/prompts.js";
import { estimateInputTokens } from "../application/run-telemetry.js";
import { draftStageSpec } from "../application/stage-specs/index.js";
import type { StageSpec } from "../application/stage-specs/types.js";
import { allocateContext, type ContextRecord } from "../context/context-budget.js";
import { buildChapterContext } from "../context/context-builder.js";
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
import { RUNTIME_PROFILES, type RuntimeProfile, type RuntimeProfileId } from "../domain/runtime-profile.js";
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

export interface BoundaryScenarioResult {
  profile: RuntimeProfileId;
  instructionChars: number;
  evidenceChars: number;
  requiredRecords: number;
  includedRecords: number;
  omittedOptionalRecords: number;
  passed: boolean;
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
    const context = buildChapterContext(root, fixture.packet.chapter, RUNTIME_PROFILES.full.modelBudget.maxEvidenceChars, 2);
    const prepared = preparePrompt(draftStageSpec({
      root,
      bookId: "book-01",
      chapter: fixture.packet.chapter,
      estimatedTokens: context.report.estimatedTokens,
      excluded: context.report.excluded,
      projectHash: projectStateHash(root),
    }), context.text, RUNTIME_PROFILES.full);
    return {
      scenario: "drafting-context",
      runtimeProfile: "full",
      promptChars: prepared.instructionChars,
      contextChars: prepared.evidenceChars,
      estimatedInputTokens: prepared.estimatedInputTokens,
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

function boundaryStageSpec(fillerLength: number): StageSpec {
  return {
    id: "context-boundary",
    role: "a deterministic runtime-boundary verifier",
    objective: "Verify that normative instructions remain complete near the configured limit.",
    inputs: ["canonical project state"],
    must: [`Preserve this boundary instruction exactly: ${"I".repeat(fillerLength)}`],
    avoid: ["Truncate normative instructions."],
    outputs: ["one complete boundary result"],
    validation: ["Every instruction remains present."],
    toolRules: ["Do not mutate project state."],
  };
}

function nearInstructionSpec(profile: RuntimeProfile): StageSpec {
  const target = profile.modelBudget.maxInstructionChars - 50;
  let low = 0;
  let high = target;
  let best = boundaryStageSpec(0);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = boundaryStageSpec(middle);
    try {
      const compiled = compilePrompt(candidate, profile);
      if (compiled.characterCount <= target) {
        best = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    } catch {
      high = middle - 1;
    }
  }
  return best;
}

function boundaryEvidence(profile: RuntimeProfile): ReturnType<typeof allocateContext> & { requiredRecords: number } {
  const target = profile.modelBudget.maxEvidenceChars - 50;
  const fixed: ContextRecord[] = [
    { id: "BOUNDARY-REQ-001", body: "A".repeat(113), required: true, priority: 100 },
    { id: "BOUNDARY-REQ-002", body: "B".repeat(251), required: true, priority: 99 },
    { id: "BOUNDARY-REQ-003", body: "C".repeat(389), required: true, priority: 98 },
    { id: "BOUNDARY-REQ-004", body: "D".repeat(521), required: true, priority: 97 },
  ];
  let low = 1;
  let high = target;
  let bestLength = 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    try {
      allocateContext([{
        id: "boundary",
        title: "Boundary evidence",
        maxChars: profile.modelBudget.maxEvidenceChars,
        records: [...fixed, { id: "BOUNDARY-REQ-005", body: "E".repeat(middle), required: true, priority: 96 }],
      }], target);
      bestLength = middle;
      low = middle + 1;
    } catch {
      high = middle - 1;
    }
  }
  const required = [...fixed, { id: "BOUNDARY-REQ-005", body: "E".repeat(bestLength), required: true, priority: 96 }];
  const allocation = allocateContext([{
    id: "boundary",
    title: "Boundary evidence",
    maxChars: profile.modelBudget.maxEvidenceChars,
    records: [
      ...required,
      { id: "BOUNDARY-OPTIONAL-001", body: "O".repeat(600), required: false, priority: 1 },
    ],
  }], profile.modelBudget.maxEvidenceChars);
  return { ...allocation, requiredRecords: required.length };
}

export function runContextBoundaryBenchmark(): BoundaryScenarioResult[] {
  return (Object.values(RUNTIME_PROFILES) as RuntimeProfile[]).map((profile) => {
    const spec = nearInstructionSpec(profile);
    const evidence = boundaryEvidence(profile);
    const prepared = preparePrompt(spec, evidence.text, profile);
    const includedRequired = evidence.report.includedRecordIds.filter((id) => id.startsWith("BOUNDARY-REQ-")).length;
    const omittedOptionalRecords = evidence.report.omittedRecordIds.filter((id) => id.startsWith("BOUNDARY-OPTIONAL-")).length;
    return {
      profile: profile.id,
      instructionChars: prepared.instructionChars,
      evidenceChars: prepared.evidenceChars,
      requiredRecords: evidence.requiredRecords,
      includedRecords: includedRequired,
      omittedOptionalRecords,
      passed: prepared.instructionChars <= profile.modelBudget.maxInstructionChars
        && prepared.evidenceChars <= profile.modelBudget.maxEvidenceChars
        && evidence.requiredRecords === includedRequired,
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

export function benchmarkReportJson(
  results: ConstrainedRuntimeBenchmarkResult[],
  boundaries: BoundaryScenarioResult[] = runContextBoundaryBenchmark(),
): string {
  return `${JSON.stringify({ schemaVersion: "1.0.0", results, boundaries }, null, 2)}\n`;
}
