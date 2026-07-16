import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { defaultTasteProfile, defaultVoiceExperimentIndex, defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-originality-"));
}

function tasteWithReference() {
  const taste = defaultTasteProfile();
  taste.influences.push({
    id: "INF-001",
    reference: "Example Author — Example Book",
    influence_type: "voice",
    admired_for: ["compression"],
    not_for: ["signature phrasing"],
    derived_traits: ["compressed interiority"],
    status: "approved",
  });
  return taste;
}

test("voice-profile events reject direct imitation and raw influence leakage", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Original Voice", projectType: "standalone", profile: "thriller" });
    assert.throws(() => applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: "series/voice-profile.md", content: "# Voice Profile\n\nWrite in the style of Example Author and use Example Book pacing.\n" },
        { path: "series/taste-profile.yaml", content: stringifyYaml(tasteWithReference()) },
        { path: "series/voice-guardrails.yaml", content: stringifyYaml(defaultVoiceGuardrails()) },
        { path: "series/voice-experiments/index.yaml", content: stringifyYaml(defaultVoiceExperimentIndex()) },
      ],
    }), /originality|imitation|reference/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("voice-profile events accept neutral high-level craft traits", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Neutral Voice", projectType: "standalone", profile: "thriller" });
    const result = applyNovelEvent(root, {
      eventType: "voice-profile",
      expectedStage: "voice-intake",
      expectedProjectHash: projectStateHash(root),
      files: [
        { path: "series/voice-profile.md", content: "# Voice Profile\n\nUse compressed interiority, concrete sensory detail, and controlled paragraph pressure.\n" },
        { path: "series/taste-profile.yaml", content: stringifyYaml(tasteWithReference()) },
        { path: "series/voice-guardrails.yaml", content: stringifyYaml({ ...defaultVoiceGuardrails(), prefer: ["compressed interiority"] }) },
        { path: "series/voice-experiments/index.yaml", content: stringifyYaml(defaultVoiceExperimentIndex()) },
      ],
    });
    assert.equal(result.stage, "voice-intake");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
