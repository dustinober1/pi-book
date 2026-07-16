import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapProjectFromBrief } from "../../src/application/brief-bootstrap.js";
import { beginAutopilotRun } from "../../src/application/autopilot.js";
import { pausePersistentRun, resumePersistentRun } from "../../src/application/run.js";
import { packetWindowDecision } from "../../src/application/packet-window.js";
import { initializeProject, readProject } from "../../src/project/store.js";


test("clean 1.4 journey preserves source evidence and persistent intent", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-v14-release-"));
  try {
    const root = initializeProject(parent, { projectName: "Release Journey", projectType: "planned-series", profile: "thriller", targetWords: 110000 });
    const source = join(parent, "brief.md");
    const brief = `## Idea\nMara follows a signal no one else can hear.\n\nLanguage: English\nAudience: Adult thriller readers\nProfile: thriller\nTarget Words: 110000\n`;
    writeFileSync(source, brief, "utf8");
    bootstrapProjectFromBrief(root, source, { profile: "thriller", targetWords: 110000, decidedAt: "2026-07-16T12:00:00Z" });
    const decision = beginAutopilotRun(root, { target: "book-plan-approval", maxChapters: 3, now: "2026-07-16T12:01:00Z" });
    assert.equal(decision.action, "voice");
    pausePersistentRun(root, "2026-07-16T12:02:00Z");
    const resumed = resumePersistentRun(root, "2026-07-16T12:03:00Z");
    assert.equal(resumed.action, "voice");
    assert.equal((readProject(root) as any).automation.active_run?.target, "book-plan-approval");
    assert.equal(readFileSync(source, "utf8"), brief);

    const queue = { schema_version: "1.0.0" as const, active_window: "rolling", packets: [] };
    const plot = {
      schema_version: "1.0.0" as const,
      acts: [{ id: "I", purpose: "build", start_chapter: 1, end_chapter: 10, gate: null }],
      chapters: Array.from({ length: 10 }, (_, index) => ({ chapter: index + 1, act: "I", causality: "therefore", state_change: `state-${index + 1}`, setup_ids: [], payoff_ids: [], profile_obligations: [] })),
      decisions: [],
    };
    assert.deepEqual(packetWindowDecision(queue, plot, new Set()).candidateChapters, [1, 2, 3, 4, 5, 6]);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
