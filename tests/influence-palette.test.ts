import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { TasteProfileSchema, defaultTasteProfile, defaultVoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { VOICE_PRECEDENCE, compileVoiceGuardrails, voiceSafetyFindings } from "../src/application/influence-palette.js";

function tasteWithExampleReference() {
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

test("taste profiles require the canonical evidence precedence", () => {
  const valid = defaultTasteProfile();
  parseYaml(stringifyYaml(valid), TasteProfileSchema, "taste-profile.yaml");
  assert.deepEqual(valid.precedence, VOICE_PRECEDENCE);
  assert.throws(
    () => parseYaml(stringifyYaml({ ...valid, precedence: [...valid.precedence].reverse() }), TasteProfileSchema, "taste-profile.yaml"),
    /schema validation/i,
  );
});

test("higher-priority writer evidence defeats a conflicting influence trait", () => {
  const result = compileVoiceGuardrails({
    explicitWriterDecisions: { must: [], prefer: [], avoid: [], monitor: [] },
    writerSamples: { must: [], prefer: [], avoid: ["ornamental metaphors"], monitor: [] },
    acceptedBaseline: { must: [], prefer: [], avoid: [], monitor: [] },
    approvedVoiceProfile: { must: [], prefer: [], avoid: [], monitor: [] },
    influenceReferences: { must: [], prefer: ["ornamental metaphors"], avoid: [], monitor: [] },
    genreDefaults: { must: [], prefer: [], avoid: [], monitor: [] },
  });

  assert.deepEqual(result.guardrails.avoid, ["ornamental metaphors"]);
  assert.equal(result.guardrails.prefer.includes("ornamental metaphors"), false);
  assert.ok(result.suppressed.some((item) => item.rule === "ornamental metaphors" && item.layer === "influence-references"));
});

test("compiled rules retain stable precedence order while removing duplicates", () => {
  const result = compileVoiceGuardrails({
    explicitWriterDecisions: { must: ["concrete sensory detail"], prefer: [], avoid: [], monitor: [] },
    writerSamples: { must: [], prefer: ["controlled interiority"], avoid: [], monitor: [] },
    acceptedBaseline: { must: [], prefer: ["controlled interiority"], avoid: [], monitor: [] },
    approvedVoiceProfile: { must: [], prefer: [], avoid: [], monitor: [] },
    influenceReferences: { must: [], prefer: ["compressed paragraphs"], avoid: [], monitor: [] },
    genreDefaults: { must: [], prefer: ["clear causality"], avoid: [], monitor: [] },
  });

  assert.deepEqual(result.guardrails.must, ["concrete sensory detail"]);
  assert.deepEqual(result.guardrails.prefer, ["controlled interiority", "compressed paragraphs", "clear causality"]);
  assert.equal(result.suppressed.length, 1);
});

test("direct imitation language is blocked while neutral craft language is accepted", () => {
  const taste = tasteWithExampleReference();
  assert.ok(voiceSafetyFindings({
    taste,
    voiceProfile: "Write in the style of Example Author.",
    guardrails: defaultVoiceGuardrails(),
  }).some((item) => item.code === "direct-imitation"));

  assert.deepEqual(voiceSafetyFindings({
    taste,
    voiceProfile: "Use compressed interiority and concrete sensory detail.",
    guardrails: { ...defaultVoiceGuardrails(), prefer: ["compressed interiority"] },
  }), []);
});

test("raw influence names are blocked from compiled guardrails and voice profile", () => {
  const taste = tasteWithExampleReference();
  assert.ok(voiceSafetyFindings({
    taste,
    voiceProfile: "example author is the model.",
    guardrails: defaultVoiceGuardrails(),
  }).some((item) => item.code === "raw-reference"));
  assert.ok(voiceSafetyFindings({
    taste,
    voiceProfile: "Neutral project voice.",
    guardrails: { ...defaultVoiceGuardrails(), prefer: ["Use Example Book pacing"] },
  }).some((item) => item.code === "raw-reference"));
});

test("short work titles do not collide with ordinary lowercase prose", () => {
  const taste = defaultTasteProfile();
  taste.influences.push({
    id: "INF-001",
    reference: "Cormac McCarthy — The Road",
    influence_type: "voice",
    admired_for: ["restraint"],
    not_for: ["signature phrasing"],
    derived_traits: ["restrained description"],
    status: "approved",
  });

  assert.deepEqual(voiceSafetyFindings({
    taste,
    voiceProfile: "The character walked down the road without looking back.",
    guardrails: defaultVoiceGuardrails(),
  }), []);

  assert.ok(voiceSafetyFindings({
    taste,
    voiceProfile: "The Road is the model for this project's pacing.",
    guardrails: defaultVoiceGuardrails(),
  }).some((item) => item.code === "raw-reference"));
});

test("missing voice profile text is treated as empty rather than throwing", () => {
  assert.doesNotThrow(() => voiceSafetyFindings({
    taste: tasteWithExampleReference(),
    voiceProfile: null,
    guardrails: defaultVoiceGuardrails(),
  }));
});
