import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { affordableRuntimeProfile, recommendProfilesForCapacity } from "../src/application/capacity-profile-advisor.js";
import { GEMMA_3_12B_QAT_PROFILE_ID } from "../src/domain/model-fingerprint.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import { RUNTIME_PROFILES } from "../src/domain/runtime-profile.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { readProject } from "../src/project/store.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-capacity-")); }

function surfaces() {
  const commands = new Map<string, any>();
  registerNovelForgeWithRecalibration({
    registerCommand(name: string, command: any) { commands.set(name, command); },
    registerTool() {},
    sendUserMessage() {},
  } as never);
  return commands;
}

function uiContext(cwd: string, options: { contextWindow?: number; notifications?: string[]; select?: (prompt: string, options: string[]) => Promise<string | undefined> } = {}) {
  return {
    cwd,
    isIdle: () => true,
    getContextUsage: () => options.contextWindow === undefined ? undefined : { tokens: 0, contextWindow: options.contextWindow, percent: 0 },
    ui: {
      confirm: async () => true,
      input: async () => "",
      notify: (message: string) => { options.notifications?.push(message); },
      select: options.select ?? (async () => undefined),
    },
  };
}

test("every runtime profile's own budget decides whether a window can afford it", () => {
  // Derived from the profiles rather than hardcoded, so a profile whose budget
  // changes moves its own threshold instead of silently outgrowing one.
  for (const id of ["tiny-local", "local", "full"] as const) {
    const budget = RUNTIME_PROFILES[id].modelBudget;
    const required = Math.ceil((budget.maxInstructionChars + budget.maxEvidenceChars) / 4) + budget.reservedOutputTokens + budget.safetyMarginTokens;
    assert.equal(affordableRuntimeProfile(required), id, `${id} is affordable at exactly its own requirement`);
    if (id !== "tiny-local") assert.notEqual(affordableRuntimeProfile(required - 1), id, `${id} is not affordable one token short`);
  }
});

test("a small window lands on tiny-local and a large one on full", () => {
  assert.equal(affordableRuntimeProfile(4_096), "tiny-local");
  assert.equal(affordableRuntimeProfile(8_192), "tiny-local");
  assert.equal(affordableRuntimeProfile(16_384), "local");
  assert.equal(affordableRuntimeProfile(128_000), "full");
});

test("the small-model execution profile is recommended only with an exact model to fingerprint", () => {
  // qualifyGemmaModelForRun throws without an explicit selection, so
  // recommending this profile blind would write a value into PROJECT.yaml that
  // makes the first guarded call fail.
  const withoutModel = recommendProfilesForCapacity({ contextWindowTokens: 16_384 });
  assert.equal(withoutModel.runtimeProfile, "local");
  assert.equal(withoutModel.modelExecutionProfile, undefined);
  assert.match(withoutModel.reason, /requires an exact model to fingerprint/);
  assert.match(withoutModel.reason, /NOVEL_FORGE_QUALITY_MODEL/);

  const withModel = recommendProfilesForCapacity({ contextWindowTokens: 16_384, hasExplicitWorkerModel: true });
  assert.equal(withModel.modelExecutionProfile, GEMMA_3_12B_QAT_PROFILE_ID);
  assert.match(withModel.reason, /verified by fingerprint/);
});

test("the recommendation fires at the window the small-model profile actually declares", () => {
  // Gemma's own reliable window is 16,384 tokens. If the recommendation were
  // restricted to tiny-local it would never fire for the model it was built for.
  const gemmaWindow = MODEL_EXECUTION_PROFILES[GEMMA_3_12B_QAT_PROFILE_ID].reliable_context_tokens;
  const recommendation = recommendProfilesForCapacity({ contextWindowTokens: gemmaWindow, hasExplicitWorkerModel: true });
  assert.equal(recommendation.modelExecutionProfile, GEMMA_3_12B_QAT_PROFILE_ID);
});

test("a large-context host never gets an exact-model profile", () => {
  const recommendation = recommendProfilesForCapacity({ contextWindowTokens: 200_000, hasExplicitWorkerModel: true });
  assert.equal(recommendation.runtimeProfile, "full");
  assert.equal(recommendation.modelExecutionProfile, undefined);
});

test("an undetectable window reports itself instead of assuming full", () => {
  for (const input of [{}, { contextWindowTokens: 0 }, { contextWindowTokens: Number.NaN }]) {
    const recommendation = recommendProfilesForCapacity(input);
    assert.equal(recommendation.unknownCapacity, true);
    assert.equal(recommendation.runtimeProfile, "local");
    assert.match(recommendation.reason, /could not be detected/);
  }
});

test("novel-start configures a small host from its detected window and says so", async () => {
  const parent = temp();
  try {
    const notifications: string[] = [];
    await surfaces().get("novel-start").handler(
      "Small Host --profile thriller --type standalone --target-words 90000",
      uiContext(parent, { contextWindow: 8_192, notifications }),
    );
    const project = readProject(join(parent, "small-host"));
    assert.equal(project.runtime?.profile, "tiny-local");
    assert.ok(notifications.some((message) => /8,192-token context window/.test(message)), "the evidence is reported");
    assert.ok(notifications.some((message) => /runtime tiny-local/.test(message)), "the resolved configuration is reported");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("an explicit runtime profile always wins over the recommendation", async () => {
  const parent = temp();
  try {
    await surfaces().get("novel-start").handler(
      "Explicit Wins --profile thriller --type standalone --target-words 90000 --runtime-profile full",
      uiContext(parent, { contextWindow: 8_192 }),
    );
    assert.equal(readProject(join(parent, "explicit-wins")).runtime?.profile, "full");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// A fully-specified /novel-start must stay scriptable, so an undetected window
// reports its assumption rather than blocking on a question. The default is
// `local`, which is conservative in the safe direction and strictly better than
// the previous unconditional `full`.
test("an undetectable window warns and defaults conservatively without blocking", async () => {
  const parent = temp();
  try {
    const notifications: string[] = [];
    const asked: string[][] = [];
    await surfaces().get("novel-start").handler(
      "Unknown Host --profile thriller --type standalone --target-words 90000",
      uiContext(parent, {
        notifications,
        select: async (_prompt: string, options: string[]) => { asked.push(options); return undefined; },
      }),
    );
    assert.deepEqual(asked, [], "a fully-specified invocation asks nothing");
    assert.equal(readProject(join(parent, "unknown-host")).runtime?.profile, "local");
    assert.ok(notifications.some((message) => /could not be detected/.test(message)));
    assert.ok(notifications.some((message) => /--runtime-profile/.test(message)), "the override is named");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("a large-context host still gets the full profile with no question", async () => {
  const parent = temp();
  try {
    const notifications: string[] = [];
    await surfaces().get("novel-start").handler(
      "Big Host --profile thriller --type standalone --target-words 90000",
      uiContext(parent, { contextWindow: 200_000, notifications }),
    );
    const project = readProject(join(parent, "big-host"));
    assert.equal(project.runtime?.profile, "full");
    assert.equal(project.runtime?.model_execution_profile, undefined);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
