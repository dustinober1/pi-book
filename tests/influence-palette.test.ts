import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import { TasteProfileSchema, defaultTasteProfile } from "../src/domain/v1-3-schemas.js";
import { VOICE_PRECEDENCE, compileVoiceGuardrails } from "../src/application/influence-palette.js";

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
