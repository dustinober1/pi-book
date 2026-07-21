import test from "node:test";
import assert from "node:assert/strict";
import { RUNTIME_PROFILES, parseRuntimeProfileId } from "../src/domain/runtime-profile.js";
import { applyRuntimeLimits, resolveRuntimeProfile } from "../src/application/runtime-profile-resolver.js";

test("runtime profiles expose the locked constrained budgets", () => {
  assert.deepEqual(RUNTIME_PROFILES["tiny-local"], {
    id: "tiny-local",
    maxContextChars: 12_000,
    maxPromptChars: 6_000,
    modelBudget: {
      maxInstructionChars: 6_000,
      maxEvidenceChars: 12_000,
      reservedOutputTokens: 2_000,
      safetyMarginTokens: 500,
    },
    graphDepth: 1,
    promptStyle: "compact",
    maxArtifactsPerStage: 1,
    maxChaptersPerRun: 1,
    maxRevisionTickets: 1,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: true,
  });
  assert.deepEqual(RUNTIME_PROFILES.local, {
    id: "local",
    maxContextChars: 24_000,
    maxPromptChars: 10_000,
    modelBudget: {
      maxInstructionChars: 10_000,
      maxEvidenceChars: 24_000,
      reservedOutputTokens: 4_000,
      safetyMarginTokens: 1_000,
    },
    graphDepth: 2,
    promptStyle: "compact",
    maxArtifactsPerStage: 2,
    maxChaptersPerRun: 1,
    maxRevisionTickets: 2,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: false,
  });
  assert.deepEqual(RUNTIME_PROFILES.full, {
    id: "full",
    maxContextChars: 72_000,
    maxPromptChars: 24_000,
    modelBudget: {
      maxInstructionChars: 24_000,
      maxEvidenceChars: 72_000,
      reservedOutputTokens: 8_000,
      safetyMarginTokens: 2_000,
    },
    graphDepth: 2,
    promptStyle: "standard",
    maxArtifactsPerStage: null,
    maxChaptersPerRun: null,
    maxRevisionTickets: null,
    preferStructuredIR: true,
    maxRepairAttempts: 2,
    stopOnContextWarning: false,
  });
});

test("runtime profile resolution follows explicit project local and compatibility precedence", () => {
  assert.equal(resolveRuntimeProfile({}).id, "full");
  assert.equal(resolveRuntimeProfile({ local: "local" }).id, "local");
  assert.equal(resolveRuntimeProfile({ project: "tiny-local", local: "local" }).id, "tiny-local");
  assert.equal(resolveRuntimeProfile({ explicit: "full", project: "tiny-local", local: "local" }).id, "full");
});

test("unknown runtime profiles fail instead of silently falling back", () => {
  assert.throws(() => parseRuntimeProfileId("small"), /Unknown runtime profile: small.*tiny-local, local, full/);
  assert.throws(() => resolveRuntimeProfile({ explicit: "small" }), /Unknown runtime profile: small/);
  assert.throws(() => resolveRuntimeProfile({ project: "small" }), /Unknown runtime profile: small/);
  assert.throws(() => resolveRuntimeProfile({ local: "small" }), /Unknown runtime profile: small/);
});

test("tiny-local and local normalize work into hard micro-step budgets", () => {
  assert.deepEqual(applyRuntimeLimits({
    profile: RUNTIME_PROFILES["tiny-local"],
    projectMaxChapters: 7,
    requestedMaxChapters: 5,
    availableArtifacts: 8,
    availableRevisionTickets: 9,
  }), {
    maxChapters: 1,
    maxArtifacts: 1,
    maxRevisionTickets: 1,
    graphDepth: 1,
  });

  assert.deepEqual(applyRuntimeLimits({
    profile: RUNTIME_PROFILES.local,
    projectMaxChapters: 7,
    requestedMaxChapters: 5,
    availableArtifacts: 8,
    availableRevisionTickets: 9,
  }), {
    maxChapters: 1,
    maxArtifacts: 2,
    maxRevisionTickets: 2,
    graphDepth: 2,
  });
});

test("full preserves current explicit and project automation limits", () => {
  assert.deepEqual(applyRuntimeLimits({
    profile: RUNTIME_PROFILES.full,
    projectMaxChapters: 3,
    requestedMaxChapters: 5,
    availableArtifacts: 8,
    availableRevisionTickets: 9,
  }), {
    maxChapters: 5,
    maxArtifacts: 8,
    maxRevisionTickets: 9,
    graphDepth: 2,
  });
  assert.deepEqual(applyRuntimeLimits({
    profile: RUNTIME_PROFILES.full,
    projectMaxChapters: 3,
  }), {
    maxChapters: 3,
    maxArtifacts: null,
    maxRevisionTickets: null,
    graphDepth: 2,
  });
});
