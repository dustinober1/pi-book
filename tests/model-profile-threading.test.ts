import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beginPersistentRun } from "../src/application/run.js";
import { renderBudgetStatus } from "../src/application/budget-status.js";
import { getProjectStatus } from "../src/application/status.js";
import { GEMMA_3_12B_QAT_PROFILE_ID } from "../src/domain/model-fingerprint.js";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";
import { initializeProject, readProject } from "../src/project/store.js";

const GEMMA = GEMMA_3_12B_QAT_PROFILE_ID;

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-model-profile-")); }

function surfaces() {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  registerNovelForgeWithRecalibration({
    registerCommand(name: string, command: any) { commands.set(name, command); },
    registerTool(tool: any) { tools.set(tool.name, tool); },
    sendUserMessage() {},
  } as never);
  return { tools, commands };
}

function uiContext(cwd: string, notifications: string[]) {
  return {
    cwd,
    isIdle: () => true,
    ui: {
      confirm: async () => true,
      input: async () => "",
      notify: (message: string) => { notifications.push(message); },
      select: async () => undefined,
    },
  };
}

test("/novel-start --model-profile writes runtime.model_execution_profile", async () => {
  const parent = temp();
  try {
    const notifications: string[] = [];
    const { commands } = surfaces();
    await commands.get("novel-start").handler(
      `Signal --profile thriller --type standalone --target-words 90000 --model-profile ${GEMMA}`,
      uiContext(parent, notifications),
    );
    const root = join(parent, "signal");
    const project = readProject(root);
    assert.equal(project.runtime?.model_execution_profile, GEMMA);
    // The selection must be visible wherever the other three controls are shown.
    const status = getProjectStatus(root);
    assert.equal(status.modelExecutionProfile, GEMMA);
    assert.match(status.markdown, new RegExp(`Model execution profile: ${GEMMA}`));
    assert.match(renderBudgetStatus(root), new RegExp(`Model execution profile: ${GEMMA}`));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("/novel-start without the flag leaves the project on host-default resolution", async () => {
  const parent = temp();
  try {
    const { commands } = surfaces();
    await commands.get("novel-start").handler(
      "Plain --profile thriller --type standalone --target-words 90000",
      uiContext(parent, []),
    );
    const root = join(parent, "plain");
    assert.equal(readProject(root).runtime?.model_execution_profile, undefined);
    assert.equal(getProjectStatus(root).modelExecutionProfile, "host-default");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("--model-profile custom is rejected at parse time with the selectable list", async () => {
  const parent = temp();
  try {
    const { commands } = surfaces();
    await assert.rejects(
      () => commands.get("novel-start").handler(
        "Poison --profile thriller --type standalone --target-words 90000 --model-profile custom",
        uiContext(parent, []),
      ),
      /cannot select custom.*Selectable profiles/s,
    );
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("the deprecated small-12b-q4 alias surfaces its advisory and canonicalizes in status", async () => {
  const parent = temp();
  try {
    const notifications: string[] = [];
    const { commands } = surfaces();
    await commands.get("novel-start").handler(
      "Alias --profile thriller --type standalone --target-words 90000 --model-profile small-12b-q4",
      uiContext(parent, notifications),
    );
    assert.ok(notifications.some((message) => /small-12b-q4 profile is deprecated/.test(message)));
    const root = join(parent, "alias");
    assert.equal(readProject(root).runtime?.model_execution_profile, "small-12b-q4");
    assert.equal(getProjectStatus(root).modelExecutionProfile, GEMMA);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("/novel-run --model-profile snapshots the profile on the persistent run", async () => {
  const parent = temp();
  try {
    const { commands } = surfaces();
    await commands.get("novel-start").handler(
      "Runner --profile thriller --type standalone --target-words 90000",
      uiContext(parent, []),
    );
    const root = join(parent, "runner");
    await commands.get("novel-run").handler(
      `--until voice-approval --max-chapters 1 --model-profile ${GEMMA}`,
      uiContext(root, []),
    );
    const run = readProject(root).automation.active_run;
    assert.ok(run, "a persistent run must exist");
    assert.equal(run.modelExecutionProfile, GEMMA);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("beginPersistentRun stores the model execution profile beside the runtime profile", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Direct", projectType: "standalone", profile: "thriller" });
    const decision = beginPersistentRun(root, { target: "voice-approval", maxChapters: 1, modelExecutionProfile: GEMMA });
    assert.ok(decision.prompt, "a fresh project has a voice-intake prompt");
    const run = readProject(root).automation.active_run;
    assert.equal(run?.modelExecutionProfile, GEMMA);
    assert.equal(run?.runtimeProfile, "full");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

// Anti-regression for the class of defect this phase fixed: parseDraftOptions and
// parseRunOptions produced modelExecutionProfile for two releases while both
// callers destructured everything except it. A parsed field that no consuming
// module references reads as configured and does nothing. The lists below mirror
// DraftOptions and ParsedRunOptions in src/pi/arguments.ts; when a field is added
// there, this test fails until some consumer actually reads it.
test("every parsed draft and run option field is read by a consuming module", () => {
  const consumers = [
    "src/pi/extension.ts",
    "src/pi/recalibration-extension.ts",
    "src/application/run.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  const draftFields = ["chapter", "quality", "modelExecutionProfile"];
  const runFields = [
    "approve", "until", "maxChapters", "runtimeProfile", "modelExecutionProfile", "quality",
    "resume", "pause", "cancel", "noProse", "reviewOnly", "stopOnWarning",
  ];
  for (const field of new Set([...draftFields, ...runFields])) {
    const pattern = new RegExp(`(?:draft|parsed|options)\\.${field}\\b`);
    assert.match(consumers, pattern, `parsed option field ${field} is produced but never consumed`);
  }
});
