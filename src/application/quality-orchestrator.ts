import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Static, TSchema } from "@sinclair/typebox";
import { buildChapterContext } from "../context/context-builder.js";
import {
  QualityCandidateSelectionSchema,
  QualityDraftCandidateSchema,
  QualityLaneCritiqueSchema,
  QualityScenePlanSchema,
  type QualityCandidateSelection,
  type QualityDraftCandidate,
  type QualityLaneCritique,
  type QualityScenePlan,
} from "../domain/quality-artifacts.js";
import { resolveQualityConfig, type QualityProjectState, type QualityTierId, type ResolvedQualityConfig } from "../domain/quality-profile.js";
import type { ModelCallReport } from "../domain/run-report.js";
import type { QualityThinkingLevel, QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";
import { RUNTIME_PROFILES, type RuntimeProfile, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { RemarkabilitySchema, type RemarkabilityState } from "../domain/schemas.js";
import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";
import { BookStrategyPhase5Schema, type BookStrategyPhase5 } from "../domain/v1-3-audit-schemas.js";
import { HistoricalContextSchema, InventionLedgerSchema, type HistoricalContext, type InventionLedger } from "../domain/historical-fiction.js";
import { readText } from "../infrastructure/files.js";
import { finalizeQualityCache, writeQualityArtifact, type QualityCacheRetention } from "../infrastructure/quality-cache.js";
import { appendModelCallReport, storeRunReport } from "../infrastructure/run-report-store.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { applyNovelEvent, projectStateHash } from "./events.js";
import { normalizedContentHash } from "./model-usage.js";
import {
  parseQualityEventOutput,
  parseQualityVerificationOutput,
  parseStructuredQualityArtifact,
  QualityOutputValidationError,
  type QualityEventOutput,
} from "./quality-output.js";
import {
  candidatePrompt,
  correctionPrompt,
  criticPrompt,
  eventOutputPrompt,
  scenePlanPrompt,
  selectorPrompt,
  verificationPrompt,
  type QualityPromptMetadata,
} from "./quality-prompts.js";
import { assessChapterQualityRisk, buildQualityPassPlan, type ChapterQualityRisk, type QualityPassPlan, type QualityCriticLane } from "./quality-risk.js";
import { createRunReportHeader } from "./run-telemetry.js";
import { resolveWorkerModelBudget } from "../pi/quality-worker.js";

export interface RunQualityDraftInput {
  root: string;
  chapter?: number;
  runtimeProfile: RuntimeProfileId | RuntimeProfile;
  qualityConfig: QualityProjectState | ResolvedQualityConfig;
  worker: QualityWorker;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  signal?: AbortSignal;
  runId?: string;
  cacheRetention?: QualityCacheRetention;
  onProgress?: (name: string) => void;
}

export interface RunQualityDraftResult {
  runId: string;
  chapter: number;
  tier: QualityTierId;
  risk: ChapterQualityRisk;
  plan: QualityPassPlan;
  calls: ModelCallReport[];
  changed: string[];
  projectHash: string;
  gitMessage: string;
  advisories: string[];
}

function runtimeProfile(value: RuntimeProfileId | RuntimeProfile): RuntimeProfile {
  return typeof value === "string" ? RUNTIME_PROFILES[value] : value;
}

function qualityConfig(value: QualityProjectState | ResolvedQualityConfig): ResolvedQualityConfig {
  return "keySceneCandidates" in value ? value : resolveQualityConfig(value);
}

function requireText(root: string, path: string): string {
  const text = readText(join(root, path));
  if (!text) throw new Error(`Quality drafting requires ${path}.`);
  return text;
}

function exactMetadata(value: {
  run_id: string;
  chapter: number;
  source_hashes: string[];
  creation_order: number;
}, expected: QualityPromptMetadata, label: string): void {
  const issues: string[] = [];
  if (value.run_id !== expected.run_id) issues.push(`run_id must be ${expected.run_id}`);
  if (value.chapter !== expected.chapter) issues.push(`chapter must be ${expected.chapter}`);
  if (value.creation_order !== expected.creation_order) issues.push(`creation_order must be ${expected.creation_order}`);
  if (JSON.stringify(value.source_hashes) !== JSON.stringify(expected.source_hashes)) issues.push("source_hashes must match the supplied provenance list");
  if (issues.length) throw new QualityOutputValidationError(label, issues);
}

function parseArtifact<TSchemaValue extends TSchema>(input: {
  text: string;
  schema: TSchemaValue;
  metadata: QualityPromptMetadata;
  label: string;
  extra?: (value: Static<TSchemaValue>) => string[];
}): Static<TSchemaValue> {
  const value = parseStructuredQualityArtifact(input.text, input.schema, input.label);
  exactMetadata(value as never, input.metadata, input.label);
  const issues = input.extra?.(value) ?? [];
  if (issues.length) throw new QualityOutputValidationError(input.label, issues);
  return value;
}

function errorIssues(error: unknown): string[] {
  if (error instanceof QualityOutputValidationError) return error.issues;
  return [error instanceof Error ? error.message : "Unknown validation failure."];
}

function approvedLearningGuardrail(strategy: BookStrategyPhase5): boolean {
  return (strategy.revision_learning_guardrails ?? []).some((item) => item.status === "approved");
}

function runReportPath(root: string, runId: string): string {
  return join(root, ".pi-book", "runs", runId, "run-report.json");
}

export async function runQualityDraft(input: RunQualityDraftInput): Promise<RunQualityDraftResult> {
  const profile = runtimeProfile(input.runtimeProfile);
  const quality = qualityConfig(input.qualityConfig);
  if (quality.tier === "economy") throw new Error("Economy drafting must use the existing direct prompt workflow.");

  const startingProject = readProject(input.root);
  const book = readBook(input.root);
  const context = buildChapterContext(input.root, input.chapter, profile.maxContextChars, profile.graphDepth);
  const chapter = context.packet.chapter;
  const bookRoot = `books/${book.book_id}`;
  const plot = parseYaml<PlotGridPhase4>(requireText(input.root, `${bookRoot}/plot-grid.yaml`), PlotGridPhase4Schema, "plot-grid.yaml");
  const remarkability = parseYaml<RemarkabilityState>(requireText(input.root, `${bookRoot}/remarkability.yaml`), RemarkabilitySchema, "remarkability.yaml");
  const strategy = parseYaml<BookStrategyPhase5>(requireText(input.root, `${bookRoot}/book-strategy.yaml`), BookStrategyPhase5Schema, "book-strategy.yaml");
  let historicalContext: HistoricalContext | undefined;
  let inventionLedger: InventionLedger | undefined;
  if (book.profile === "historical-fiction") {
    historicalContext = parseYaml<HistoricalContext>(requireText(input.root, `${bookRoot}/historical-context.yaml`), HistoricalContextSchema, "historical-context.yaml");
    inventionLedger = parseYaml<InventionLedger>(requireText(input.root, `${bookRoot}/invention-ledger.yaml`), InventionLedgerSchema, "invention-ledger.yaml");
  }
  const risk = assessChapterQualityRisk({
    packet: context.packet,
    plot,
    remarkability,
    ...(historicalContext ? { historicalContext } : {}),
    ...(inventionLedger ? { inventionLedger } : {}),
    approvedLearningGuardrail: approvedLearningGuardrail(strategy),
  });
  const plan = buildQualityPassPlan(quality, risk);
  const runId = input.runId ?? `QDR-${randomUUID()}`;
  const sourceHashes = [...new Set([projectStateHash(input.root), normalizedContentHash(context.text)])];
  const cacheRetention = input.cacheRetention ?? "delete-on-success";
  const calls: ModelCallReport[] = [];
  const advisories = new Set<string>();
  let creationOrder = 0;
  let callOrder = 0;
  const telemetryEnabled = startingProject.runtime?.telemetry ?? true;
  if (telemetryEnabled && !existsSync(runReportPath(input.root, runId))) {
    storeRunReport(input.root, createRunReportHeader({
      runId,
      runtimeProfile: profile.id,
      qualityTier: quality.tier,
      projectHashBefore: sourceHashes[0]!,
    }));
  }

  const progress = (name: string) => input.onProgress?.(name);
  const metadata = (value: Omit<QualityPromptMetadata, "run_id" | "chapter" | "source_hashes" | "creation_order">): QualityPromptMetadata => ({
    ...value,
    run_id: runId,
    chapter,
    source_hashes: sourceHashes,
    creation_order: ++creationOrder,
  });

  const execute = async <T>(spec: {
    label: string;
    metadata: QualityPromptMetadata;
    prompt: string;
    context: string;
    pass: QualityWorkerRequest["pass"];
    parse: (text: string) => T;
    cacheName?: string;
  }): Promise<T> => {
    let prompt = spec.prompt;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      progress(attempt === 0 ? spec.label : `${spec.label} correction`);
      const budget = await resolveWorkerModelBudget({
        worker: input.worker,
        runtimeProfile: profile,
        instructionChars: prompt.length,
        ...(input.model ? { selection: { ...(input.provider ? { provider: input.provider } : {}), model: input.model } } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      if (budget.advisory) advisories.add(budget.advisory);
      if (budget.capacity && budget.capacity.maxOutputTokens < profile.modelBudget.reservedOutputTokens) {
        throw new Error(`Selected model maximum output is below the ${profile.modelBudget.reservedOutputTokens}-token runtime reserve.`);
      }
      const evidenceTokens = Math.ceil(spec.context.length / 4);
      if (evidenceTokens > budget.budget.maximumEvidenceTokens) {
        throw new Error(`${spec.label} evidence exceeds the resolved model budget before inference.`);
      }
      const request: QualityWorkerRequest = {
        callId: `${runId}-CALL-${String(++callOrder).padStart(3, "0")}`,
        stage: "drafting",
        chapter,
        pass: spec.pass,
        prompt,
        context: spec.context,
        timeoutMs: spec.pass === "critic" || spec.pass === "verification" ? 5 * 60_000 : 10 * 60_000,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.thinking ? { thinking: input.thinking } : {}),
      };
      const result = await input.worker.run(request, input.signal);
      calls.push(result.usage);
      if (telemetryEnabled) appendModelCallReport(input.root, runId, result.usage);
      try {
        const parsed = spec.parse(result.text);
        if (spec.cacheName) writeQualityArtifact(input.root, { runId, chapter, name: spec.cacheName, artifact: parsed });
        return parsed;
      } catch (error) {
        if (attempt === 1) throw new Error(`${spec.label} failed after one correction attempt: ${errorIssues(error).join("; ")}`);
        prompt = correctionPrompt({
          metadata: spec.metadata,
          label: spec.label,
          rejectedOutputHash: normalizedContentHash(result.text),
          issues: errorIssues(error),
        });
      }
    }
    throw new Error(`${spec.label} could not be completed.`);
  };

  const planMeta = metadata({ output_type: "scene-plan" });
  const scenePlan = await execute<QualityScenePlan>({
    label: "scene plan",
    metadata: planMeta,
    prompt: scenePlanPrompt(planMeta),
    context: context.text,
    pass: "plan",
    parse: (text) => parseArtifact({ text, schema: QualityScenePlanSchema, metadata: planMeta, label: "scene plan" }),
    cacheName: "scene-plan",
  });

  const candidates: QualityDraftCandidate[] = [];
  for (let index = 1; index <= plan.candidateCount; index += 1) {
    const candidateId = `CAND-${String(index).padStart(2, "0")}`;
    const candidateMeta = metadata({ output_type: "draft-candidate", candidate_id: candidateId });
    candidates.push(await execute<QualityDraftCandidate>({
      label: `draft candidate ${candidateId}`,
      metadata: candidateMeta,
      prompt: candidatePrompt(candidateMeta),
      context: `${context.text}\n\nSCENE PLAN\n${JSON.stringify(scenePlan)}`,
      pass: "candidate",
      parse: (text) => parseArtifact({
        text,
        schema: QualityDraftCandidateSchema,
        metadata: candidateMeta,
        label: `draft candidate ${candidateId}`,
        extra: (value) => value.candidate_id === candidateId ? [] : [`candidate_id must be ${candidateId}`],
      }),
      cacheName: `candidate-${String(index).padStart(2, "0")}`,
    }));
  }

  let selected = candidates[0]!;
  if (candidates.length > 1) {
    const candidateIds = candidates.map((candidate) => candidate.candidate_id);
    const selectorMeta = metadata({ output_type: "candidate-selection", candidate_ids: candidateIds });
    const selection = await execute<QualityCandidateSelection>({
      label: "candidate selection",
      metadata: selectorMeta,
      prompt: selectorPrompt(selectorMeta),
      context: JSON.stringify({ packet: context.packet, candidates }),
      pass: "candidate",
      parse: (text) => parseArtifact({
        text,
        schema: QualityCandidateSelectionSchema,
        metadata: selectorMeta,
        label: "candidate selection",
        extra: (value) => [
          ...(JSON.stringify(value.candidate_ids) === JSON.stringify(candidateIds) ? [] : ["candidate_ids must match generated candidates"]),
          ...(candidateIds.includes(value.selected_candidate_id) ? [] : ["selected_candidate_id must name a generated candidate"]),
        ],
      }),
      cacheName: "candidate-selection",
    });
    selected = candidates.find((candidate) => candidate.candidate_id === selection.selected_candidate_id)!;
  }

  const critiques: QualityLaneCritique[] = [];
  for (const lane of plan.criticLanes) {
    const critiqueMeta = metadata({ output_type: "lane-critique", lane, candidate_id: selected.candidate_id });
    critiques.push(await execute<QualityLaneCritique>({
      label: `${lane} critique`,
      metadata: critiqueMeta,
      prompt: criticPrompt(critiqueMeta),
      context: JSON.stringify({ candidate: selected, packet: context.packet, evidence: context.text }),
      pass: "critic",
      parse: (text) => parseArtifact({
        text,
        schema: QualityLaneCritiqueSchema,
        metadata: critiqueMeta,
        label: `${lane} critique`,
        extra: (value) => [
          ...(value.lane === lane ? [] : [`lane must be ${lane}`]),
          ...(value.candidate_id === selected.candidate_id ? [] : [`candidate_id must be ${selected.candidate_id}`]),
        ],
      }),
      cacheName: `critique-${lane}`,
    }));
  }

  const outputMeta = metadata({ output_type: "event-output", candidate_id: selected.candidate_id, book_id: book.book_id });
  const eventOutput = await execute<QualityEventOutput>({
    label: "quality event output",
    metadata: outputMeta,
    prompt: eventOutputPrompt(outputMeta),
    context: JSON.stringify({
      packet: context.packet,
      selected_candidate: selected,
      critiques,
      evidence: context.text,
      revision_passes: plan.revisionPasses,
    }),
    pass: plan.revisionPasses > 0 ? "revision" : "verification",
    parse: (text) => parseQualityEventOutput(text, { bookId: book.book_id, chapter }),
    cacheName: "event-output",
  });

  for (const purpose of [
    ...(plan.finalReviewer ? ["final-review" as const] : []),
    ...(plan.claimAudit ? ["claim-audit" as const] : []),
  ]) {
    const verificationMeta = metadata({ output_type: "verification", book_id: book.book_id });
    const verification = await execute({
      label: purpose,
      metadata: verificationMeta,
      prompt: verificationPrompt(verificationMeta, purpose),
      context: JSON.stringify({ event_output: eventOutput, evidence: context.text }),
      pass: "verification" as const,
      parse: (text) => parseQualityVerificationOutput(text, chapter, purpose),
      cacheName: purpose,
    });
    if (verification.verdict !== "accept") throw new Error(`${purpose} rejected the quality output with ${verification.findings.length} finding(s).`);
  }

  progress("guarded event application");
  const currentProject = readProject(input.root);
  const applied = applyNovelEvent(input.root, {
    eventType: "draft-chapter",
    expectedStage: currentProject.current_stage,
    expectedProjectHash: projectStateHash(input.root),
    chapter,
    scope: `quality-${quality.tier}`,
    files: eventOutput.files,
  });
  finalizeQualityCache(input.root, runId, cacheRetention);
  return {
    runId,
    chapter,
    tier: quality.tier,
    risk,
    plan,
    calls,
    changed: applied.changed,
    projectHash: applied.projectHash,
    gitMessage: applied.gitMessage,
    advisories: [...advisories],
  };
}
