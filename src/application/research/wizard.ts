import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Stage } from "../../domain/schemas.js";
import {
  BookStrategyPhase5Schema,
  RevisionTicketsPhase5Schema,
  type BookStrategyPhase5,
  type RevisionLearningGuardrail,
  type RevisionTicketsPhase5,
} from "../../domain/v1-3-audit-schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../../domain/v1-3-research-schemas.js";
import {
  ResearchLedgerSchema,
  TasteProfileSchema,
  VoiceExperimentFileSchema,
  VoiceExperimentIndexSchema,
  VoiceGuardrailsSchema,
  type ResearchLedger,
  type TasteProfile,
  type VoiceExperimentFile,
  type VoiceExperimentIndex,
  type VoiceGuardrails,
} from "../../domain/v1-3-schemas.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import type { WizardProposalEnvelope, WizardSource } from "../../wizard/types.js";
import { applyNovelEvent } from "../events.js";
import { voiceSafetyFindings } from "../influence-palette.js";
import { projectStateHash } from "../project-hash.js";
import { researchEvidenceFindings } from "../research-evidence.js";
import {
  buildReviewCluster,
  importReviewObservationCsv,
  readerFrictionFindings,
  type FrictionCluster,
  type FrictionObservation,
} from "../review-observations.js";
import {
  renderApprovedLearningGuardrails,
  revisionLearningCandidates,
  revisionLearningFindings,
  type LearningCandidate,
} from "../revision-learning.js";
import { extractVoiceMetrics } from "../voice-audit.js";
import { stableContentHash, summarizeVoiceScores, voiceExperimentFindings } from "../voice-experiment.js";

export interface ResearchWizardOptions {
  resolveSource?(sourceId: string): WizardSource | null;
}

export interface ResearchWizardHandler {
  snapshot(): unknown;
  preview(action: string, payload: unknown): unknown;
  apply(proposal: WizardProposalEnvelope): Promise<unknown>;
}

type InfluencePreview = { kind: "influence"; taste: TasteProfile; influence: TasteProfile["influences"][number] };
type VoicePreview = { kind: "voice"; experimentId: string; variants: Array<{ id: "A" | "B" | "C"; prose: string }>; experiment: VoiceExperimentFile };
type ReviewImportPreview = { kind: "review-import"; observations: FrictionObservation[]; discardedIdentityFields: number; warnings: string[] };
type ReviewClusterPreview = { kind: "review-cluster"; cluster: FrictionCluster };
type FrictionDecisionPreview = { kind: "friction-decision"; strategy: BookStrategyPhase5; clusterId: string };
type ResearchItemPreview = { kind: "research-item"; ledger: ResearchLedger; itemId: string; findings: ReturnType<typeof researchEvidenceFindings> };
type LearningPreview = { kind: "learning"; strategy: BookStrategyPhase5; record: RevisionLearningGuardrail; candidate: LearningCandidate; findings: ReturnType<typeof revisionLearningFindings> };
type PreviewEntry = InfluencePreview | VoicePreview | ReviewImportPreview | ReviewClusterPreview | FrictionDecisionPreview | ResearchItemPreview | LearningPreview;

function requiredObject(value: unknown, label = "payload"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown, label: string, minimum = 1): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  const values = [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
  if (values.length < minimum) throw new Error(`${label} requires at least ${minimum} value${minimum === 1 ? "" : "s"}.`);
  return values;
}

