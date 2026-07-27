import test from "node:test";
import assert from "node:assert/strict";
import { structuralRhythmFindings } from "../src/application/structural-rhythm.js";
import type { ChapterQueueState } from "../src/domain/schemas.js";
import type { PlotGridPhase4 } from "../src/domain/v1-3-architecture-schemas.js";

function packet(chapter: number, overrides: Partial<ChapterQueueState["packets"][number]> = {}) {
  return {
    chapter, title: `Chapter ${chapter}`, status: "ready" as const, pov: "Mara", purpose: "press",
    scene_engine: chapter % 2 === 0 ? "attack" : "negotiation", pressure_movement: "worse",
    character_movement: "chooses", relationship_movement: "changes", story_thread_refs: [],
    continuity_refs: [], character_refs: [], required_research: [], profile_fields: {},
    ending_hook: `hook ${chapter}`, milestone_gate: null, target_words: 3_000 + chapter * 250,
    ...overrides,
  };
}

function queueOf(packets: ReturnType<typeof packet>[]): ChapterQueueState {
  return { schema_version: "1.0.0", active_window: "act-1", packets };
}

function plotOf(count: number, causality: (chapter: number) => string): PlotGridPhase4 {
  return {
    schema_version: "1.0.0",
    acts: [],
    chapters: Array.from({ length: count }, (_, index) => ({
      chapter: index + 1, act: "act-1", causality: causality(index + 1),
      state_change: "threat visible", setup_ids: [], payoff_ids: [], profile_obligations: [],
    })),
  } as PlotGridPhase4;
}

const variedPlot = plotOf(8, (chapter) => (chapter % 3 === 0 ? "but" : "therefore"));

function codes(findings: ReturnType<typeof structuralRhythmFindings>): string[] {
  return findings.map((item) => item.code).sort();
}

test("a plan with varied chapter lengths, POV and causality produces no findings", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    pov: index % 3 === 0 ? "Elias" : "Mara",
  })));
  assert.deepEqual(structuralRhythmFindings(queue, variedPlot), []);
});

test("identical chapter targets are a blocker that names the draft band", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    target_words: 7_000,
    pov: index % 3 === 0 ? "Elias" : "Mara",
  })));
  const findings = structuralRhythmFindings(queue, variedPlot);
  const finding = findings.find((item) => item.code === "uniform-chapter-length");

  assert.ok(finding);
  assert.equal(finding.severity, "blocker");
  assert.match(finding.message, /All 8 planned chapters carry the same target of 7,000 words/);
  assert.match(finding.message, /85%–110%/);
  assert.match(finding.message, /Vary target_words/);
});

test("near-uniform targets are a warning rather than a blocker", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    target_words: 7_000 + index * 10,
    pov: index % 3 === 0 ? "Elias" : "Mara",
  })));
  const findings = structuralRhythmFindings(queue, variedPlot);
  const finding = findings.find((item) => item.code === "low-chapter-length-variance");

  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.equal(findings.some((item) => item.code === "uniform-chapter-length"), false);
});

test("a plan shorter than the dispersion floor is never measured", () => {
  const queue = queueOf(Array.from({ length: 4 }, (_, index) => packet(index + 1, { target_words: 7_000 })));
  assert.deepEqual(codes(structuralRhythmFindings(queue, plotOf(4, () => "therefore"))), []);
});

test("a fixed POV rotation cycle is reported, and a single-POV book is not", () => {
  const rotating = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    pov: ["Mara", "Elias"][index % 2] ?? "Mara",
  })));
  const finding = structuralRhythmFindings(rotating, variedPlot).find((item) => item.code === "periodic-pov-rotation");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.message, /fixed 2-chapter cycle/);

  // A single-POV novel is a normal choice, not a rhythm defect.
  const single = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1)));
  assert.equal(structuralRhythmFindings(single, variedPlot).some((item) => item.code === "periodic-pov-rotation"), false);

  // An irregular rotation is the point of having more than one POV.
  const irregular = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    pov: [0, 3, 4].includes(index) ? "Elias" : "Mara",
  })));
  assert.equal(structuralRhythmFindings(irregular, variedPlot).some((item) => item.code === "periodic-pov-rotation"), false);
});

test("one causal joint dominating the plot is reported", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    pov: index % 3 === 0 ? "Elias" : "Mara",
  })));
  const finding = structuralRhythmFindings(queue, plotOf(8, () => "therefore")).find((item) => item.code === "uniform-causality");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.message, /100% of planned chapters turn on the same causal joint/);
});

test("repeated chapter ending beats are reported", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, {
    pov: index % 3 === 0 ? "Elias" : "Mara",
    ending_hook: index < 6 ? "a door closes" : `hook ${index}`,
  })));
  const finding = structuralRhythmFindings(queue, variedPlot).find((item) => item.code === "uniform-chapter-endings");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.message, /only 3 distinct ending beats/);
});

test("findings are deterministic", () => {
  const queue = queueOf(Array.from({ length: 8 }, (_, index) => packet(index + 1, { target_words: 7_000 })));
  assert.deepEqual(structuralRhythmFindings(queue, variedPlot), structuralRhythmFindings(queue, variedPlot));
});
