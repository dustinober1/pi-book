import { join } from "node:path";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../domain/v1-3-schemas.js";
import { listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";
import { assertReviewAllowed } from "./authorization.js";
import { applyNovelEvent, projectStateHash, type NovelEventResult } from "./events.js";

function readApprovedBaseline(root: string): VoiceGuardrails {
  const path = join(root, "series", "voice-guardrails.yaml");
  const text = readText(path);
  if (!text) throw new Error("Explicit recalibration requires series/voice-guardrails.yaml with an approved voice baseline.");
  const guardrails = parseYaml<VoiceGuardrails>(text, VoiceGuardrailsSchema, "voice-guardrails.yaml");
  if (!guardrails.baseline.content_hash || Object.keys(guardrails.baseline.metrics).length === 0) {
    throw new Error("Explicit recalibration requires an approved voice baseline hash and baseline metrics.");
  }
  return guardrails;
}

function assertManuscriptSample(root: string, bookId: string): void {
  const chapters = listChapterFiles(join(root, "books", bookId));
  const hasProse = chapters.some((path) => Boolean(readText(path)?.trim()));
  if (!hasProse) throw new Error("Explicit recalibration requires at least one non-empty manuscript chapter as the manuscript sample.");
}

export function runExplicitVoiceRecalibration(root: string): NovelEventResult {
  const project = readProject(root);
  const book = readBook(root);
  assertReviewAllowed(project, "recalibration");
  readApprovedBaseline(root);
  assertManuscriptSample(root, book.book_id);

  const path = `books/${book.book_id}/voice-audits.yaml`;
  const current = readText(join(root, path)) ?? 'schema_version: "1.0.0"\naudits: []\n';
  return applyNovelEvent(root, {
    eventType: "research-update",
    expectedStage: project.current_stage,
    expectedProjectHash: projectStateHash(root),
    scope: "recalibration",
    files: [{ path, content: current }],
  });
}
