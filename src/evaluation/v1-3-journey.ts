import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CanonSchema, ChapterQueueSchema, PlotGridSchema, StoryThreadsSchema,
  type CanonState, type ChapterQueueState, type PlotGridState, type StoryThreadsState,
} from "../domain/schemas.js";
import { SourceRegisterV13Schema, type SourceRegisterV13 } from "../domain/v1-3-research-schemas.js";
import {
  ResearchLedgerSchema, VoiceExperimentIndexSchema, VoiceGuardrailsSchema,
  type ResearchLedger, type VoiceExperimentIndex, type VoiceGuardrails,
} from "../domain/v1-3-schemas.js";
import { buildStoryGraph } from "../context/story-graph.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { initializeProject, readBook, readProject } from "../project/store.js";
import { applyNovelEvent } from "../application/events.js";
import { buildPackagingChecklist } from "../application/package-checklist.js";
import { projectStateHash } from "../application/project-hash.js";
import { createResearchWizardHandler, researchWizardSnapshot } from "../application/research/wizard.js";
import { buildNextBookInheritanceProposal } from "../application/next-book.js";
import { stableContentHash } from "../application/voice-experiment.js";
import type { WizardProposalEnvelope } from "../wizard/types.js";

export interface V13JourneyReport {
  projectRoot: string;
  initializedVersion: string;
  completedChecks: string[];
  skippedChecks: Array<{ id: string; reason: string }>;
  invariantFailures: string[];
}

function readYaml<T>(root: string, path: string, schema: object): T {
  const content = readText(join(root, path));
  if (!content) throw new Error(`${path} is missing.`);
  return parseYaml<T>(content, schema as never, path);
}
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function proposal(root: string, action: string, payload: unknown): WizardProposalEnvelope {
  const project = readProject(root);
  return {
    proposal_id: `release-${action}`, workflow: "research", action,
    expected_stage: project.current_stage, expected_project_hash: projectStateHash(root), payload,
  };
}
function sourceWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `calibration${index}`).join(" ");
}

