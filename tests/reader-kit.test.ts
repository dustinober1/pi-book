import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importReaderResponses, prepareReaderKit } from "../src/application/reader-kit.js";
import { ReaderExperimentsSchema } from "../src/domain/schemas.js";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-reader-kit-")); }
function draftingProject(parent: string): string {
  const root = initializeProject(parent, { projectName: "Reader Kit", projectType: "standalone", profile: "thriller" });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md"), `# Chapter 1\n\n${"signal ".repeat(1100)}\n`, "utf8");
  return root;
}

test("prepares a guarded reader kit with a capped first-page sample", () => {
  const parent = temp();
  try {
    const root = draftingProject(parent);
    const prepared = prepareReaderKit(root, {
      scope: "first-page",
      targetReader: "core geopolitical thriller readers",
      minimumReaderCount: 3,
      delayedAfterHours: 48,
      variant: "A",
    });
    assert.match(prepared.experimentId, /^RE-\d{3}$/);
    const kit = join(root, "books", "book-01", "reader-kit");
    assert.match(readFileSync(join(kit, "immediate-questions.md"), "utf8"), /continue reading/i);
    assert.match(readFileSync(join(kit, "delayed-questions.md"), "utf8"), /without reopening/i);
    assert.match(readFileSync(join(kit, "responses.csv"), "utf8"), /^phase,reader_id,source,/);
    const sampleWords = readFileSync(join(kit, "sample.md"), "utf8").trim().split(/\s+/).length;
    assert.ok(sampleWords <= 905, `sample had ${sampleWords} words`);
    const state = parseYaml<any>(readFileSync(join(root, "books", "book-01", "reader-experiments.yaml"), "utf8"), ReaderExperimentsSchema, "reader-experiments.yaml");
    assert.equal(state.experiments[0].minimum_reader_count, 3);
    assert.equal(state.experiments[0].delayed_after_hours, 48);
    assert.ok(prepared.event.changed.some((path) => path.endsWith("reader-kit/sample.md")));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("imports quoted human CSV rows and computes metrics from them", () => {
  const parent = temp();
  try {
    const root = draftingProject(parent);
    const prepared = prepareReaderKit(root, {
      scope: "first-chapter",
      targetReader: "core thriller readers",
      minimumReaderCount: 1,
      delayedAfterHours: 48,
    });
    const csv = join(root, "books", "book-01", "reader-kit", "responses.csv");
    writeFileSync(csv, [
      "phase,reader_id,source,segment,recorded_at,continued_reading,would_buy,confusions,trust_breaks,lines_that_worked,remembered_hook,remembered_moments,friend_description,disagreement_question,lingering_question,recommendation_target,recommendation_reason,told_someone",
      'immediate,R-001,human,core,2026-07-14T12:00:00Z,true,true,"one, small confusion",,"line one;line two",,,,,,,,,',
      'delayed,R-001,human,core,2026-07-16T12:00:00Z,,,,,,"the clean signal","the van;the cutoff","A fugitive analyst finds a manufactured war trigger",Who authorized it?,Will India fire?,thriller readers,"specific institutional pressure",true',
    ].join("\n"), "utf8");
    importReaderResponses(root, prepared.experimentId, csv);
    const state = parseYaml<any>(readFileSync(join(root, "books", "book-01", "reader-experiments.yaml"), "utf8"), ReaderExperimentsSchema, "reader-experiments.yaml");
    const experiment = state.experiments[0];
    assert.equal(experiment.immediate_responses[0].confusions[0], "one, small confusion");
    assert.equal(experiment.metrics.continuation_rate, 1);
    assert.equal(experiment.metrics.purchase_intent_rate, 1);
    assert.equal(experiment.metrics.delayed_hook_recall_rate, 1);
    assert.equal(experiment.metrics.signature_moment_recall_rate, 1);
    assert.equal(experiment.metrics.specific_recommendation_rate, 1);
    assert.equal(experiment.metrics.talkability_rate, 1);
    assert.equal(experiment.status, "complete");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("CSV import rejects simulated, duplicate, malformed, and unmatched rows", () => {
  const parent = temp();
  try {
    const root = draftingProject(parent);
    const prepared = prepareReaderKit(root, {
      scope: "first-chapter",
      targetReader: "core thriller readers",
      minimumReaderCount: 1,
      delayedAfterHours: 48,
    });
    const csv = join(root, "books", "book-01", "reader-kit", "responses.csv");
    const header = "phase,reader_id,source,segment,recorded_at,continued_reading,would_buy,confusions,trust_breaks,lines_that_worked,remembered_hook,remembered_moments,friend_description,disagreement_question,lingering_question,recommendation_target,recommendation_reason,told_someone";
    writeFileSync(csv, `${header}\nimmediate,R-001,model,core,now,true,true,,,,,,,,,,,\n`, "utf8");
    assert.throws(() => importReaderResponses(root, prepared.experimentId, csv), /source.*human/i);
    writeFileSync(csv, `${header}\nimmediate,R-001,human,core,now,maybe,true,,,,,,,,,,,\n`, "utf8");
    assert.throws(() => importReaderResponses(root, prepared.experimentId, csv), /boolean/i);
    const unmatched = ["delayed", "R-002", "human", "core", "now", "", "", "", "", "", "hook", "moment", "description", "question", "linger", "target", "reason", "true"].join(",");
    writeFileSync(csv, `${header}\n${unmatched}\n`, "utf8");
    assert.throws(() => importReaderResponses(root, prepared.experimentId, csv), /matching immediate/i);
    writeFileSync(csv, `${header}\nimmediate,R-001,human,core,now,true,true,,,,,,,,,,,\nimmediate,R-001,human,core,now,true,true,,,,,,,,,,,\n`, "utf8");
    assert.throws(() => importReaderResponses(root, prepared.experimentId, csv), /duplicate/i);
    assert.throws(() => importReaderResponses(root, "RE-999", csv), /unknown experiment/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});