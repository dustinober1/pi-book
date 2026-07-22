import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileProjectStyleCard,
  styleCardIsStale,
} from "../src/application/style-card-compiler.js";
import { buildActiveContextCapsule } from "../src/context/active-context-capsule.js";
import { renderActiveContextCapsule } from "../src/context/active-context-renderer.js";
import type { StoryRecordIndex } from "../src/context/story-record-index.js";
import { MODEL_EXECUTION_PROFILES } from "../src/domain/model-execution-profile.js";
import type { SceneContract } from "../src/domain/scene-contract.js";
import {
  readStyleCard,
  styleCardPath,
  writeStyleCard,
} from "../src/infrastructure/style-card-store.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject } from "../src/project/store.js";

function setup(): { parent: string; root: string } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-style-card-"));
  const root = initializeProject(parent, {
    projectName: "POV Style Cards",
    projectType: "standalone",
    profile: "thriller",
  });
  writeFileSync(join(root, "series", "voice-profile.md"), `# Voice Profile

## POV distance

Close third-person.

## Narrative tense

Past tense.

## Sentence and paragraph behavior

Use compact paragraphs under pressure.
Vary sentence length without clipped artificial rhythm.

## Dialogue behavior

Keep dialogue tactical and subtext-bearing.
Avoid explanatory speeches.

## Emotional restraint and intensity

Render emotion through decisions and selective physical detail.

## Description limits

Prioritize operationally relevant detail.

## Positive voice evidence

Cause, effect, and evidence remain legible.
Concrete institutional detail carries tension.

## Not-this-author evidence

No Not X. Not Y. Z. fragments.
No breath-she-did-not-know cliché.
`, "utf8");
  writeFileSync(join(root, "series", "voice-guardrails.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    must: ["Preserve clear cause and effect.", "Keep discoveries bounded by evidence."],
    prefer: ["Use concrete procedural detail.", "Let choices reveal emotion."],
    avoid: ["Avoid repetitive rhetorical fragments.", "Avoid generic body-language filler."],
    monitor: ["Monitor repeated sentence openings.", "Monitor repeated transition phrases."],
    baseline: { path: null, content_hash: null, metrics: {} },
    pov_signatures: [{
      id: "POV-MARA",
      pov: "CHAR-MARA",
      must: ["Keep Mara analytical without making her emotionless."],
      prefer: ["Let Mara notice causal breaks before decorative detail."],
      avoid: ["Do not let Mara know facts outside her evidence chain."],
    }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-example.md"), "Mara checked the access log twice. The second timestamp changed what the first one meant.\n", "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "02-example.md"), "The door opened on schedule. The person behind it did not belong there. ".repeat(20), "utf8");
  writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "03-ignored.md"), "This third example must be ignored.\n", "utf8");
  return { parent, root };
}

test("project style cards compile deterministic POV rules within strict caps", () => {
  const { parent, root } = setup();
  try {
    const input = {
      acceptedExamplePaths: [
        "books/book-01/manuscript/chapters/01-example.md",
        "books/book-01/manuscript/chapters/02-example.md",
        "books/book-01/manuscript/chapters/03-ignored.md",
      ],
      recentPatternsToAvoid: Array.from({ length: 12 }, (_, index) => `recent-pattern-${index + 1}`),
    };
    const first = compileProjectStyleCard(root, "CHAR-MARA", input);
    const second = compileProjectStyleCard(root, "CHAR-MARA", input);
    assert.deepEqual(first, second);
    assert.equal(first.pov_distance, "Close third-person.");
    assert.equal(first.tense, "Past tense.");
    assert.ok(first.active_rules.length <= 15);
    assert.match(first.active_rules[0] ?? "", /POV MUST: Keep Mara analytical/i);
    assert.equal(first.accepted_examples.length, 2);
    assert.ok(first.accepted_examples.every((example) => example.excerpt.length <= 240));
    assert.equal(first.recent_patterns_to_avoid.length, 8);
    assert.equal(new Set(first.active_rules.map((rule) => rule.toLowerCase())).size, first.active_rules.length);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("style cards persist under the non-canonical index and detect source changes", () => {
  const { parent, root } = setup();
  try {
    const card = compileProjectStyleCard(root, "CHAR-MARA", {
      acceptedExamplePaths: ["books/book-01/manuscript/chapters/01-example.md"],
    });
    const path = writeStyleCard(root, card);
    assert.equal(path, styleCardPath(root, card.style_id));
    assert.deepEqual(readStyleCard(root, card.style_id), card);
    assert.equal(styleCardIsStale(root, card), false);

    const profilePath = join(root, "series", "voice-profile.md");
    writeFileSync(profilePath, `${readFileSync(profilePath, "utf8")}\nA newly approved density rule.\n`, "utf8");
    assert.equal(styleCardIsStale(root, card), true);
    const regenerated = compileProjectStyleCard(root, "CHAR-MARA", {
      acceptedExamplePaths: ["books/book-01/manuscript/chapters/01-example.md"],
    });
    assert.notEqual(regenerated.style_id, card.style_id);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("typed style cards render compactly inside active context capsules", () => {
  const { parent, root } = setup();
  try {
    const card = compileProjectStyleCard(root, "CHAR-MARA", {
      acceptedExamplePaths: ["books/book-01/manuscript/chapters/01-example.md"],
      recentPatternsToAvoid: ["jaw tightened", "silence stretched"],
    });
    const sourceHash = "a".repeat(64);
    const storyIndex: StoryRecordIndex = {
      records: [{
        id: "CHAR-MARA",
        kind: "entity",
        status: "current-state",
        source_path: "series/entity-registry.yaml",
        source_hash: sourceHash,
        version: 1,
        dependencies: [],
        chapter_scope: [],
        payload: { display_name: "Mara" },
      }],
      manifest: {
        schema_version: "1.0.0",
        sources: [{ path: "series/entity-registry.yaml", hash: sourceHash }],
        record_count: 1,
        index_hash: "f".repeat(64),
      },
    };
    const scene: SceneContract = {
      schema_version: "1.0.0",
      scene_id: "CH-001-SC-01-V1",
      chapter_contract_id: "CH-001",
      chapter_contract_version: 1,
      sequence: 1,
      pov: "CHAR-MARA",
      objective: "Reach the archive terminal.",
      conflict: "The credential is revoked.",
      turn: "Mara finds a maintenance route.",
      required_beats: ["Enter"],
      active_thread_ids: [],
      required_record_ids: [],
      start_state_ids: [],
      expected_state_delta: [],
      forbidden_changes: [],
      knowledge_boundary_ids: [],
      target_words: { minimum: 700, maximum: 900 },
      ending_requirement: "Reach the terminal unseen.",
    };
    const capsule = buildActiveContextCapsule({
      storyIndex,
      sceneContract: scene,
      modelProfile: MODEL_EXECUTION_PROFILES["small-12b-q4"],
      jobType: "draft-scene",
      openingRules: ["Preserve canon."],
      styleCard: card,
      closingTask: ["Draft the scene."],
    });
    const rendered = renderActiveContextCapsule(capsule, { style: "compact" });
    assert.equal(typeof capsule.style_card, "object");
    assert.match(rendered, /STYLE CARD\n- POV: CHAR-MARA/);
    assert.match(rendered, /POV MUST: Keep Mara analytical/i);
    assert.match(rendered, /RECENT PATTERNS TO AVOID: jaw tightened \| silence stretched/);
    assert.doesNotMatch(rendered, /source_hashes|voice-profile\.md/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