export async function runV13CleanProjectJourney(parent: string): Promise<V13JourneyReport> {
  const completedChecks: string[] = [];
  const skippedChecks: Array<{ id: string; reason: string }> = [];
  const invariantFailures: string[] = [];
  const root = initializeProject(parent, {
    projectName: "Novel Forge 1.3 Release Journey", projectType: "standalone", profile: "thriller", targetWords: 100000,
  });
  const initialProject = structuredClone(readProject(root));
  const initialBook = structuredClone(readBook(root));
  const readerPath = join(root, "books", initialBook.book_id, "reader-experiments.yaml");
  const initialReaderHash = digest(readText(readerPath) ?? "");
  const manuscriptRoot = join(root, "books", initialBook.book_id, "manuscript", "chapters");
  completedChecks.push("initialize-project");

  const snapshot = researchWizardSnapshot(root);
  if (snapshot.id !== "research" || snapshot.stage !== initialProject.current_stage) invariantFailures.push("Research snapshot did not preserve current project stage.");
  completedChecks.push("research-snapshot");

  const handler = createResearchWizardHandler(root);
  const reference = "Private Release Reference";
  const influence = handler.preview("influence", {
    reference, influence_type: "voice", admired_for: ["controlled escalation"],
    not_for: ["signature phrasing"], derived_traits: ["escalate through causal consequence"],
  }) as { preview_id: string };
  await handler.apply(proposal(root, "save-influence", { preview_id: influence.preview_id }));
  completedChecks.push("influence-preview-apply");

  const indexPath = "series/voice-experiments/index.yaml";
  const index = readYaml<VoiceExperimentIndex>(root, indexPath, VoiceExperimentIndexSchema);
  const source = sourceWords(650);
  const experimentPath = "series/voice-experiments/VE-001/experiment.yaml";
  const sourcePath = "series/voice-experiments/VE-001/source-scene.md";
  index.experiments.push({ id: "VE-001", path: experimentPath, status: "planned", baseline_hash: null });
  applyNovelEvent(root, {
    eventType: "research-update", expectedStage: readProject(root).current_stage,
    expectedProjectHash: projectStateHash(root), scope: "release-journey-planned-voice",
    files: [
      { path: sourcePath, content: source },
      { path: experimentPath, content: stringifyYaml({
        schema_version: "1.0.0", id: "VE-001", status: "planned",
        source_scene_path: sourcePath, source_scene_hash: stableContentHash(source),
        variants: [], scores: [], accepted_traits: [], baseline_path: null, baseline_hash: null,
      }) },
      { path: indexPath, content: stringifyYaml(index) },
    ],
  });
  completedChecks.push("planned-voice-experiment");

  const research = handler.preview("research-item", { item: {
    id: "RES-001", lane: "story-world", claim: "A release qualification claim may remain under research.",
    source_ids: [], confidence: "low", verified_on: null,
    fictionalization: { status: "unchanged", reason: "" },
    knowledge_scope: { known_by: [], incorrectly_believed_by: [], unknown_to: [] },
    risk: [], dramatic_uses: [], story_use: { chapters: [], decision_affected: "" },
    notes: "Release journey only.", status: "researching",
  } }) as { preview_id: string; findings: Array<{ severity: string }> };
  if (research.findings.some((item) => item.severity === "blocker")) invariantFailures.push("Researching item was incorrectly blocked.");
  await handler.apply(proposal(root, "save-research-item", { preview_id: research.preview_id }));
  completedChecks.push("research-item");

  const csv = [
    "title,source_location,observed_on,rating,paraphrase,short_excerpt,category,genre_relevance,execution_relevance,sentiment,reviewer_name,reviewer_handle,reviewer_profile_url",
    "Comparable,manual,2026-07-16,3,Jane Release found the middle uneven,,pacing-problem,high,high,,Jane Release,@jane,profile",
  ].join("\n");
  const review = handler.preview("review-csv", { csv_text: csv }) as { observations: unknown[]; discarded_identity_fields: number };
  if (JSON.stringify(review).includes("Jane Release") || review.discarded_identity_fields !== 3) invariantFailures.push("Public review identity was not stripped.");
  completedChecks.push("public-review-identity-strip");

  const book = readBook(root);
  const canon = readYaml<CanonState>(root, "series/canon.yaml", CanonSchema);
  const threads = readYaml<StoryThreadsState>(root, "series/story-threads.yaml", StoryThreadsSchema);
  const queue = readYaml<ChapterQueueState>(root, `books/${book.book_id}/chapter-queue.yaml`, ChapterQueueSchema);
  const plot = readYaml<PlotGridState>(root, `books/${book.book_id}/plot-grid.yaml`, PlotGridSchema);
  const sources = readYaml<SourceRegisterV13>(root, "research/source-register.yaml", SourceRegisterV13Schema);
  const ledger = readYaml<ResearchLedger>(root, `books/${book.book_id}/research-ledger.yaml`, ResearchLedgerSchema);
  const graph = buildStoryGraph({ bookId: book.book_id, canon, threads, queue, plot, sources, research: ledger });
  if (graph.bookId !== book.book_id) invariantFailures.push("Story graph did not load the active book.");
  completedChecks.push("strategy-graph-load");

  const guardrails = readYaml<VoiceGuardrails>(root, "series/voice-guardrails.yaml", VoiceGuardrailsSchema);
  if (guardrails.baseline.content_hash !== null || Object.keys(guardrails.baseline.metrics).length !== 0) invariantFailures.push("Clean project unexpectedly contains accepted voice baseline evidence.");
  completedChecks.push("voice-audit-no-baseline");

  buildPackagingChecklist(root);
  completedChecks.push("packaging-checklist");

  let refused = false;
  try { buildNextBookInheritanceProposal(root); }
  catch (error) { refused = /lock or package/i.test(error instanceof Error ? error.message : String(error)); }
  if (!refused) invariantFailures.push("Next-book proposal did not refuse an unlocked first book.");
  completedChecks.push("next-book-refusal");

  const finalProject = readProject(root);
  const finalBook = readBook(root);
  if (finalProject.current_stage !== initialProject.current_stage) invariantFailures.push("Evidence-only journey changed project stage.");
  if (JSON.stringify(finalProject.gates) !== JSON.stringify(initialProject.gates)) invariantFailures.push("Evidence-only journey changed gates.");
  if (JSON.stringify(finalProject.approvals) !== JSON.stringify(initialProject.approvals)) invariantFailures.push("Evidence-only journey changed approvals.");
  if (finalProject.active_book !== initialProject.active_book || finalBook.status !== initialBook.status) invariantFailures.push("Evidence-only journey changed active-book state.");
  if (digest(readText(readerPath) ?? "") !== initialReaderHash) invariantFailures.push("Public market preview changed manuscript reader evidence.");
  if (existsSync(manuscriptRoot) && readdirSync(manuscriptRoot).length !== 0) invariantFailures.push("Release journey generated manuscript prose.");
  if ((readText(join(root, "series", "voice-guardrails.yaml")) ?? "").includes(reference)) invariantFailures.push("Raw influence reference entered compiled voice guardrails.");

  skippedChecks.push(
    { id: "accepted-voice-baseline", reason: "Requires writer-selected prose and explicit writer acceptance; the release journey does not fabricate either." },
    { id: "human-reader-merge", reason: "Requires real human responses to the current manuscript; simulated or invented rows are not valid evidence." },
    { id: "docx-adoption", reason: "Requires a writer-supplied source file; the clean-project release journey does not invent one." },
    { id: "package-export", reason: "Requires an approved manuscript and canonical publishing metadata; the clean project is intentionally pre-approval." },
    { id: "next-book-creation", reason: "Requires locked canon and an approved or packaged prior book; the journey verifies the refusal boundary instead." },
  );

  return {
    projectRoot: root, initializedVersion: finalProject.novel_forge_version ?? "",
    completedChecks, skippedChecks, invariantFailures,
  };
}
