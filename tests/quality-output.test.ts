import test from "node:test";
import assert from "node:assert/strict";
import { parseQualityEventOutput, parseStructuredQualityArtifact } from "../src/application/quality-output.js";
import { QualityScenePlanSchema } from "../src/domain/quality-artifacts.js";

const plan = {
  schema_version: "1.0.0",
  run_id: "RUN-001",
  chapter: 2,
  source_hashes: ["a".repeat(64)],
  creation_order: 1,
  artifact_type: "scene-plan",
  objective: "Force a costly choice.",
  beats: ["Enter", "Discover", "Choose"],
  protected_constraints: ["Preserve endpoint."],
  ending_hook: "The record changes.",
  evidence_refs: ["CAN-001"],
};

test("structured artifact parsing accepts one exact JSON object and rejects fences or schema drift", () => {
  assert.deepEqual(parseStructuredQualityArtifact(JSON.stringify(plan), QualityScenePlanSchema, "scene plan"), plan);
  assert.throws(() => parseStructuredQualityArtifact(`\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``, QualityScenePlanSchema, "scene plan"), /exact JSON object/i);
  assert.throws(() => parseStructuredQualityArtifact(JSON.stringify({ ...plan, extra: true }), QualityScenePlanSchema, "scene plan"), /invalid scene plan/i);
  assert.throws(() => parseStructuredQualityArtifact("{not json}", QualityScenePlanSchema, "scene plan"), /valid JSON/i);
});

test("final quality output is chapter-bound, path-safe, duplicate-free, and manuscript-bearing", () => {
  const output = {
    schema_version: "1.0.0",
    chapter: 2,
    files: [{
      path: "books/book-01/manuscript/chapters/02-the-door.md",
      content: "# Chapter 2\n\nThe door remembered a credential that no longer existed.\n",
    }],
    summary: "Drafted the approved packet without changing its endpoint.",
  };
  assert.deepEqual(parseQualityEventOutput(JSON.stringify(output), { bookId: "book-01", chapter: 2 }), output);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, chapter: 3 }), { bookId: "book-01", chapter: 2 }), /chapter 2/i);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, files: [] }), { bookId: "book-01", chapter: 2 }), /manuscript/i);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, files: [output.files[0], output.files[0]] }), { bookId: "book-01", chapter: 2 }), /duplicate/i);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, files: [{ path: "../escape.md", content: "bad" }] }), { bookId: "book-01", chapter: 2 }), /not allowed/i);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, files: [{ path: "books/book-01/manuscript/chapters/03-wrong.md", content: "bad" }] }), { bookId: "book-01", chapter: 2 }), /chapter 2/i);
  assert.throws(() => parseQualityEventOutput(JSON.stringify({ ...output, files: [{ path: "PROJECT.yaml", content: "bad" }] }), { bookId: "book-01", chapter: 2 }), /not allowed/i);
});