function nextId(values: readonly string[], prefix: string): string {
  const maximum = values
    .map((id) => id.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .reduce((current, value) => Math.max(current, value), 0);
  return `${prefix}-${String(maximum + 1).padStart(3, "0")}`;
}

function readYaml<T>(path: string, schema: object, label = path): T {
  const text = readText(path);
  if (!text) throw new Error(`Missing required research wizard state: ${label}`);
  return parseYaml<T>(text, schema as never, label);
}

function projectPaths(root: string) {
  const book = readBook(root);
  const bookRoot = join(root, "books", book.book_id);
  return {
    book,
    bookRoot,
    taste: join(root, "series", "taste-profile.yaml"),
    experimentIndex: join(root, "series", "voice-experiments", "index.yaml"),
    guardrails: join(root, "series", "voice-guardrails.yaml"),
    strategy: join(bookRoot, "book-strategy.yaml"),
    ledger: join(bookRoot, "research-ledger.yaml"),
    tickets: join(bookRoot, "revision-tickets.yaml"),
    sources: join(root, "research", "source-register.yaml"),
  };
}

function canonicalState(root: string) {
  const paths = projectPaths(root);
  return {
    ...paths,
    tasteValue: readYaml<TasteProfile>(paths.taste, TasteProfileSchema, "taste-profile.yaml"),
    indexValue: readYaml<VoiceExperimentIndex>(paths.experimentIndex, VoiceExperimentIndexSchema, "voice-experiments/index.yaml"),
    guardrailsValue: readYaml<VoiceGuardrails>(paths.guardrails, VoiceGuardrailsSchema, "voice-guardrails.yaml"),
    strategyValue: readYaml<BookStrategyPhase5>(paths.strategy, BookStrategyPhase5Schema, "book-strategy.yaml"),
    ledgerValue: readYaml<ResearchLedger>(paths.ledger, ResearchLedgerSchema, "research-ledger.yaml"),
    ticketValue: readYaml<RevisionTicketsPhase5>(paths.tickets, RevisionTicketsPhase5Schema, "revision-tickets.yaml"),
    sourceValue: readYaml<SourceRegisterV13>(paths.sources, SourceRegisterV13Schema, "source-register.yaml"),
  };
}

function experimentMetadata(root: string, index: VoiceExperimentIndex) {
  return index.experiments.map((item) => {
    const text = readText(join(root, item.path));
    if (!text) return { id: item.id, status: item.status, variant_count: 0, score_count: 0, has_baseline: false };
    const experiment = parseYaml<VoiceExperimentFile>(text, VoiceExperimentFileSchema, item.path);
    return {
      id: experiment.id,
      status: experiment.status,
      variant_count: experiment.variants.length,
      score_count: experiment.scores.length,
      has_baseline: Boolean(experiment.baseline_hash),
      score_summary: summarizeVoiceScores(experiment),
    };
  });
}

export function researchWizardSnapshot(root: string) {
  const project = readProject(root);
  const state = canonicalState(root);
  return {
    id: "research" as const,
    eligible: true,
    stage: project.current_stage,
    state_hash: projectStateHash(root),
    book_id: state.book.book_id,
    taste: {
      influences: state.tasteValue.influences,
      negative_references: state.tasteValue.negative_references,
      opening_experiment: state.tasteValue.opening_experiment,
    },
    voice: { experiments: experimentMetadata(root, state.indexValue) },
    friction: {
      observations: state.strategyValue.reader_friction.observations,
      clusters: state.strategyValue.reader_friction.clusters,
      accepted_tradeoffs: state.strategyValue.reader_friction.accepted_tradeoffs,
    },
    research: {
      items: state.ledgerValue.items,
      sources: state.sourceValue.sources.map((source) => ({
        id: source.id,
        type: source.type,
        title: source.title,
        verified_on: source.verified_on,
        reliability: source.reliability ?? "unknown",
        observed_on: source.observed_on ?? null,
        supports_research_ids: source.supports_research_ids ?? [],
      })),
    },
    learning: {
      candidates: revisionLearningCandidates(state.ticketValue),
      guardrails: state.strategyValue.revision_learning_guardrails ?? [],
      approved_context: renderApprovedLearningGuardrails(state.strategyValue),
    },
  };
}

function experimentFile(root: string, experimentId: string): { path: string; experiment: VoiceExperimentFile } {
  const state = canonicalState(root);
  const record = state.indexValue.experiments.find((item) => item.id === experimentId);
  if (!record) throw new Error(`Unknown voice experiment ${experimentId}.`);
  const text = readText(join(root, record.path));
  if (!text) throw new Error(`Voice experiment ${experimentId} is missing.`);
  return { path: record.path, experiment: parseYaml<VoiceExperimentFile>(text, VoiceExperimentFileSchema, record.path) };
}

function variantProse(root: string, experiment: VoiceExperimentFile): Array<{ id: "A" | "B" | "C"; prose: string }> {
  const ordered = [...experiment.variants].sort((left, right) => left.id.localeCompare(right.id));
  if (ordered.length !== 3 || ordered.map((item) => item.id).join("") !== "ABC") throw new Error(`${experiment.id} requires anonymous variants A, B, and C.`);
  return ordered.map((variant) => {
    const prose = readText(join(root, variant.path));
    if (!prose) throw new Error(`${experiment.id} is missing variant ${variant.id}.`);
    if (stableContentHash(prose) !== variant.content_hash) throw new Error(`${experiment.id} variant ${variant.id} hash does not match.`);
    return { id: variant.id, prose };
  });
}

function freshness(root: string, proposal: WizardProposalEnvelope): void {
  const project = readProject(root);
  if (proposal.workflow !== "research") throw new Error("Research wizard proposal has the wrong workflow.");
  if (proposal.expected_stage !== project.current_stage) throw new Error(`Stale research wizard stage: expected ${proposal.expected_stage}, current ${project.current_stage}.`);
  if (proposal.expected_project_hash !== projectStateHash(root)) throw new Error("Stale research wizard project hash; reload the wizard.");
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function writerScores(value: unknown): VoiceExperimentFile["scores"] {
  if (!Array.isArray(value)) throw new Error("Voice scores must be a list.");
  return value.map((row, index) => {
    const item = requiredObject(row, `score ${index + 1}`);
    const variant = requiredString(item.variant_id, "variant_id");
    if (!["A", "B", "C"].includes(variant)) throw new Error("variant_id must be A, B, or C.");
    const integer = (name: string, minimum: number, maximum: number) => {
      const number = Number(item[name]);
      if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
      return number;
    };
    return {
      evaluator_id: optionalString(item.evaluator_id) || "writer",
      variant_id: variant as "A" | "B" | "C",
      feels_like_book: integer("feels_like_book", 1, 5),
      desire_to_continue: integer("desire_to_continue", 1, 5),
      character_intimacy: integer("character_intimacy", 1, 5),
      prose_naturalness: integer("prose_naturalness", 1, 5),
      distinctiveness: integer("distinctiveness", 1, 5),
      density: integer("density", -2, 2),
      note: optionalString(item.note),
    };
  });
}

export function createResearchWizardHandler(root: string, options: ResearchWizardOptions = {}): ResearchWizardHandler {
  const previews = new Map<string, PreviewEntry>();
  const save = <T extends PreviewEntry>(entry: T): T & { preview_id: string } => {
    const previewId = `research-preview-${randomBytes(12).toString("hex")}`;
    previews.set(previewId, entry);
    return { ...entry, preview_id: previewId };
  };

  const preview = (action: string, payload: unknown): unknown => {
    const input = requiredObject(payload);
    const state = canonicalState(root);
    if (action === "influence") {
      const influence = {
        id: nextId(state.tasteValue.influences.map((item) => item.id), "INF"),
        reference: requiredString(input.reference, "reference"),
        influence_type: requiredString(input.influence_type, "influence_type") as TasteProfile["influences"][number]["influence_type"],
        admired_for: stringList(input.admired_for, "admired_for"),
        not_for: stringList(input.not_for, "not_for or excluded qualities"),
        derived_traits: stringList(input.derived_traits, "derived_traits or neutral traits"),
        status: "approved" as const,
      };
      const taste = { ...state.tasteValue, influences: [...state.tasteValue.influences, influence] };
      parseYaml(stringifyYaml(taste), TasteProfileSchema, "taste-profile candidate");
      const safety = voiceSafetyFindings({ taste, voiceProfile: influence.derived_traits.join("\n"), guardrails: state.guardrailsValue });
      if (safety.length) throw new Error(safety.map((item) => item.message).join("\n"));
      return save({ kind: "influence", taste, influence });
    }
    if (action === "voice-comparison") {
      const experimentId = requiredString(input.experiment_id, "experiment_id");
      const { experiment } = experimentFile(root, experimentId);
      const blockers = voiceExperimentFindings({ root, taste: state.tasteValue, index: state.indexValue }).filter((item) => item.severity === "blocker" && item.message.includes(experimentId));
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\n"));
      const variants = variantProse(root, experiment);
      const stored = save({ kind: "voice", experimentId, variants, experiment });
      return { preview_id: stored.preview_id, experiment_id: experimentId, variants, existing_scores: experiment.scores, summary: summarizeVoiceScores(experiment) };
    }
    if (action === "review-csv") {
      let csv = optionalString(input.csv_text);
      if (!csv) {
        const sourceId = requiredString(input.source_id, "source_id or csv_text");
        const source = options.resolveSource?.(sourceId);
        if (!source) throw new Error(`Unknown research wizard upload ${sourceId}.`);
        csv = readFileSync(source.absolutePath, "utf8");
      }
      const imported = importReviewObservationCsv(csv, state.strategyValue.reader_friction.observations.map((item) => item.id));
      const stored = save({ kind: "review-import", observations: imported.observations, discardedIdentityFields: imported.discardedIdentityFields, warnings: imported.warnings });
      return { preview_id: stored.preview_id, observations: imported.observations, discarded_identity_fields: imported.discardedIdentityFields, warnings: imported.warnings };
    }
    if (action === "review-cluster") {
      const cluster = buildReviewCluster({
        id: nextId(state.strategyValue.reader_friction.clusters.map((item) => item.id), "CLU"),
        label: requiredString(input.label, "label"),
        observationIds: stringList(input.observation_ids, "observation_ids"),
      }, state.strategyValue.reader_friction.observations);
      const stored = save({ kind: "review-cluster", cluster });
      return { preview_id: stored.preview_id, cluster, positive_counterweights: cluster.positive_counterweights };
    }
    if (action === "friction-decision") {
      const clusterId = requiredString(input.cluster_id, "cluster_id");
      const decision = requiredString(input.decision, "decision") as FrictionCluster["decision"];
      if (!decision || !["prevent", "mitigate", "accept-as-tradeoff", "irrelevant-to-project"].includes(decision)) throw new Error("Unsupported friction decision.");
      const guardrail = optionalString(input.guardrail);
      if ((decision === "prevent" || decision === "mitigate") && !guardrail) throw new Error("Prevent or mitigate decisions require a concise guardrail.");
      const strategy = structuredClone(state.strategyValue);
      const cluster = strategy.reader_friction.clusters.find((item) => item.id === clusterId);
      if (!cluster) throw new Error(`Unknown friction cluster ${clusterId}.`);
      cluster.decision = decision;
      cluster.guardrail = guardrail || null;
      const existing = strategy.review_derived_guardrails.find((item) => item.source_cluster_ids.includes(clusterId));
      if (decision === "prevent" || decision === "mitigate") {
        if (existing) { existing.rule = guardrail; existing.status = "approved"; }
        else strategy.review_derived_guardrails.push({ id: nextId(strategy.review_derived_guardrails.map((item) => item.id), "GR"), rule: guardrail, source_cluster_ids: [clusterId], status: "approved" });
      } else if (existing) existing.status = "rejected";
      const findings = readerFrictionFindings(strategy);
      return save({ kind: "friction-decision", strategy, clusterId, findings } as FrictionDecisionPreview & { findings: typeof findings });
    }
    if (action === "research-item") {
      const item = structuredClone(requiredObject(input.item)) as ResearchLedger["items"][number];
      if (!item.id) item.id = nextId(state.ledgerValue.items.map((value) => value.id), "RES");
      const ledger = structuredClone(state.ledgerValue);
      const index = ledger.items.findIndex((value) => value.id === item.id);
      if (index >= 0) ledger.items[index] = item; else ledger.items.push(item);
      parseYaml(stringifyYaml(ledger), ResearchLedgerSchema, "research-ledger candidate");
      const findings = researchEvidenceFindings(ledger, state.sourceValue);
      return save({ kind: "research-item", ledger, itemId: item.id, findings });
    }
    if (action === "learning-decision") {
      const patternId = requiredString(input.pattern_id, "pattern_id");
      const decision = requiredString(input.decision, "decision");
      if (!(["proposed", "approved", "rejected"] as const).includes(decision as never)) throw new Error("Learning decision must be proposed, approved, or rejected.");
      const candidate = revisionLearningCandidates(state.ticketValue).find((item) => item.patternId === patternId);
      if (!candidate) throw new Error(`Unknown revision-learning pattern ${patternId}.`);
      const strategy = structuredClone(state.strategyValue);
      const current = (strategy.revision_learning_guardrails ?? []).find((item) => item.pattern_id === patternId);
      const record: RevisionLearningGuardrail = {
        id: current?.id ?? nextId((strategy.revision_learning_guardrails ?? []).map((item) => item.id), "LRN"),
        pattern_id: patternId,
        rule: requiredString(input.rule, "rule"),
        source_ticket_ids: candidate.ticketIds,
        distinct_chapters: candidate.distinctChapters,
        milestone_reviews: candidate.milestoneReviews,
        status: decision as RevisionLearningGuardrail["status"],
      };
      strategy.revision_learning_guardrails = [...(strategy.revision_learning_guardrails ?? []).filter((item) => item.pattern_id !== patternId), record];
      const findings = revisionLearningFindings(strategy, state.ticketValue);
      return save({ kind: "learning", strategy, record, candidate, findings });
    }
    throw new Error(`Unsupported research wizard preview action: ${action}.`);
  };

  const apply = async (proposal: WizardProposalEnvelope): Promise<unknown> => {
    freshness(root, proposal);
    const payload = requiredObject(proposal.payload);
    const previewId = requiredString(payload.preview_id, "preview_id");
    const entry = previews.get(previewId);
    if (!entry) throw new Error("Unknown or expired research preview; preview the change again.");
    const state = canonicalState(root);
    const files: Array<{ path: string; content: string }> = [];
    if (proposal.action === "save-influence" && entry.kind === "influence") {
      files.push({ path: "series/taste-profile.yaml", content: stringifyYaml(entry.taste) });
    } else if (proposal.action === "import-review-observations" && entry.kind === "review-import") {
      const strategy = structuredClone(state.strategyValue);
      strategy.reader_friction.observations.push(...entry.observations);
      const blockers = readerFrictionFindings(strategy).filter((item) => item.severity === "blocker");
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\n"));
      files.push({ path: `books/${state.book.book_id}/book-strategy.yaml`, content: stringifyYaml(strategy) });
    } else if (proposal.action === "save-review-cluster" && entry.kind === "review-cluster") {
      const strategy = structuredClone(state.strategyValue);
      strategy.reader_friction.clusters.push(entry.cluster);
      files.push({ path: `books/${state.book.book_id}/book-strategy.yaml`, content: stringifyYaml(strategy) });
    } else if (proposal.action === "save-friction-decision" && entry.kind === "friction-decision") {
      files.push({ path: `books/${state.book.book_id}/book-strategy.yaml`, content: stringifyYaml(entry.strategy) });
    } else if (proposal.action === "save-research-item" && entry.kind === "research-item") {
      const blockers = entry.findings.filter((item) => item.severity === "blocker");
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\n"));
      files.push({ path: `books/${state.book.book_id}/research-ledger.yaml`, content: stringifyYaml(entry.ledger) });
    } else if (proposal.action === "save-learning-decision" && entry.kind === "learning") {
      const blockers = entry.findings.filter((item) => item.severity === "blocker");
      if (blockers.length) throw new Error(blockers.map((item) => item.message).join("\n"));
      files.push({ path: `books/${state.book.book_id}/book-strategy.yaml`, content: stringifyYaml(entry.strategy) });
    } else if ((proposal.action === "save-voice-scores" || proposal.action === "accept-voice-baseline") && entry.kind === "voice") {
      const scores = writerScores(payload.scores);
      const acceptedTraits = stringList(payload.accepted_traits, "accepted_traits", 0);
      const experimentPath = `series/voice-experiments/${entry.experimentId}/experiment.yaml`;
      if (proposal.action === "save-voice-scores") {
        const experiment = { ...entry.experiment, status: "scoring" as const, scores, accepted_traits: acceptedTraits, baseline_path: null, baseline_hash: null };
        files.push({ path: experimentPath, content: stringifyYaml(experiment) });
      } else {
        const selection = requiredString(payload.selection, "selection");
        let baseline = "";
        if (["A", "B", "C"].includes(selection)) baseline = entry.variants.find((item) => item.id === selection)?.prose ?? "";
        else if (selection === "custom") baseline = requiredString(payload.custom_baseline, "custom_baseline");
        else throw new Error("Baseline selection must be A, B, C, or custom.");
        const count = words(baseline);
        if (count < 600 || count > 900) throw new Error(`Accepted voice baseline must contain 600–900 words; received ${count}.`);
        const safety = voiceSafetyFindings({ taste: state.tasteValue, voiceProfile: baseline, guardrails: state.guardrailsValue });
        if (safety.length) throw new Error(safety.map((item) => item.message).join("\n"));
        const baselinePath = `series/voice-experiments/${entry.experimentId}/baseline.md`;
        const baselineHash = stableContentHash(baseline);
        const experiment = { ...entry.experiment, status: "accepted" as const, scores, accepted_traits: acceptedTraits, baseline_path: baselinePath, baseline_hash: baselineHash };
        const index = structuredClone(state.indexValue);
        const indexItem = index.experiments.find((item) => item.id === entry.experimentId);
        if (!indexItem) throw new Error(`Voice experiment index is missing ${entry.experimentId}.`);
        indexItem.status = "accepted";
        indexItem.baseline_hash = baselineHash;
        const taste = structuredClone(state.tasteValue);
        taste.opening_experiment = { status: "accepted", experiment_id: entry.experimentId, baseline_path: baselinePath };
        const guardrails = structuredClone(state.guardrailsValue);
        guardrails.baseline = { path: baselinePath, content_hash: baselineHash, metrics: extractVoiceMetrics(baseline) };
        files.push(
          { path: experimentPath, content: stringifyYaml(experiment) },
          { path: baselinePath, content: baseline },
          { path: "series/voice-experiments/index.yaml", content: stringifyYaml(index) },
          { path: "series/taste-profile.yaml", content: stringifyYaml(taste) },
          { path: "series/voice-guardrails.yaml", content: stringifyYaml(guardrails) },
        );
      }
    } else {
      throw new Error(`Research preview ${previewId} cannot be applied as ${proposal.action}.`);
    }
    const result = applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: proposal.expected_stage as Stage,
      expectedProjectHash: proposal.expected_project_hash,
      files,
      scope: `research-wizard:${proposal.action}`,
    });
    previews.delete(previewId);
    return result;
  };

  return { snapshot: () => researchWizardSnapshot(root), preview, apply };
}
