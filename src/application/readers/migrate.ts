import { join } from "node:path";
import { ReaderExperimentsSchema, type ReaderExperimentsState, type ReaderResponse } from "../../domain/schemas.js";
import type { ReaderExperimentFile, ReaderExperimentIndex, ReaderResponseV2 } from "../../domain/v1-2-schemas.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { readProject } from "../../project/store.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import { readReaderIndex, readerExperimentDirectory, readerResponsesCsv, sourceHash } from "./store.js";
import type { ReaderMigrationResult } from "./types.js";

function responseV2(response: ReaderResponse, experimentId: string, phase: "immediate" | "delayed", acceptedAt: string): ReaderResponseV2 {
  return { experiment_id: experimentId, questionnaire_version: "legacy-v1.1", phase, accepted_at: acceptedAt, ...response };
}

function v2Scope(scope: string): ReaderExperimentFile["scope"] {
  if (scope === "sample") return "excerpt";
  if (scope === "first-page" || scope === "first-chapter" || scope === "act" || scope === "manuscript") return scope;
  return "excerpt";
}

export function migrateReaderEvidenceV1ToV2(root: string): ReaderMigrationResult {
  const project = structuredClone(readProject(root));
  const bookId = project.active_book;
  const legacyPath = join(root, "books", bookId, "reader-experiments.yaml");
  const legacyText = readText(legacyPath);
  if (!legacyText) return { migratedIds: [], legacyHash: "", changed: [], gitSha: null };
  const legacyHash = sourceHash(legacyText);
  const marker = `reader-evidence-v1-to-v2:${legacyHash}`;
  const existingIndex = readReaderIndex(root, bookId);
  if (project.migration_history.includes(marker) || existingIndex.experiments.length) return { migratedIds: [], legacyHash, changed: [], gitSha: null };
  const legacy = parseYaml<ReaderExperimentsState>(legacyText, ReaderExperimentsSchema, "reader-experiments.yaml");
  if (!legacy.experiments.length) return { migratedIds: [], legacyHash, changed: [], gitSha: null };
  const migratedAt = new Date().toISOString();
  const index: ReaderExperimentIndex = { schema_version: "1.0.0", experiments: [] };
  const changes: Array<{ path: string; content: string }> = [];
  const sharedRoot = join(root, "books", bookId, "reader-kit");
  const shared = {
    sample: readText(join(sharedRoot, "sample.md")) ?? "",
    immediate: readText(join(sharedRoot, "immediate-questions.md")) ?? "",
    delayed: readText(join(sharedRoot, "delayed-questions.md")) ?? "",
  };
  for (const experiment of legacy.experiments) {
    const base = readerExperimentDirectory(bookId, experiment.id);
    const sample = shared.sample;
    const migrated: ReaderExperimentFile = {
      schema_version: "1.0.0",
      id: experiment.id,
      status: experiment.status,
      scope: v2Scope(experiment.scope),
      variant: experiment.variant,
      blind: experiment.blind,
      target_reader: experiment.target_reader,
      sample_path: `${base}/sample.md`,
      sample_hash: sourceHash(sample),
      questionnaire_version: "legacy-v1.1",
      minimum_immediate_count: experiment.minimum_reader_count,
      minimum_delayed_count: experiment.minimum_reader_count,
      delayed_after_hours: experiment.delayed_after_hours,
      immediate_responses: experiment.immediate_responses.map((response) => responseV2(response, experiment.id, "immediate", migratedAt)),
      delayed_responses: experiment.delayed_responses.map((response) => responseV2(response, experiment.id, "delayed", migratedAt)),
      excluded_response_keys: [],
      metrics: experiment.metrics,
      verdict: experiment.verdict,
      limitations: ["Migrated from the v1.1 shared reader-kit layout."],
      supported_claims: [],
      prohibited_claims: ["Do not imply validation beyond the recorded human sample."],
      next_action: experiment.next_action,
      created_at: migratedAt,
      updated_at: migratedAt,
    };
    const yaml = stringifyYaml(migrated);
    index.experiments.push({ id: experiment.id, path: `${base}/experiment.yaml`, status: experiment.status, source_hash: sourceHash(yaml) });
    changes.push(
      { path: `${base}/experiment.yaml`, content: yaml },
      { path: `${base}/sample.md`, content: sample },
      { path: `${base}/immediate-questions.md`, content: shared.immediate },
      { path: `${base}/delayed-questions.md`, content: shared.delayed },
      { path: `${base}/responses.csv`, content: readerResponsesCsv(migrated) },
      { path: `${base}/migration-report.md`, content: `# Reader Evidence Migration\n\n- Experiment: ${experiment.id}\n- Legacy source hash: ${legacyHash}\n- Migrated at: ${migratedAt}\n- Legacy files remain unchanged.\n- Response fields, metrics, verdict, timestamps, and source statements were preserved.\n` },
    );
  }
  changes.push({ path: `books/${bookId}/reader-kits/index.yaml`, content: stringifyYaml(index) });
  project.migration_history.push(marker);
  changes.push({ path: "PROJECT.yaml", content: stringifyYaml(project) });
  const result = applyGuidedProjectEvent(root, changes, "Novel Forge: migrate reader evidence to v1.2", { lastAction: `Migrated ${legacy.experiments.length} reader experiments` });
  return { migratedIds: legacy.experiments.map((experiment) => experiment.id), legacyHash, changed: result.changed, gitSha: result.git.committed ? result.git.sha ?? null : null };
}
