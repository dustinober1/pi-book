import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  QUALITY_TIER_POLICIES,
  defaultQualityProjectState,
  resolveQualityConfig,
} from "../src/domain/quality-profile.js";
import { initializeProject, readProject } from "../src/project/store.js";

test("missing quality state resolves to the economy compatibility workflow", () => {
  assert.deepEqual(resolveQualityConfig(), {
    tier: "economy",
    adaptive: true,
    keySceneCandidates: 2,
    maximumRevisionPasses: 1,
    factChecking: "risk-based",
    budget: {
      maximumTotalTokens: null,
      maximumTokensPerChapter: null,
      maximumCallsPerChapter: null,
      onExhaustion: "stop",
    },
  });
});

test("new projects serialize explicit snake_case quality defaults", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-profile-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Quality Defaults",
      projectType: "standalone",
      profile: "thriller",
    });
    assert.deepEqual(readProject(root).quality, defaultQualityProjectState());
    assert.deepEqual(readProject(root).quality, {
      tier: "economy",
      adaptive: true,
      key_scene_candidates: 2,
      maximum_revision_passes: 1,
      fact_checking: "risk-based",
      budget: {
        maximum_total_tokens: null,
        maximum_tokens_per_chapter: null,
        maximum_calls_per_chapter: null,
        on_exhaustion: "stop",
      },
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("quality tiers expose locked orchestration policies", () => {
  assert.deepEqual(QUALITY_TIER_POLICIES, {
    economy: { scenePlan: false, candidates: 1, criticLanes: [], finalReviewer: false, claimAudit: false },
    balanced: { scenePlan: true, candidates: 1, criticLanes: ["combined"], finalReviewer: false, claimAudit: false },
    premium: { scenePlan: true, candidates: 1, criticLanes: ["continuity", "voice", "causality", "research"], finalReviewer: false, claimAudit: false },
    editorial: { scenePlan: true, candidates: 1, criticLanes: ["continuity", "voice", "causality", "research"], finalReviewer: true, claimAudit: true },
  });
});

test("invalid quality state is rejected instead of silently normalized", () => {
  const valid = defaultQualityProjectState();
  assert.throws(() => resolveQualityConfig({ ...valid, tier: "maximum" as never }), /quality tier/i);
  assert.throws(() => resolveQualityConfig({ ...valid, key_scene_candidates: 0 }), /key scene candidates/i);
  assert.throws(() => resolveQualityConfig({ ...valid, maximum_revision_passes: -1 }), /revision passes/i);
  assert.throws(() => resolveQualityConfig({
    ...valid,
    budget: { ...valid.budget, maximum_total_tokens: 0 },
  }), /maximum total tokens/i);
});
