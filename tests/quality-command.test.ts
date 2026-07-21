import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";
import { parseDraftOptions, parseRunOptions } from "../src/pi/arguments.js";
import { initializeProject, readProject } from "../src/project/store.js";

function commandHarness() {
  const commands = new Map<string, any>();
  const messages: string[] = [];
  const notifications: string[] = [];
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage(message: string) { messages.push(message); },
  } as never);
  return { commands, messages, notifications };
}

function context(cwd: string, notifications: string[]) {
  return {
    cwd,
    hasUI: true,
    ui: {
      input: async () => undefined,
      select: async () => undefined,
      confirm: async () => true,
      editor: async () => undefined,
      notify(message: string) { notifications.push(message); },
    },
    isIdle: () => true,
  };
}

function commitCount(root: string): number {
  return Number.parseInt(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), 10);
}

test("run and draft parsers expose validated quality overrides", () => {
  assert.deepEqual(parseRunOptions([
    "--quality-tier premium",
    "--max-total-tokens 500000",
    "--max-tokens-per-chapter 20000",
    "--max-calls-per-chapter 8",
    "--on-budget-exhaustion downgrade",
    "--max-chapters 2",
  ].join(" ")).quality, {
    tier: "premium",
    maximumTotalTokens: 500_000,
    maximumTokensPerChapter: 20_000,
    maximumCallsPerChapter: 8,
    onExhaustion: "downgrade",
  });
  assert.deepEqual(parseDraftOptions("7 --quality-tier editorial --max-calls-per-chapter 12"), {
    chapter: 7,
    quality: { tier: "editorial", maximumCallsPerChapter: 12 },
  });
});

test("quality flags reject invalid values and run-control combinations", () => {
  for (const args of [
    "--quality-tier maximum",
    "--quality-tier",
    "--max-total-tokens 0",
    "--max-tokens-per-chapter nope",
    "--max-calls-per-chapter -1",
    "--on-budget-exhaustion continue",
    "--resume --quality-tier premium",
  ]) assert.throws(() => parseRunOptions(args), /quality|token|call|budget|run-control/i, args);
});

test("novel-start stores explicit quality and budget settings", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-start-"));
  try {
    const harness = commandHarness();
    await harness.commands.get("novel-start").handler(
      '"Premium Project" --profile thriller --type standalone --target-words 100000 --quality-tier premium --max-total-tokens 500000 --max-calls-per-chapter 8 --on-budget-exhaustion downgrade',
      context(parent, harness.notifications),
    );
    const root = join(parent, "premium-project");
    assert.equal(existsSync(root), true);
    assert.deepEqual(readProject(root).quality, {
      tier: "premium",
      adaptive: true,
      key_scene_candidates: 2,
      maximum_revision_passes: 1,
      fact_checking: "risk-based",
      budget: {
        maximum_total_tokens: 500_000,
        maximum_tokens_per_chapter: null,
        maximum_calls_per_chapter: 8,
        on_exhaustion: "downgrade",
      },
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel-run snapshots quality and telemetry in one guarded run-start checkpoint", async () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-run-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Quality Run",
      projectType: "standalone",
      profile: "thriller",
    });
    const harness = commandHarness();
    const beforeCommits = commitCount(root);
    await harness.commands.get("novel-run").handler(
      "--quality-tier editorial --max-total-tokens 300000 --max-tokens-per-chapter 18000 --max-calls-per-chapter 10 --on-budget-exhaustion stop --max-chapters 2 --until next-milestone",
      context(root, harness.notifications),
    );
    assert.equal(commitCount(root), beforeCommits + 1);
    assert.deepEqual(readProject(root).automation.active_run?.quality_snapshot, {
      tier: "editorial",
      adaptive: true,
      key_scene_candidates: 2,
      maximum_revision_passes: 1,
      fact_checking: "risk-based",
      budget: {
        maximum_total_tokens: 300_000,
        maximum_tokens_per_chapter: 18_000,
        maximum_calls_per_chapter: 10,
        on_exhaustion: "stop",
      },
    });
    const report = JSON.parse(readFileSync(join(root, ".pi-book", "runs", "RUN-001", "run-report.json"), "utf8")) as { schemaVersion?: string; qualityTier?: string; modelCalls?: unknown[] };
    assert.equal(report.schemaVersion, "2.0.0");
    assert.equal(report.qualityTier, "editorial");
    assert.deepEqual(report.modelCalls, []);

    const before = JSON.stringify(readProject(root));
    await harness.commands.get("novel-budget").handler("", context(root, harness.notifications));
    const rendered = harness.notifications.at(-1) ?? "";
    assert.match(rendered, /Quality tier: economy/i);
    assert.match(rendered, /Recorded tokens: 0/i);
    assert.equal(JSON.stringify(readProject(root)), before);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
