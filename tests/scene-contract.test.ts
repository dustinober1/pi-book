import test from "node:test";
import assert from "node:assert/strict";
import {
  compileSceneContracts,
  derivedSingleSceneBeat,
  sceneStructureFindings,
} from "../src/application/contracts/scene-contract-compiler.js";
import type { ChapterContract, SceneBeat } from "../src/domain/chapter-contract.js";

const baseChapter: ChapterContract = {
  schema_version: "2.0.0",
  contract_id: "CH-001",
  version: 1,
  chapter: 1,
  title: "The Archive",
  source_kind: "approved-contract",
  source_packet_hash: "a".repeat(64),
  pov: "CHAR-MARA",
  purpose: "Recover the ledger.",
  required_beats: ["Enter archive", "Discover prior access", "Choose evidence over safety"],
  active_thread_ids: ["THREAD-LEDGER", "THREAD-DEVLIN"],
  required_record_ids: ["CHAR-MARA", "THREAD-LEDGER"],
  start_state_ids: ["STATE-MARA-001"],
  required_end_state: [{ record_id: "STATE-MARA-001", field: "knowledge", operation: "add", value: "FACT-PRIOR-ACCESS" }],
  forbidden_changes: ["Do not identify the prior user."],
  knowledge_boundary_ids: ["KNOW-MARA-001"],
  target_words: { minimum: 2100, maximum: 2600 },
  ending_hook: "Someone used the terminal first.",
  small_model_ready: true,
  missing_small_model_fields: [],
};

const sceneBeats: SceneBeat[] = [
  { objective: "Get into the archive before the audit closes", conflict: "The night warden logs every entry", turn: "Mara is inside, and on the log" },
  { objective: "Find the ledger on the terminal", conflict: "The index has been rewritten", turn: "The ledger is gone, and recently" },
  { objective: "Decide whether to take the access record", conflict: "Taking it proves she was here", turn: "She takes it" },
];

const authored: ChapterContract = { ...baseChapter, scene_beats: sceneBeats };

test("an authored chapter compiles one scene per beat, in order", () => {
  const scenes = compileSceneContracts(authored);
  assert.equal(scenes.length, 3);
  assert.deepEqual(scenes.map((scene) => scene.objective), sceneBeats.map((beat) => beat.objective));
  assert.deepEqual(scenes.map((scene) => scene.conflict), sceneBeats.map((beat) => beat.conflict));
  assert.deepEqual(scenes.map((scene) => scene.turn), sceneBeats.map((beat) => beat.turn));
  assert.deepEqual(scenes.map((scene) => scene.sequence), [1, 2, 3]);
});

/**
 * The regression this whole change exists for. Round-robin dealing produced
 * scenes whose objective, conflict, turn and ending requirement were one
 * repeated string — an eight-word genre label standing in for a scene brief.
 */
test("no scene repeats one statement as its objective, conflict and turn", () => {
  for (const scene of compileSceneContracts(authored)) {
    assert.notEqual(scene.objective, scene.conflict, scene.scene_id);
    assert.notEqual(scene.objective, scene.turn, scene.scene_id);
    assert.notEqual(scene.conflict, scene.turn, scene.scene_id);
    assert.ok(
      !(scene.objective === scene.turn && scene.turn === scene.ending_requirement),
      `${scene.scene_id} collapsed objective, turn and ending requirement`,
    );
  }
});

test("a scene brief that names one fact twice is refused rather than compiled", () => {
  const collapsed: ChapterContract = {
    ...baseChapter,
    scene_beats: [{ objective: "Interrogation", conflict: "Interrogation", turn: "Interrogation" }, ...sceneBeats.slice(1)],
  };
  const findings = sceneStructureFindings(collapsed);
  assert.ok(findings.some((item) => item.includes("objective") && item.includes("conflict")), findings.join("\n"));
  assert.throws(() => compileSceneContracts(collapsed), /no executable scene structure/);
});

test("chapter order is preserved rather than dealt across scenes", () => {
  // With five beats and four scenes the old round-robin put beat 5 in scene 1,
  // ahead of the beat in scene 4 that motivated it.
  const scenes = compileSceneContracts(authored);
  assert.deepEqual(scenes[0]!.required_beats, [sceneBeats[0]!.objective, sceneBeats[0]!.conflict, sceneBeats[0]!.turn]);
  assert.deepEqual(scenes.at(-1)!.required_beats, [sceneBeats[2]!.objective, sceneBeats[2]!.conflict, sceneBeats[2]!.turn]);
});

