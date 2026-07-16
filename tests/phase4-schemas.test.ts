import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { defaultBookStrategy } from "../src/domain/v1-3-schemas.js";
import {
  BookStrategyPhase4Schema,
  PLAN_STRESS_CHECK_IDS,
  PlotGridPhase4Schema,
  defaultPhase4StressTest,
} from "../src/domain/v1-3-architecture-schemas.js";

test("legacy plot and strategy remain readable without Phase 4 fields", () => {
  parseYaml(stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [] }), PlotGridPhase4Schema, "plot-grid.yaml");
  parseYaml(stringifyYaml(defaultBookStrategy()), BookStrategyPhase4Schema, "book-strategy.yaml");
});

test("Phase 4 defaults expose every exact stress check once", () => {
  const checks = defaultPhase4StressTest();
  assert.equal(checks.length, 10);
  assert.deepEqual(checks.map((item) => item.id), [...PLAN_STRESS_CHECK_IDS]);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length);
});
