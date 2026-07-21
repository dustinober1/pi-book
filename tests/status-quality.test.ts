import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGuideScreen } from "../src/application/guide.js";
import { refreshGuidance } from "../src/application/handoff.js";
import { getProjectStatus } from "../src/application/status.js";
import { initializeProject } from "../src/project/store.js";

test("status handoff and guide render genre runtime and quality separately", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-status-quality-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Status Quality",
      projectType: "standalone",
      profile: "thriller",
      runtimeProfile: "local",
      quality: {
        tier: "premium",
        adaptive: true,
        key_scene_candidates: 2,
        maximum_revision_passes: 1,
        fact_checking: "risk-based",
        budget: {
          maximum_total_tokens: 500_000,
          maximum_tokens_per_chapter: 20_000,
          maximum_calls_per_chapter: 8,
          on_exhaustion: "stop",
        },
      },
    });

    const status = getProjectStatus(root, { gitDirtyOverride: 0 });
    assert.equal(status.runtimeProfile, "local");
    assert.equal(status.qualityTier, "premium");
    assert.match(status.markdown, /Genre profile: thriller/);
    assert.match(status.markdown, /Runtime profile: local/);
    assert.match(status.markdown, /Quality tier: premium/);

    refreshGuidance(root);
    const handoff = readFileSync(join(root, "HANDOFF.md"), "utf8");
    assert.match(handoff, /Genre profile: thriller/);
    assert.match(handoff, /Runtime profile: local/);
    assert.match(handoff, /Quality tier: premium/);

    const screen = buildGuideScreen(root);
    assert.ok(screen.actions.some((action) => action.id === "budget" && /budget/i.test(action.label)));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