test("every scene keeps the chapter's threads unless the author narrowed it", () => {
  const scenes = compileSceneContracts(authored);
  // A scene with no active threads cannot report thread movement at all, which
  // is what dealing threads round-robin silently caused.
  assert.ok(scenes.every((scene) => scene.active_thread_ids.length > 0));
  assert.deepEqual(scenes[1]!.active_thread_ids, ["THREAD-LEDGER", "THREAD-DEVLIN"]);

  const narrowed = compileSceneContracts({
    ...authored,
    scene_beats: [{ ...sceneBeats[0]!, thread_ids: ["THREAD-LEDGER"] }, sceneBeats[1]!, sceneBeats[2]!],
  });
  assert.deepEqual(narrowed[0]!.active_thread_ids, ["THREAD-LEDGER"]);
});

test("a scene cannot claim a thread the chapter does not carry", () => {
  const findings = sceneStructureFindings({
    ...authored,
    scene_beats: [{ ...sceneBeats[0]!, thread_ids: ["THREAD-GHOST"] }, sceneBeats[1]!, sceneBeats[2]!],
  });
  assert.ok(findings.some((item) => item.includes("THREAD-GHOST")), findings.join("\n"));
});

test("only the final scene carries the chapter's ending hook and end state", () => {
  const scenes = compileSceneContracts(authored);
  assert.equal(scenes.at(-1)!.ending_requirement, baseChapter.ending_hook);
  assert.deepEqual(scenes.at(-1)!.expected_state_delta, baseChapter.required_end_state);
  for (const scene of scenes.slice(0, -1)) {
    assert.notEqual(scene.ending_requirement, baseChapter.ending_hook);
    assert.deepEqual(scene.expected_state_delta, []);
  }
});

test("scene word ranges cover the chapter target range exactly", () => {
  const scenes = compileSceneContracts(authored);
  assert.equal(scenes.reduce((sum, scene) => sum + scene.target_words.minimum, 0), baseChapter.target_words.minimum);
  assert.equal(scenes.reduce((sum, scene) => sum + scene.target_words.maximum, 0), baseChapter.target_words.maximum);
});

test("a split that would leave a scene under the contract floor is refused", () => {
  const findings = sceneStructureFindings({
    ...baseChapter,
    target_words: { minimum: 400, maximum: 500 },
    scene_beats: [...sceneBeats, { objective: "a", conflict: "b", turn: "c" }, { objective: "d", conflict: "e", turn: "f" }],
  });
  assert.ok(findings.some((item) => item.includes("150-word floor")), findings.join("\n"));
});

test("scene IDs remain stable for the same chapter contract version", () => {
  assert.deepEqual(
    compileSceneContracts(authored).map((scene) => scene.scene_id),
    compileSceneContracts(authored).map((scene) => scene.scene_id),
  );
});

test("scene count is the contract's decision, not the caller's", () => {
  assert.throws(() => compileSceneContracts(authored, 2), /Scene count is the contract's decision/);
  assert.doesNotThrow(() => compileSceneContracts(authored, 3));
});

test("a chapter too long for one scene must say what its scenes are", () => {
  const findings = sceneStructureFindings(baseChapter);
  assert.ok(findings.some((item) => item.includes("declares no scene structure")), findings.join("\n"));
  assert.throws(() => compileSceneContracts(baseChapter), /must say what its scenes are/);
});

test("a chapter short enough for one scene derives it from named fields and keeps every beat", () => {
  const short: ChapterContract = { ...baseChapter, target_words: { minimum: 700, maximum: 900 } };
  assert.deepEqual(sceneStructureFindings(short), []);
  const scenes = compileSceneContracts(short);
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0]!.objective, short.purpose);
  // The lone scene is the chapter, so it carries every chapter beat rather than
  // a share of them.
  assert.deepEqual(scenes[0]!.required_beats, short.required_beats);
  assert.equal(scenes[0]!.ending_requirement, short.ending_hook);
  assert.deepEqual(scenes[0]!.active_thread_ids, short.active_thread_ids);
});

test("the derived beat picks three different chapter statements when it can", () => {
  const beat = derivedSingleSceneBeat({ ...baseChapter, target_words: { minimum: 700, maximum: 900 } });
  assert.equal(beat.objective, "Recover the ledger.");
  assert.equal(beat.conflict, "Enter archive");
  assert.equal(beat.turn, "Choose evidence over safety");
});

test("the derived beat falls back to the ending hook rather than repeating itself", () => {
  const thin: ChapterContract = {
    ...baseChapter,
    purpose: "Reach the terminal.",
    // Trailing punctuation must not make a repeat look like a distinct beat.
    required_beats: ["Reach the terminal"],
    target_words: { minimum: 700, maximum: 900 },
  };
  const beat = derivedSingleSceneBeat(thin);
  assert.equal(beat.objective, "Reach the terminal.");
  assert.equal(beat.conflict, thin.ending_hook);
  assert.equal(beat.turn, thin.ending_hook);
  assert.deepEqual(sceneStructureFindings(thin), []);
});
