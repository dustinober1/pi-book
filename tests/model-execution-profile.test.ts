import test from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_EXECUTION_PROFILES,
  parseModelExecutionProfileId,
} from "../src/domain/model-execution-profile.js";
import { resolveModelExecutionProfile } from "../src/application/model-execution-profile-resolver.js";
import { projectTemplateFiles } from "../src/project/templates.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { ProjectV14Schema, type ProjectStateV14 } from "../src/domain/v1-4-project-schema.js";
import { parseRunOptions } from "../src/pi/arguments.js";

test("legacy projects resolve to host-default without a stored model profile", () => {
  assert.equal(resolveModelExecutionProfile({}).id, "host-default");
  assert.equal(resolveModelExecutionProfile({ project: undefined }).id, "host-default");
});

test("small-12b-q4 is opt-in and separate from runtime and quality profiles", () => {
  const files = projectTemplateFiles({
    projectName: "Small Model",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "tiny-local",
    modelExecutionProfile: "small-12b-q4",
  });
  const project = parseYaml<ProjectStateV14>(files["PROJECT.yaml"]!, ProjectV14Schema, "PROJECT.yaml");
  assert.equal(project.runtime?.profile, "tiny-local");
  assert.equal(project.runtime?.model_execution_profile, "small-12b-q4");
  assert.equal(project.quality?.tier, "economy");
  assert.equal(resolveModelExecutionProfile({ project: project.runtime?.model_execution_profile }).id, "small-12b-q4");
  assert.deepEqual(parseRunOptions("--model-profile small-12b-q4"), {
    modelExecutionProfile: "small-12b-q4",
    resume: false,
    pause: false,
    cancel: false,
    noProse: false,
    reviewOnly: false,
    stopOnWarning: false,
  });
});

test("run override wins and unknown model profiles fail before inference", () => {
  assert.equal(resolveModelExecutionProfile({
    explicit: "host-default",
    project: "small-12b-q4",
  }).id, "host-default");
  assert.throws(() => parseModelExecutionProfileId("small"), /Unknown model execution profile: small/);
  assert.throws(() => parseRunOptions("--model-profile small"), /Unknown model execution profile: small/);
  assert.throws(() => parseRunOptions("--resume --model-profile small-12b-q4"), /cannot be combined|run-control/i);
});

test("small-12b-q4 has bounded scene and structured job policies", () => {
  const profile = MODEL_EXECUTION_PROFILES["small-12b-q4"];
  assert.deepEqual(profile.preferred_scene_words, { minimum: 700, maximum: 1200 });
  assert.ok(profile.job_budgets["draft-scene"].reservedOutputTokens > profile.job_budgets["extract-state-delta"].reservedOutputTokens);
  assert.ok(profile.decoding["draft-scene"].temperature > profile.decoding["extract-state-delta"].temperature);
});
