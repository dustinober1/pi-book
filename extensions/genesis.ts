import { Type } from "typebox";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(PACKAGE_ROOT, "references", "pipeline", "manifest.yaml");
const GENESIS_SCHEMA_VERSION = "0.2.0";

const DEFAULT_PHASE_DEFINITIONS = [
  {
    key: "phase_0_intake",
    label: "Phase 0: Intake",
    prompt: "references/prompts/intake.md",
    gate: "intake",
    outputs: [
      "ASSUMPTIONS.md",
      "artifacts/00-brief.md",
      "artifacts/01-market-map.md",
      "artifacts/02-story-engine.md",
      "artifacts/author-intent.md",
      "artifacts/taste-profile.md",
      "artifacts/risk-budget.md",
      "artifacts/discarded-choices.md",
      "artifacts/review-personas.md",
      "artifacts/publication-shape.md",
    ],
    next: "Phase 1: Foundation",
  },
  {
    key: "phase_1_foundation",
    label: "Phase 1: Foundation",
    prompt: "references/prompts/foundation.md",
    gate: "foundation",
    outputs: [
      "artifacts/03-characters.md",
      "artifacts/04-theme.md",
      "artifacts/voice-bible.md",
      "artifacts/author-voice-fingerprint.md",
      "artifacts/human-source-bank.md",
      "artifacts/name-collision-audit.md",
      "artifacts/name-entity-filter.md",
      "artifacts/opposition-case.md",
      "artifacts/06-emotional-curve.md",
    ],
    next: "Phase 2: Architecture",
  },
  {
    key: "phase_2_architecture",
    label: "Phase 2: Architecture",
    prompt: "references/prompts/architecture.md",
    gate: "architecture",
    outputs: [
      "artifacts/05-outline.md",
      "artifacts/causality-chain.md",
      "artifacts/scene-embodiment-map.md",
      "artifacts/05-subplot-map.md",
      "artifacts/continuity-ledger.md",
      "artifacts/reader-promise-tracker.md",
      "artifacts/drift-loop-alarm.md",
      "artifacts/expansion-integrity.md",
      "artifacts/publication-shape.md",
      "artifacts/technical-seed-map.md",
      "artifacts/system-rule-sheet.md",
      "artifacts/authority-chain-map.md",
      "artifacts/opposition-case.md",
      "artifacts/domain-plausibility-audit.md",
      "artifacts/commercial-proof.md",
      "artifacts/category-competition-map.md",
      "artifacts/title-subtitle-options.md",
      "artifacts/07-opening-strategy.md",
    ],
    next: "Phase 3: Drafting",
  },
  {
    key: "phase_3_drafting",
    label: "Phase 3: Drafting",
    prompt: "references/prompts/drafting.md",
    gate: "drafting",
    outputs: [
      "manuscript/chapters",
      "artifacts/expansion-integrity.md",
      "artifacts/human-specificity-ledger.md",
      "artifacts/subtext-audit.md",
      "artifacts/ear-pass.md",
      "artifacts/over-polish-audit.md",
      "artifacts/scene-embodiment-map.md",
      "artifacts/discarded-choices.md",
      "evaluations/chapter-scorecards.md",
    ],
    next: "Phase 4: Adversarial Audit",
  },
  {
    key: "phase_4_adversarial_audit",
    label: "Phase 4: Adversarial Audit",
    prompt: "references/prompts/adversarial-audit.md",
    gate: "adversarial_audit",
    outputs: [
      "artifacts/08-adversarial-audit.md",
      "artifacts/narrative-fingerprint-audit.md",
      "artifacts/ai-tell-mitigation-audit.md",
      "artifacts/subtext-audit.md",
      "artifacts/ear-pass.md",
      "artifacts/over-polish-audit.md",
      "artifacts/negative-capability-audit.md",
      "artifacts/domain-plausibility-audit.md",
      "artifacts/expansion-integrity.md",
      "artifacts/publication-shape.md",
      "artifacts/sample-reader-feedback.md",
      "artifacts/independent-review-matrix.md",
      "artifacts/claim-risk-ledger.md",
      "artifacts/revision-philosophy.md",
      "artifacts/revision-tickets.md",
    ],
    next: "Phase 5: Final Score",
  },
  {
    key: "phase_5_final_score",
    label: "Phase 5: Final Score",
    prompt: "references/scoring/genesis-score.md",
    gate: "final_score",
    outputs: ["artifacts/09-genesis-score.md", "artifacts/ai-use-and-publishing-compliance.md"],
    next: "Phase 6: Editorial Package",
  },
  {
    key: "phase_6_editorial_package",
    label: "Phase 6: Editorial Package",
    prompt: "references/prompts/editorial-package.md",
    gate: "editorial_package",
    outputs: [
      "artifacts/10-editorial-package.md",
      "artifacts/cover-generation-prompt.md",
      "artifacts/reader-response-plan.md",
      "artifacts/beta-feedback-log.md",
      "artifacts/positioning-strategy.md",
      "artifacts/blurb-test-results.md",
      "artifacts/cover-conversion-notes.md",
      "artifacts/launch-channel-plan.md",
      "artifacts/review-risk-log.md",
      "artifacts/publishing-metadata-checklist.md",
      "artifacts/ai-use-and-publishing-compliance.md",
    ],
    next: "",
  },
];

const WORKFLOW_MODES = [
  "novel",
  "memoir",
  "narrative nonfiction",
  "prescriptive nonfiction",
  "study guide",
  "certification prep",
  "biblical fiction",
  "sacred retelling",
  "series installment",
  "series repair",
  "lean-novel",
  "lean-nonfiction",
  "market-test",
  "other",
];

const CORE_PROJECT_FILES = ["PROJECT_STATE.yaml", "ASSUMPTIONS.md", "STATUS.md"];
const LEAN_MODES = ["lean-novel", "lean-nonfiction", "market-test"];
const LEAN_MODE_PHASE_OUTPUTS = [
  ["artifacts/00-brief.md", "artifacts/01-market-map.md", "artifacts/author-intent.md", "artifacts/taste-lock.md", "artifacts/commercial-proof.md"],
  ["artifacts/voice-bible.md"],
  ["artifacts/05-outline.md", "artifacts/causality-chain.md", "artifacts/argument-spine.md", "artifacts/reader-promise-tracker.md", "artifacts/continuity-ledger.md", "artifacts/chapter-production-queue.md"],
  [],
  ["artifacts/08-adversarial-audit.md", "artifacts/sample-reader-feedback.md", "artifacts/independent-review-matrix.md", "artifacts/revision-tickets.md"],
  ["artifacts/09-genesis-score.md", "artifacts/ai-use-and-publishing-compliance.md"],
  [],
];
const PROJECT_ROOT_DIRS = ["artifacts", "manuscript/chapters", "evaluations", "delivery", "research/notes", "research/sources"];
const SERIES_ROOT_DIRS = ["artifacts", "books", "evaluations", "delivery", "research/notes", "research/sources"];
const SERIES_ARTIFACTS = [
  "artifacts/series-bible.md",
  "artifacts/series-arc-map.md",
  "artifacts/series-timeline.md",
  "artifacts/character-state-matrix.md",
  "artifacts/reveal-spoiler-matrix.md",
  "artifacts/canon-lock.md",
  "artifacts/installment-promise-tracker.md",
  "artifacts/series-payoff-ledger.md",
  "artifacts/series-verification-matrix.md",
  "artifacts/retcon-log.md",
  "artifacts/series-repetition-radar.md",
  "artifacts/continuity-ledger.md",
  "artifacts/reader-promise-tracker.md",
  "artifacts/drift-loop-alarm.md",
];

const SACRED_RETELLING_ARTIFACTS = [
  "artifacts/sacred-retelling-promise.md",
  "artifacts/scripture-source-map.md",
  "artifacts/invention-boundary-ledger.md",
  "artifacts/theological-risk-budget.md",
  "artifacts/historical-cultural-plausibility-audit.md",
  "artifacts/point-of-view-ethics-audit.md",
  "artifacts/authors-note-source-note.md",
  "artifacts/sacred-scene-packets.md",
  "artifacts/translation-sensitivity-map.md",
  "artifacts/tradition-lane-selector.md",
  "artifacts/sacred-figure-handling-rules.md",
  "artifacts/anachronism-modernity-audit.md",
  "artifacts/faith-reader-personas.md",
  "artifacts/miracle-supernatural-policy.md",
  "artifacts/character-humility-guardrail.md",
  "artifacts/sacred-residue-audit.md",
  "research/reference-inventory.md",
  "artifacts/reader-promise-tracker.md",
];

const SACRED_RETELLING_BUNDLE = [
  "artifacts/sacred-retelling-promise.md",
  "artifacts/scripture-source-map.md",
  "artifacts/invention-boundary-ledger.md",
  "artifacts/theological-risk-budget.md",
  "artifacts/historical-cultural-plausibility-audit.md",
  "artifacts/point-of-view-ethics-audit.md",
  "artifacts/authors-note-source-note.md",
  "artifacts/sacred-scene-packets.md",
  "artifacts/translation-sensitivity-map.md",
  "artifacts/tradition-lane-selector.md",
  "artifacts/sacred-figure-handling-rules.md",
  "artifacts/anachronism-modernity-audit.md",
  "artifacts/faith-reader-personas.md",
  "artifacts/miracle-supernatural-policy.md",
  "artifacts/character-humility-guardrail.md",
  "artifacts/sacred-residue-audit.md",
  "research/reference-inventory.md",
  "artifacts/continuity-ledger.md",
  "artifacts/reader-promise-tracker.md",
  "artifacts/review-personas.md",
  "artifacts/voice-bible.md",
  "artifacts/drift-loop-alarm.md",
  "artifacts/publication-shape.md",
];

const MODE_ARTIFACTS = {
  novel: ["artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md", "artifacts/publication-shape.md"],
  memoir: ["artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md", "artifacts/publication-shape.md"],
  "series installment": [
    "artifacts/series-bible.md",
    "artifacts/series-arc-map.md",
    "artifacts/series-timeline.md",
    "artifacts/character-state-matrix.md",
    "artifacts/reveal-spoiler-matrix.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-payoff-ledger.md",
    "artifacts/retcon-log.md",
    "artifacts/series-repetition-radar.md",
    "artifacts/book-handoff-packet.md",
    "artifacts/reader-promise-tracker.md",
  ],
  "series repair": [
    "artifacts/series-bible.md",
    "artifacts/series-arc-map.md",
    "artifacts/series-timeline.md",
    "artifacts/character-state-matrix.md",
    "artifacts/reveal-spoiler-matrix.md",
    "artifacts/canon-lock.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-payoff-ledger.md",
    "artifacts/series-verification-matrix.md",
    "artifacts/retcon-log.md",
    "artifacts/series-repetition-radar.md",
    "artifacts/book-handoff-packet.md",
    "artifacts/reader-promise-tracker.md",
  ],
  "narrative nonfiction": ["artifacts/argument-spine.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "prescriptive nonfiction": ["artifacts/argument-spine.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "study guide": ["artifacts/study-guide-objectives.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "certification prep": [
    "artifacts/certification-blueprint-map.md",
    "artifacts/study-guide-objectives.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
  ],
  "biblical fiction": SACRED_RETELLING_ARTIFACTS,
  "sacred retelling": SACRED_RETELLING_ARTIFACTS,
  "lean-novel": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/author-intent.md",
    "artifacts/taste-lock.md",
    "artifacts/voice-bible.md",
    "artifacts/05-outline.md",
    "artifacts/causality-chain.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/continuity-ledger.md",
    "artifacts/chapter-production-queue.md",
    "artifacts/revision-tickets.md",
    "artifacts/08-adversarial-audit.md",
    "artifacts/09-genesis-score.md",
    "artifacts/commercial-proof.md",
  ],
  "lean-nonfiction": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/author-intent.md",
    "artifacts/taste-lock.md",
    "artifacts/voice-bible.md",
    "artifacts/05-outline.md",
    "artifacts/argument-spine.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/continuity-ledger.md",
    "artifacts/chapter-production-queue.md",
    "artifacts/revision-tickets.md",
    "artifacts/08-adversarial-audit.md",
    "artifacts/09-genesis-score.md",
    "artifacts/commercial-proof.md",
    "artifacts/claim-risk-ledger.md",
  ],
  "market-test": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/commercial-proof.md",
    "artifacts/category-competition-map.md",
    "artifacts/title-subtitle-options.md",
    "artifacts/blurb-test-results.md",
    "artifacts/cover-conversion-notes.md",
    "artifacts/sample-reader-feedback.md",
    "artifacts/launch-channel-plan.md",
    "artifacts/review-risk-log.md",
    "artifacts/publishing-metadata-checklist.md",
  ],
  other: ["artifacts/reader-promise-tracker.md"],
};

const MODE_SCAFFOLD_BUNDLES = {
  novel: [
    "artifacts/voice-bible.md",
    "artifacts/review-personas.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
    "artifacts/publication-shape.md",
    "artifacts/continuity-ledger.md",
  ],
  memoir: [
    "artifacts/voice-bible.md",
    "artifacts/review-personas.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
    "artifacts/human-source-bank.md",
  ],
  "narrative nonfiction": [
    "artifacts/argument-spine.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/review-personas.md",
  ],
  "prescriptive nonfiction": [
    "artifacts/argument-spine.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/review-personas.md",
  ],
  "study guide": [
    "artifacts/study-guide-objectives.md",
    "research/reference-inventory.md",
    "artifacts/evidence-map.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "certification prep": [
    "artifacts/certification-blueprint-map.md",
    "artifacts/study-guide-objectives.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "biblical fiction": SACRED_RETELLING_BUNDLE,
  "sacred retelling": SACRED_RETELLING_BUNDLE,
  "lean-novel": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/author-intent.md",
    "artifacts/taste-lock.md",
    "artifacts/voice-bible.md",
    "artifacts/05-outline.md",
    "artifacts/causality-chain.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/continuity-ledger.md",
    "artifacts/chapter-production-queue.md",
    "artifacts/revision-tickets.md",
    "artifacts/commercial-proof.md",
  ],
  "lean-nonfiction": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/author-intent.md",
    "artifacts/taste-lock.md",
    "artifacts/voice-bible.md",
    "artifacts/05-outline.md",
    "artifacts/argument-spine.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/continuity-ledger.md",
    "artifacts/chapter-production-queue.md",
    "artifacts/revision-tickets.md",
    "artifacts/commercial-proof.md",
    "artifacts/claim-risk-ledger.md",
  ],
  "market-test": [
    "artifacts/00-brief.md",
    "artifacts/01-market-map.md",
    "artifacts/commercial-proof.md",
    "artifacts/category-competition-map.md",
    "artifacts/title-subtitle-options.md",
    "artifacts/blurb-test-results.md",
    "artifacts/cover-conversion-notes.md",
    "artifacts/sample-reader-feedback.md",
    "artifacts/launch-channel-plan.md",
    "artifacts/review-risk-log.md",
    "artifacts/publishing-metadata-checklist.md",
  ],
  "series installment": [
    "artifacts/series-bible.md",
    "artifacts/series-arc-map.md",
    "artifacts/series-timeline.md",
    "artifacts/character-state-matrix.md",
    "artifacts/reveal-spoiler-matrix.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-payoff-ledger.md",
    "artifacts/retcon-log.md",
    "artifacts/series-repetition-radar.md",
    "artifacts/book-handoff-packet.md",
    "artifacts/continuity-ledger.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "series repair": [
    "artifacts/series-bible.md",
    "artifacts/series-arc-map.md",
    "artifacts/series-timeline.md",
    "artifacts/character-state-matrix.md",
    "artifacts/reveal-spoiler-matrix.md",
    "artifacts/canon-lock.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-payoff-ledger.md",
    "artifacts/series-verification-matrix.md",
    "artifacts/retcon-log.md",
    "artifacts/series-repetition-radar.md",
    "artifacts/book-handoff-packet.md",
    "artifacts/continuity-ledger.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  other: ["artifacts/review-personas.md", "artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md"],
};

const TEMPLATE_SCAFFOLDS = [
  { label: "00-brief.md", template: "references/templates/00-brief.md", destination: "artifacts/00-brief.md" },
  { label: "01-market-map.md", template: "references/templates/01-market-map.md", destination: "artifacts/01-market-map.md" },
  { label: "05-outline.md", template: "references/templates/05-outline.md", destination: "artifacts/05-outline.md" },
  { label: "causality-chain.md", template: "references/templates/causality-chain.md", destination: "artifacts/causality-chain.md" },
  { label: "08-adversarial-audit.md", template: "references/templates/08-adversarial-audit.md", destination: "artifacts/08-adversarial-audit.md" },
  { label: "09-genesis-score.md", template: "references/templates/09-genesis-score.md", destination: "artifacts/09-genesis-score.md" },
  { label: "commercial-proof.md", template: "references/templates/commercial-proof.md", destination: "artifacts/commercial-proof.md" },
  { label: "category-competition-map.md", template: "references/templates/category-competition-map.md", destination: "artifacts/category-competition-map.md" },
  { label: "title-subtitle-options.md", template: "references/templates/title-subtitle-options.md", destination: "artifacts/title-subtitle-options.md" },
  { label: "blurb-test-results.md", template: "references/templates/blurb-test-results.md", destination: "artifacts/blurb-test-results.md" },
  { label: "cover-conversion-notes.md", template: "references/templates/cover-conversion-notes.md", destination: "artifacts/cover-conversion-notes.md" },
  { label: "sample-reader-feedback.md", template: "references/templates/sample-reader-feedback.md", destination: "artifacts/sample-reader-feedback.md" },
  { label: "launch-channel-plan.md", template: "references/templates/launch-channel-plan.md", destination: "artifacts/launch-channel-plan.md" },
  { label: "review-risk-log.md", template: "references/templates/review-risk-log.md", destination: "artifacts/review-risk-log.md" },
  { label: "ai-use-and-publishing-compliance.md", template: "references/templates/ai-use-and-publishing-compliance.md", destination: "artifacts/ai-use-and-publishing-compliance.md" },
  { label: "publishing-metadata-checklist.md", template: "references/templates/publishing-metadata-checklist.md", destination: "artifacts/publishing-metadata-checklist.md" },
  { label: "independent-review-matrix.md", template: "references/templates/independent-review-matrix.md", destination: "artifacts/independent-review-matrix.md" },
  { label: "claim-risk-ledger.md", template: "references/templates/claim-risk-ledger.md", destination: "artifacts/claim-risk-ledger.md" },
  { label: "voice-bible.md", template: "references/templates/voice-bible.md", destination: "artifacts/voice-bible.md" },
  { label: "continuity-ledger.md", template: "references/templates/continuity-ledger.md", destination: "artifacts/continuity-ledger.md" },
  { label: "revision-tickets.md", template: "references/templates/revision-tickets.md", destination: "artifacts/revision-tickets.md" },
  { label: "expansion-integrity.md", template: "references/templates/expansion-integrity.md", destination: "artifacts/expansion-integrity.md" },
  { label: "series-bible.md", template: "references/templates/series-bible.md", destination: "artifacts/series-bible.md" },
  { label: "series-arc-map.md", template: "references/templates/series-arc-map.md", destination: "artifacts/series-arc-map.md" },
  { label: "series-timeline.md", template: "references/templates/series-timeline.md", destination: "artifacts/series-timeline.md" },
  { label: "character-state-matrix.md", template: "references/templates/character-state-matrix.md", destination: "artifacts/character-state-matrix.md" },
  { label: "reveal-spoiler-matrix.md", template: "references/templates/reveal-spoiler-matrix.md", destination: "artifacts/reveal-spoiler-matrix.md" },
  { label: "canon-lock.md", template: "references/templates/canon-lock.md", destination: "artifacts/canon-lock.md" },
  { label: "installment-promise-tracker.md", template: "references/templates/installment-promise-tracker.md", destination: "artifacts/installment-promise-tracker.md" },
  { label: "series-payoff-ledger.md", template: "references/templates/series-payoff-ledger.md", destination: "artifacts/series-payoff-ledger.md" },
  { label: "series-verification-matrix.md", template: "references/templates/series-verification-matrix.md", destination: "artifacts/series-verification-matrix.md" },
  { label: "retcon-log.md", template: "references/templates/retcon-log.md", destination: "artifacts/retcon-log.md" },
  { label: "series-repetition-radar.md", template: "references/templates/series-repetition-radar.md", destination: "artifacts/series-repetition-radar.md" },
  { label: "book-handoff-packet.md", template: "references/templates/book-handoff-packet.md", destination: "artifacts/book-handoff-packet.md" },
  { label: "series-regression-check.md", template: "references/templates/series-regression-check.md", destination: "evaluations/series-regression-check.md" },
  { label: "argument-spine.md", template: "references/templates/argument-spine.md", destination: "artifacts/argument-spine.md" },
  { label: "certification-blueprint-map.md", template: "references/templates/certification-blueprint-map.md", destination: "artifacts/certification-blueprint-map.md" },
  { label: "reference-inventory.md", template: "references/templates/reference-inventory.md", destination: "research/reference-inventory.md" },
  { label: "evidence-map.md", template: "references/templates/evidence-map.md", destination: "artifacts/evidence-map.md" },
  { label: "study-guide-objectives.md", template: "references/templates/study-guide-objectives.md", destination: "artifacts/study-guide-objectives.md" },
  { label: "sacred-retelling-promise.md", template: "references/templates/sacred-retelling-promise.md", destination: "artifacts/sacred-retelling-promise.md" },
  { label: "scripture-source-map.md", template: "references/templates/scripture-source-map.md", destination: "artifacts/scripture-source-map.md" },
  { label: "invention-boundary-ledger.md", template: "references/templates/invention-boundary-ledger.md", destination: "artifacts/invention-boundary-ledger.md" },
  { label: "theological-risk-budget.md", template: "references/templates/theological-risk-budget.md", destination: "artifacts/theological-risk-budget.md" },
  { label: "historical-cultural-plausibility-audit.md", template: "references/templates/historical-cultural-plausibility-audit.md", destination: "artifacts/historical-cultural-plausibility-audit.md" },
  { label: "point-of-view-ethics-audit.md", template: "references/templates/point-of-view-ethics-audit.md", destination: "artifacts/point-of-view-ethics-audit.md" },
  { label: "authors-note-source-note.md", template: "references/templates/authors-note-source-note.md", destination: "artifacts/authors-note-source-note.md" },
  { label: "sacred-scene-packets.md", template: "references/templates/sacred-scene-packets.md", destination: "artifacts/sacred-scene-packets.md" },
  { label: "translation-sensitivity-map.md", template: "references/templates/translation-sensitivity-map.md", destination: "artifacts/translation-sensitivity-map.md" },
  { label: "tradition-lane-selector.md", template: "references/templates/tradition-lane-selector.md", destination: "artifacts/tradition-lane-selector.md" },
  { label: "sacred-figure-handling-rules.md", template: "references/templates/sacred-figure-handling-rules.md", destination: "artifacts/sacred-figure-handling-rules.md" },
  { label: "anachronism-modernity-audit.md", template: "references/templates/anachronism-modernity-audit.md", destination: "artifacts/anachronism-modernity-audit.md" },
  { label: "faith-reader-personas.md", template: "references/templates/faith-reader-personas.md", destination: "artifacts/faith-reader-personas.md" },
  { label: "miracle-supernatural-policy.md", template: "references/templates/miracle-supernatural-policy.md", destination: "artifacts/miracle-supernatural-policy.md" },
  { label: "character-humility-guardrail.md", template: "references/templates/character-humility-guardrail.md", destination: "artifacts/character-humility-guardrail.md" },
  { label: "sacred-residue-audit.md", template: "references/templates/sacred-residue-audit.md", destination: "artifacts/sacred-residue-audit.md" },
  { label: "author-intent.md", template: "references/templates/author-intent.md", destination: "artifacts/author-intent.md" },
  { label: "taste-profile.md", template: "references/templates/taste-profile.md", destination: "artifacts/taste-profile.md" },
  { label: "risk-budget.md", template: "references/templates/risk-budget.md", destination: "artifacts/risk-budget.md" },
  { label: "review-personas.md", template: "references/templates/review-personas.md", destination: "artifacts/review-personas.md" },
  { label: "reader-promise-tracker.md", template: "references/templates/reader-promise-tracker.md", destination: "artifacts/reader-promise-tracker.md" },
  { label: "drift-loop-alarm.md", template: "references/templates/drift-loop-alarm.md", destination: "artifacts/drift-loop-alarm.md" },
  { label: "publication-shape.md", template: "references/templates/publication-shape.md", destination: "artifacts/publication-shape.md" },
  { label: "technical-seed-map.md", template: "references/templates/technical-seed-map.md", destination: "artifacts/technical-seed-map.md" },
  { label: "system-rule-sheet.md", template: "references/templates/system-rule-sheet.md", destination: "artifacts/system-rule-sheet.md" },
  { label: "authority-chain-map.md", template: "references/templates/authority-chain-map.md", destination: "artifacts/authority-chain-map.md" },
  { label: "opposition-case.md", template: "references/templates/opposition-case.md", destination: "artifacts/opposition-case.md" },
  { label: "domain-plausibility-audit.md", template: "references/templates/domain-plausibility-audit.md", destination: "artifacts/domain-plausibility-audit.md" },
  { label: "cover-generation-prompt.md", template: "references/templates/cover-generation-prompt.md", destination: "artifacts/cover-generation-prompt.md" },
  { label: "book-prd.md", template: "references/templates/book-prd.md", destination: "artifacts/book-prd.md" },
  { label: "prd-gap-report.md", template: "references/templates/prd-gap-report.md", destination: "artifacts/prd-gap-report.md" },
  { label: "prd-traceability-map.md", template: "references/templates/prd-traceability-map.md", destination: "artifacts/prd-traceability-map.md" },
  { label: "prd-completeness-score.md", template: "references/templates/prd-completeness-score.md", destination: "artifacts/prd-completeness-score.md" },
  { label: "quality-gates.md", template: "references/templates/quality-gates.md", destination: "artifacts/quality-gates.md" },
  { label: "writer-cockpit.md", template: "references/templates/writer-cockpit.md", destination: "artifacts/writer-cockpit.md" },
  { label: "chapter-production-queue.md", template: "references/templates/chapter-production-queue.md", destination: "artifacts/chapter-production-queue.md" },
  { label: "taste-lock.md", template: "references/templates/taste-lock.md", destination: "artifacts/taste-lock.md" },
  { label: "decision-ledger.md", template: "references/templates/decision-ledger.md", destination: "artifacts/decision-ledger.md" },
  { label: "prd-change-log.md", template: "references/templates/prd-change-log.md", destination: "artifacts/prd-change-log.md" },
  { label: "decision-impact-report.md", template: "references/templates/decision-impact-report.md", destination: "artifacts/decision-impact-report.md" },
  { label: "writer-questions.md", template: "references/templates/writer-questions.md", destination: "artifacts/writer-questions.md" },
  { label: "outline-stress-test.md", template: "references/templates/outline-stress-test.md", destination: "evaluations/outline-stress-test.md" },
  { label: "persona-review.md", template: "references/templates/persona-review.md", destination: "evaluations/persona-review.md" },
  { label: "regression-check.md", template: "references/templates/regression-check.md", destination: "evaluations/regression-check.md" },
];

const BLOCKER_CHECKS = [
  {
    file: "artifacts/drift-loop-alarm.md",
    label: "Active drift-loop hard stop",
    pattern: /active hard stop|hard stop\s*:\s*active|status\s*:\s*active/i,
    suggestion: "Resolve the repeated-shape or no-state-change evidence before advancing.",
  },
  {
    file: "artifacts/quality-gates.md",
    label: "Quality gate blocks automation",
    pattern: /gate_status\s*:\s*(blocked|needs_writer_approval)|status\s*:\s*(blocked|needs_writer_approval)|hard stop|do not advance/i,
    suggestion: "Resolve the named writer approval or quality gate before running autopilot or advancing phases.",
  },
  {
    file: "artifacts/revision-tickets.md",
    label: "Open blocker/high revision tickets",
    pattern: /severity\s*:\s*(blocker|high)|\b(blocker|high)\b[\s\S]{0,160}\bstatus\s*:\s*open/i,
    suggestion: "Close, defer with rationale, or repair blocker/high tickets before moving forward.",
  },
  {
    file: "artifacts/ai-tell-mitigation-audit.md",
    label: "Unresolved AI-tell risk",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair the underlying prose habit, not just punctuation or banned words.",
  },
  {
    file: "artifacts/author-voice-fingerprint.md",
    label: "Author-voice blocker",
    pattern: /missing|not-me violation|blocker|unresolved/i,
    suggestion: "Update the fingerprint and revise prose so it sounds like the actual author, not generic competence.",
  },
  {
    file: "artifacts/name-collision-audit.md",
    label: "Name-collision blocker",
    pattern: /blocker|web_blocked|high-risk|unresolved/i,
    suggestion: "Replace or verify risky names with web-backed evidence before finalizing them.",
  },
  {
    file: "artifacts/subtext-audit.md",
    label: "Subtext blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair scenes that explain themselves too directly.",
  },
  {
    file: "artifacts/ear-pass.md",
    label: "Read-aloud rhythm blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair repeated sentence shapes, assistant-like exposition, and dead segues.",
  },
  {
    file: "artifacts/over-polish-audit.md",
    label: "Over-polish blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Restore controlled roughness, implication, and character-shaped edges.",
  },
  {
    file: "artifacts/risk-budget.md",
    label: "Accidental-risk blocker",
    pattern: /blocker|unresolved|accidental risk/i,
    suggestion: "Separate intentional risk from accidental weakness before continuing.",
    severity: "warning",
  },
  {
    file: "artifacts/expansion-integrity.md",
    label: "Expansion-integrity blocker",
    pattern: /blocker|unresolved|padding|filler|ornamental subplot|no-state-change/i,
    suggestion: "Replace filler growth with real subplot pressure, consequence, aftermath, or meaningful scene work.",
  },
  {
    file: "artifacts/negative-capability-audit.md",
    label: "Negative-capability blocker",
    pattern: /blocker|unresolved|false opacity/i,
    suggestion: "Protect earned ambiguity while removing empty vagueness.",
  },
  {
    file: "artifacts/scene-embodiment-map.md",
    label: "Disembodied-scene blocker",
    pattern: /blocker|disembodied|unresolved/i,
    suggestion: "Add physical action, object pressure, interruption, or practical stakes.",
  },
  {
    file: "artifacts/publication-shape.md",
    label: "Publication-shape blocker",
    pattern: /blocker|unresolved|commercially soft|under-resolved|standalone.*unclear|series.*unclear|containment alone/i,
    suggestion: "Decide standalone vs series opener and pair containment with irreversible external consequence or a clear larger-conflict hook.",
  },
  {
    file: "artifacts/system-rule-sheet.md",
    label: "System-rule blocker",
    pattern: /blocker|unresolved|unclear|late-appearing|unseeded/i,
    suggestion: "Clarify capabilities, limits, delegated-trust paths, emergency exceptions, and shutdown logic before approving the draft.",
  },
  {
    file: "artifacts/authority-chain-map.md",
    label: "Authority-chain blocker",
    pattern: /blocker|unresolved|unclear|who saw what|who decided what/i,
    suggestion: "Make every institutional intervention visible at the human decision and authorization level.",
  },
  {
    file: "artifacts/opposition-case.md",
    label: "Opposition positive-case blocker",
    pattern: /blocker|unresolved|weak positive case|wrong about everything/i,
    suggestion: "Give each major foil a coherent value they protect and at least one argument a smart reader can partly accept.",
  },
  {
    file: "artifacts/domain-plausibility-audit.md",
    label: "Domain-plausibility blocker",
    pattern: /blocker|unresolved|expert review needed|unverified plot-critical/i,
    suggestion: "Flag or review plot-critical technical, medical, legal, security, or institutional claims before final scoring.",
  },
  {
    file: "artifacts/commercial-proof.md",
    label: "Commercial-proof blocker",
    pattern: /^status\s*:\s*(blocked|needs_validation)\b|outside-reader signal.*missing|target reader.*missing|no demand evidence|commercially unproven/im,
    suggestion: "Validate target reader, comps, hook, sample pull, and launch path before claiming the book can sell.",
  },
  {
    file: "artifacts/independent-review-matrix.md",
    label: "Independent-review blocker",
    pattern: /^status\s*:\s*(blocked|needs_more_readers)\b|unresolved contradictions|no human|no outside reader/im,
    suggestion: "Run at least one independent review lane and preserve objections before final approval.",
  },
  {
    file: "artifacts/claim-risk-ledger.md",
    label: "Claim-risk blocker",
    pattern: /^status\s*:\s*(needs_sourcing|expert_review_required|marketing_blocked)\b|\|[^\n|]*(high|unverified|remove)[^\n|]*\|/im,
    suggestion: "Source, expert-review, revise, or remove high-risk nonfiction and marketing claims.",
  },
  {
    file: "artifacts/publishing-metadata-checklist.md",
    label: "Publishing-metadata blocker",
    pattern: /^status\s*:\s*(incomplete|blocked)\b/im,
    suggestion: "Complete title, subtitle, categories, keywords, pricing, format, launch, and compliance metadata before upload.",
  },
  {
    file: "artifacts/ai-use-and-publishing-compliance.md",
    label: "AI-use/compliance blocker",
    pattern: /^status\s*:\s*(blocked|needs_disclosure_decision)\b|KDP classification\s*:\s*.*unknown|Disclosure required\s*:\s*.*uncertain/im,
    suggestion: "Classify AI-generated vs AI-assisted content and settle platform/client disclosure before delivery.",
  },
];

const SACRED_RETELLING_BLOCKER_CHECKS = [
  {
    file: "artifacts/scripture-source-map.md",
    label: "Scripture source-map blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|contradicts source)|\|\s*(blocker|contradicts source|needs source)\s*\|/i,
    suggestion: "Separate explicit scripture, inference, tradition, historical context, and invention before approving the retelling.",
  },
  {
    file: "artifacts/invention-boundary-ledger.md",
    label: "Invention-boundary blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|boundary unclear)|\|\s*(blocker|unmarked invention|presented as fact)\s*\|/i,
    suggestion: "Mark invented dialogue, interiority, composite material, and compressed timelines so fiction is not presented as biblical fact.",
  },
  {
    file: "artifacts/theological-risk-budget.md",
    label: "Theological-risk blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|accidental theology)|\|\s*(blocker|accidental theology|seek reader review)\s*\|/i,
    suggestion: "Classify doctrinal and denominational risks, then revise, disclose, or seek faith-context review.",
  },
  {
    file: "artifacts/historical-cultural-plausibility-audit.md",
    label: "Historical-cultural plausibility blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|anachronism)|\|\s*(blocker|anachronism|needs source)\s*\|/i,
    suggestion: "Repair or source ancient-world details before final approval.",
  },
  {
    file: "artifacts/point-of-view-ethics-audit.md",
    label: "Point-of-view ethics blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|too presumptuous)|\|\s*(blocker|reduce interiority|move to external POV)\s*\|/i,
    suggestion: "Adjust sacred-figure or high-risk POV so interiority is reverent, bounded, and not contradicted by source material.",
  },
  {
    file: "artifacts/sacred-scene-packets.md",
    label: "Sacred scene-packet blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(blocked|needs source|revise)\s*\|/i,
    suggestion: "Create source-aware chapter packets before drafting scenes that rely on scripture, inference, or invention.",
  },
  {
    file: "artifacts/translation-sensitivity-map.md",
    label: "Translation-sensitivity blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(needs comparison|avoid direct quote)\s*\|/i,
    suggestion: "Compare translation-sensitive phrases before using wording that carries theological or reader-recognition weight.",
  },
  {
    file: "artifacts/tradition-lane-selector.md",
    label: "Tradition-lane blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(unclear lane|revise|needs reviewer)\s*\|/i,
    suggestion: "Choose the interpretive lane so the book does not accidentally promise one tradition while dramatizing another.",
  },
  {
    file: "artifacts/sacred-figure-handling-rules.md",
    label: "Sacred-figure handling blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(external POV only|limited interiority|revise portrayal|seek reviewer)\s*\|/i,
    suggestion: "Lock POV, dialogue, motive, and mystery boundaries for high-risk sacred figures.",
  },
  {
    file: "artifacts/anachronism-modernity-audit.md",
    label: "Anachronism / modernity blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(anachronism|modernity leak|revise)\s*\|/i,
    suggestion: "Translate modern psychology, politics, idioms, and romance beats into period-plausible pressure.",
  },
  {
    file: "artifacts/faith-reader-personas.md",
    label: "Faith-reader persona blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(missing persona|needs review)\s*\|/i,
    suggestion: "Use faith-reader personas to separate source-risk signal from wrong-reader noise.",
  },
  {
    file: "artifacts/miracle-supernatural-policy.md",
    label: "Miracle / supernatural policy blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(reduce spectacle|move to witness POV|preserve mystery|revise)\s*\|/i,
    suggestion: "Set and follow the portrayal lane for miracles, visions, angels, demons, and divine speech.",
  },
  {
    file: "artifacts/character-humility-guardrail.md",
    label: "Character humility blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(reduce psychology|preserve mystery|revise)\s*\|/i,
    suggestion: "Humanize biblical characters without reducing them to modern motives, trauma formula, romance, or author argument.",
  },
  {
    file: "artifacts/sacred-residue-audit.md",
    label: "Sacred residue blocker",
    pattern: /status\s*:\s*(blocker|open)|\|\s*(over-explained|too tidy|too sentimental|too cold|revise)\s*\|/i,
    suggestion: "Repair endings or major turns that do not leave the intended reverence, awe, grief, hope, or holy discomfort.",
  },
  {
    file: "artifacts/authors-note-source-note.md",
    label: "Author's Note / source disclosure blocker",
    pattern: /status\s*:\s*(blocker|open)|verdict\s*:\s*(blocker|missing disclosure)|\|\s*(blocker|missing disclosure|needs author approval)\s*\|/i,
    suggestion: "Prepare transparent source and invention disclosure for readers.",
  },
];

const MODE_BLOCKER_CHECKS = {
  "biblical fiction": SACRED_RETELLING_BLOCKER_CHECKS,
  "sacred retelling": SACRED_RETELLING_BLOCKER_CHECKS,
};

const PLACEHOLDER_PATTERNS = [
  { label: "placeholder unknown", pattern: /\bunknown\b/i },
  { label: "placeholder TODO", pattern: /\bTODO\b|\bTBD\b/i },
  { label: "starter prompt text", pattern: /Add the writer's seed idea here|Describe the book idea|Track rejected openings/i },
  { label: "empty bullet scaffold", pattern: /^-\s*$/m },
  { label: "waiting scaffold", pattern: /to be filled|fill this in later|not provided yet/i },
];

function unquote(value) {
  return String(value || "").replace(/^['"]|['"]$/g, "");
}

function parseSimpleYaml(text) {
  const result = {};
  if (!text) return result;
  const lines = text.split(/\r?\n/);
  let currentListKey = null;

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const listItem = rawLine.match(/^\s{2}-\s*(.*)$/);
    if (listItem && currentListKey) {
      if (!Array.isArray(result[currentListKey])) result[currentListKey] = [];
      result[currentListKey].push(unquote(listItem[1].trim()));
      continue;
    }

    currentListKey = null;
    const pair = rawLine.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();

    if (!value) {
      currentListKey = key;
      result[key] = [];
      continue;
    }

    if (value === "[]") {
      result[key] = [];
      continue;
    }

    result[key] = unquote(value);
  }

  return result;
}

function stringifyScalar(value) {
  return JSON.stringify(String(value));
}

function parseManifest(text) {
  const phases = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  let inOutputs = false;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const topLevelMatch = line.match(/^([a-z0-9_]+):\s*$/i);
    if (topLevelMatch) {
      current = { key: topLevelMatch[1], label: "", prompt: "", gate: "", outputs: [], next: "" };
      phases.push(current);
      inOutputs = false;
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^\s{2}([a-z_]+):\s*(.*)$/i);
    if (fieldMatch) {
      const [, key, rawValue] = fieldMatch;
      const value = unquote(rawValue.trim());
      inOutputs = key === "outputs";
      if (key === "label" || key === "prompt" || key === "gate" || key === "next") current[key] = value;
      continue;
    }

    const outputMatch = line.match(/^\s{4}-\s*(.*)$/);
    if (outputMatch && inOutputs) current.outputs.push(unquote(outputMatch[1].trim()));
  }

  return phases.filter((phase) => phase.label);
}

function loadPhaseDefinitions() {
  try {
    const text = readFileSync(MANIFEST_PATH, "utf8");
    const parsed = parseManifest(text);
    if (parsed.length) return parsed;
  } catch {
    // fall through
  }
  return DEFAULT_PHASE_DEFINITIONS;
}

const PHASE_DEFINITIONS = loadPhaseDefinitions();
const PHASES = PHASE_DEFINITIONS.map((phase) => phase.label);
const PHASE_OUTPUTS = Object.fromEntries(PHASE_DEFINITIONS.map((phase) => [phase.label, phase.outputs]));

function readIfExists(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function normalizePhaseLabel(value) {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  return PHASES.find((phase) => phase.toLowerCase() === normalized) || "";
}

function parseProjectState(state) {
  return parseSimpleYaml(state || "");
}

function detectPhase(state) {
  if (!state) return "unknown: PROJECT_STATE.yaml not found";
  const parsed = parseProjectState(state);
  const direct = normalizePhaseLabel(parsed.current_phase || parsed.phase || parsed.label);
  if (direct) return direct;
  for (const phase of PHASES) if (state.includes(phase)) return phase;
  return "unknown: could not detect phase from PROJECT_STATE.yaml";
}

function pathExists(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function findProjectRoot(cwd) {
  let dir = cwd;
  let fallback = null;

  while (true) {
    if (existsSync(join(dir, "PROJECT_STATE.yaml"))) return dir;
    if (!fallback && existsSync(join(dir, "artifacts")) && existsSync(join(dir, "ASSUMPTIONS.md"))) fallback = dir;
    const parent = dirname(dir);
    if (parent === dir) return fallback || cwd;
    dir = parent;
  }
}

function detectWorkflowMode(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml")) || "";
  const assumptions = readIfExists(join(root, "ASSUMPTIONS.md")) || "";
  const parsed = parseProjectState(state);
  if (parsed.workflow_mode) return String(parsed.workflow_mode).trim().toLowerCase();
  const match = `${state}\n${assumptions}`.match(/workflow mode\s*:\s*([^\n]+)/i);
  return (match?.[1] || "unknown").trim().toLowerCase();
}

function setYamlScalar(text, key, value) {
  const next = text || "";
  if (new RegExp(`^${key}\\s*:`, "im").test(next)) {
    return next.replace(new RegExp(`^${key}\\s*:.*$`, "im"), `${key}: ${stringifyScalar(value)}`);
  }
  return `${next.trimEnd()}\n${key}: ${stringifyScalar(value)}\n`;
}

function setWorkflowModeInState(state, mode) {
  return setYamlScalar(state, "workflow_mode", mode);
}

function setWorkflowModeInAssumptions(assumptions, mode) {
  const next = assumptions || "# Assumptions\n";
  if (/^- Workflow mode:/im.test(next)) return next.replace(/^- Workflow mode:.*$/im, `- Workflow mode: ${mode}`);
  const marker = "## Inferred assumptions";
  if (next.includes(marker)) return next.replace(marker, `${marker}\n\n- Workflow mode: ${mode}`);
  return `${next.trimEnd()}\n\n- Workflow mode: ${mode}\n`;
}

function updateBriefWorkflowMode(brief, mode) {
  if (!brief) return brief;
  return /- Workflow mode:/i.test(brief)
    ? brief.replace(/- Workflow mode:.*$/im, `- Workflow mode: ${mode}`)
    : `${brief.trimEnd()}\n- Workflow mode: ${mode}\n`;
}

function getPhaseIndex(phase) {
  return PHASES.indexOf(phase);
}

function getExpectedFilesForPhase(phase) {
  const index = getPhaseIndex(phase);
  const expected = [...CORE_PROJECT_FILES];
  if (index < 0) return expected;
  for (let i = 0; i <= index; i += 1) expected.push(...(PHASE_DEFINITIONS[i]?.outputs || []));
  return [...new Set(expected)];
}

function getLeanExpectedFilesForPhase(phase) {
  const index = getPhaseIndex(phase);
  const expected = [...CORE_PROJECT_FILES];
  if (index < 0) return expected;
  for (let i = 0; i <= index; i += 1) expected.push(...(LEAN_MODE_PHASE_OUTPUTS[i] || []));
  return [...new Set(expected)];
}

function missingExpectedForPhase(root, phase) {
  const mode = detectWorkflowMode(root);
  const expected = LEAN_MODES.includes(mode) ? getLeanExpectedFilesForPhase(phase) : getExpectedFilesForPhase(phase);
  return expected.filter((file) => !pathExists(root, file));
}

function missingPhaseOutputs(root, phase) {
  const outputs = PHASE_OUTPUTS[phase] || [];
  return outputs.filter((file) => !pathExists(root, file));
}

function missingModeArtifacts(root, workflowMode) {
  const modeArtifacts = MODE_ARTIFACTS[workflowMode] || [];
  return modeArtifacts.filter((file) => !pathExists(root, file));
}

function extractEvidence(text, pattern) {
  const match = text.match(pattern);
  if (!match || match.index == null) return "pattern matched but no snippet available";
  const start = Math.max(0, match.index - 80);
  const end = Math.min(text.length, match.index + (match[0]?.length ?? 0) + 160);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function getGitState(root) {
  try {
    const inside = execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (inside !== "true") return { initialized: false, dirty: 0, branch: "" };
    const dirty = execSync("git status --porcelain", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().split(/\r?\n/).filter(Boolean).length;
    const branch = execSync("git branch --show-current", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return { initialized: true, dirty, branch };
  } catch {
    return { initialized: false, dirty: 0, branch: "" };
  }
}

function formatRelativeTime(ms) {
  const seconds = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function listRecentProjectFiles(root, limit = 5) {
  const files = [];
  function walk(dir, depth) {
    if (depth > 4) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else {
        const relative = full.startsWith(root) ? full.slice(root.length + 1) : full;
        files.push({ path: relative, mtimeMs: statSync(full).mtimeMs });
      }
    }
  }
  try {
    walk(root, 0);
  } catch {
    return [];
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}

function listMarkdownFiles(dir, root = dir, depth = 0) {
  if (!existsSync(dir) || depth > 4) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(full, root, depth + 1));
    else if (/\.md$/i.test(entry.name)) files.push(full.slice(root.length + 1));
  }
  return files.sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
}

function stripMarkdownForWordCount(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[>*_~|#\-]/g, " ");
}

function countWords(text) {
  const words = stripMarkdownForWordCount(text).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

function chapterTitleFromPath(relativePath, text) {
  const heading = String(text || "").match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return basename(relativePath, ".md").replace(/^\d+[-_\s]*/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || relativePath;
}

function collectManuscriptChapters(root) {
  const chaptersRoot = join(root, "manuscript", "chapters");
  return listMarkdownFiles(chaptersRoot, chaptersRoot).map((relativePath) => {
    const fullPath = join(chaptersRoot, relativePath);
    const text = readIfExists(fullPath) || "";
    return {
      path: `manuscript/chapters/${relativePath}`,
      title: chapterTitleFromPath(relativePath, text),
      text,
      words: countWords(text),
    };
  });
}

function manuscriptStats(root) {
  const chapters = collectManuscriptChapters(root);
  return {
    chapters: chapters.length,
    words: chapters.reduce((total, chapter) => total + chapter.words, 0),
    files: chapters.map((chapter) => chapter.path),
  };
}

function compileManuscript(root) {
  ensureDir(join(root, "delivery"));
  const state = parseProjectState(readIfExists(join(root, "PROJECT_STATE.yaml")) || "");
  const title = state.project_name || basename(root);
  const chapters = collectManuscriptChapters(root);
  const generatedAt = new Date().toISOString();
  const manuscriptPath = join(root, "delivery", "manuscript-full.md");
  const reportPath = join(root, "delivery", "manuscript-compile-report.md");
  const body = chapters.length
    ? chapters.map((chapter) => {
      const trimmed = chapter.text.trim();
      return /^#\s+/m.test(trimmed) ? trimmed : `# ${chapter.title}\n\n${trimmed}`;
    }).join("\n\n---\n\n")
    : "_No chapter Markdown files were found under `manuscript/chapters/`._";
  const compiled = [`# ${title}`, "", `_Compiled by Genesis for Pi on ${generatedAt}._`, "", body, ""].join("\n");
  writeFileSync(manuscriptPath, compiled, "utf8");
  const totalWords = chapters.reduce((total, chapter) => total + chapter.words, 0);
  const report = [
    "# Manuscript Compile Report",
    "",
    `- Project root: ${root}`,
    `- Output: delivery/manuscript-full.md`,
    `- Generated: ${generatedAt}`,
    `- Chapter files: ${chapters.length}`,
    `- Estimated manuscript words: ${totalWords}`,
    "",
    "## Included chapters",
    "",
    ...(chapters.length ? chapters.map((chapter, index) => `${index + 1}. ${chapter.path} — ${chapter.words} words`) : ["- none"]),
    "",
  ].join("\n");
  writeFileSync(reportPath, report, "utf8");
  return { manuscriptPath, reportPath, chapters: chapters.length, words: totalWords };
}

function progressBar(currentIndex, total, width = 12) {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(0, Math.min(width, Math.round(((currentIndex + 1) / safeTotal) * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function renderDashboard(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const phaseIndex = Math.max(0, getPhaseIndex(phase));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const hardBlockers = blockers.filter((blocker) => blocker.severity === "blocker");
  const warnings = blockers.filter((blocker) => blocker.severity === "warning");
  const lintFindings = collectLintFindings(root, phase);
  const missing = missingExpectedForPhase(root, phase);
  const git = getGitState(root);
  const stats = manuscriptStats(root);
  const recent = listRecentProjectFiles(root, 6);
  return [
    "# Genesis Dashboard",
    "",
    `Project: ${root}`,
    `Mode: ${workflowMode}`,
    `Phase: ${phase}`,
    `Progress: ${progressBar(phaseIndex, PHASE_DEFINITIONS.length)} ${phaseIndex + 1}/${PHASE_DEFINITIONS.length}`,
    "",
    "## Signals",
    "",
    `- Hard blockers: ${hardBlockers.length}`,
    `- Warnings: ${warnings.length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Missing expected files: ${missing.length}`,
    `- Manuscript: ${stats.chapters} chapter file(s), ${stats.words} estimated words`,
    `- Git: ${git.initialized ? `${git.dirty} uncommitted change(s)${git.branch ? ` on ${git.branch}` : ""}` : "not initialized"}`,
    `- Next best action: ${nextRecommendedAction(root)}`,
    "",
    "## Top issues",
    "",
    ...(blockers.length ? blockers.slice(0, 8).map((blocker) => `- [${blocker.severity}] ${blocker.label} — ${blocker.file}`) : ["- none"]),
    "",
    "## Recent files",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- none"]),
    "",
  ].join("\n");
}

function isGenesisProjectPath(relativePath) {
  return /^(PROJECT_STATE\.yaml|ASSUMPTIONS\.md|STATUS\.md)$/.test(relativePath)
    || /^(artifacts|manuscript|evaluations|delivery|research)\//.test(relativePath);
}

function parseGitStatus(root) {
  try {
    return execFileSync("git", ["status", "--porcelain", "-uall"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2);
        let path = line.slice(3).trim();
        if (path.includes(" -> ")) path = path.split(" -> ").pop().trim();
        return { status, path: path.replace(/^\"|\"$/g, "") };
      });
  } catch {
    return [];
  }
}

function checkpointGenesisFiles(root, args = "") {
  if (!getGitState(root).initialized) execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  const requested = args.trim();
  const explicitPaths = requested && requested.toLowerCase() !== "all"
    ? new Set(requested.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))
    : null;
  const changes = parseGitStatus(root).filter((change) => isGenesisProjectPath(change.path));
  const selected = explicitPaths
    ? [...explicitPaths].filter((path) => isGenesisProjectPath(path)).map((path) => changes.find((change) => change.path === path) || { status: existsSync(join(root, path)) ? "??" : " D", path })
    : changes;
  const results = [];
  for (const change of selected) {
    const action = change.status.includes("D") ? "remove" : change.status.includes("?") ? "add" : "update";
    const message = `Genesis: ${action} ${change.path}`;
    try {
      execFileSync("git", ["add", "--", change.path], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      execFileSync("git", ["commit", "-m", message, "--", change.path], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      results.push({ file: change.path, status: "committed", message });
    } catch (error) {
      results.push({ file: change.path, status: "failed", message: error?.stderr?.toString?.().trim() || error?.message || "git commit failed" });
    }
  }
  return { root, requested: explicitPaths ? [...explicitPaths] : null, changed: changes.length, attempted: selected.length, results };
}

const COMMERCIAL_VALIDATION_ARTIFACTS = [
  "artifacts/commercial-proof.md",
  "artifacts/category-competition-map.md",
  "artifacts/title-subtitle-options.md",
  "artifacts/blurb-test-results.md",
  "artifacts/cover-conversion-notes.md",
  "artifacts/sample-reader-feedback.md",
];

const LAUNCH_READINESS_ARTIFACTS = [
  "artifacts/launch-channel-plan.md",
  "artifacts/review-risk-log.md",
  "artifacts/publishing-metadata-checklist.md",
  "artifacts/positioning-strategy.md",
  "artifacts/reader-response-plan.md",
  "artifacts/beta-feedback-log.md",
];

const PUBLISHING_COMPLIANCE_ARTIFACTS = [
  "artifacts/independent-review-matrix.md",
  "artifacts/claim-risk-ledger.md",
  "artifacts/ai-use-and-publishing-compliance.md",
  "artifacts/name-collision-audit.md",
];

const MARKET_TEST_ARTIFACTS = [
  "artifacts/commercial-proof.md",
  "artifacts/category-competition-map.md",
  "artifacts/title-subtitle-options.md",
  "artifacts/blurb-test-results.md",
  "artifacts/cover-conversion-notes.md",
  "artifacts/sample-reader-feedback.md",
  "artifacts/launch-channel-plan.md",
  "artifacts/review-risk-log.md",
  "artifacts/publishing-metadata-checklist.md",
];

function renderExportPack(root, title, artifactPaths) {
  const sections = [title, ""];
  for (const relativePath of artifactPaths) {
    const text = readIfExists(join(root, relativePath));
    sections.push(`## ${relativePath}`, "", text?.trim() ? text.trim() : `_Missing: ${relativePath}_`, "");
  }
  return sections.join("\n");
}

function existingArtifacts(root, artifactPaths) {
  return artifactPaths.filter((relativePath) => existsSync(join(root, relativePath)));
}

function createEditorialExport(root) {
  ensureDir(join(root, "delivery"));
  const compile = compileManuscript(root);
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const stats = manuscriptStats(root);
  const revisionTickets = readIfExists(join(root, "artifacts", "revision-tickets.md")) || "No revision-tickets.md file exists yet.";
  const readerPromises = readIfExists(join(root, "artifacts", "reader-promise-tracker.md")) || "No reader-promise-tracker.md file exists yet.";
  const handoffPath = join(root, "delivery", "editorial-handoff.md");
  const boardPath = join(root, "delivery", "revision-board.md");
  const betaPath = join(root, "delivery", "beta-reader-packet.md");
  const commercialPackPath = join(root, "delivery", "commercial-validation-pack.md");
  const compliancePackPath = join(root, "delivery", "publishing-compliance-pack.md");
  const launchPackPath = join(root, "delivery", "launch-readiness-pack.md");
  const coverPromptPath = join(root, "delivery", "cover-generation-prompt.md");
  const manifestPath = join(root, "delivery", "genesis-export-manifest.md");
  const highValueFiles = [
    "PROJECT_STATE.yaml",
    "STATUS.md",
    "artifacts/continuity-ledger.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/revision-tickets.md",
    "evaluations/chapter-scorecards.md",
    ...existingArtifacts(root, [...COMMERCIAL_VALIDATION_ARTIFACTS, ...LAUNCH_READINESS_ARTIFACTS, ...PUBLISHING_COMPLIANCE_ARTIFACTS]),
  ];
  writeFileSync(handoffPath, [
    "# Editorial Handoff",
    "",
    `- Project root: ${root}`,
    `- Phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Manuscript: ${stats.chapters} chapter file(s), ${stats.words} estimated words`,
    `- Compiled manuscript: delivery/manuscript-full.md`,
    `- Commercial validation pack: delivery/commercial-validation-pack.md`,
    `- Publishing compliance pack: delivery/publishing-compliance-pack.md`,
    `- Launch readiness pack: delivery/launch-readiness-pack.md`,
    `- Open blockers/warnings: ${blockers.length}`,
    "",
    "## Current risks",
    "",
    ...(blockers.length ? blockers.map((blocker) => `- [${blocker.severity}] ${blocker.label} — ${blocker.file}`) : ["- none detected"]),
    "",
    "## High-value project files",
    "",
    ...[...new Set(highValueFiles)].map((file) => `- ${file}`),
    "",
  ].join("\n"), "utf8");
  writeFileSync(boardPath, `# Revision Board\n\nSource: artifacts/revision-tickets.md\n\n${revisionTickets.trim()}\n`, "utf8");
  writeFileSync(betaPath, [
    "# Beta Reader Packet",
    "",
    "Use this packet with the compiled manuscript when asking for outside reader response.",
    "",
    "## Reader promises to watch",
    "",
    readerPromises.trim(),
    "",
    "## Feedback prompts",
    "",
    "- Where did attention drop? Name the chapter or scene.",
    "- Which promise felt underpaid, over-explained, or abandoned?",
    "- Which character, argument, or system rule felt false?",
    "- Where did the prose sound too smooth, generic, or unlike the author?",
    "- What residue stayed with you after the ending?",
    "",
  ].join("\n"), "utf8");
  writeFileSync(commercialPackPath, renderExportPack(root, "# Commercial Validation Pack", COMMERCIAL_VALIDATION_ARTIFACTS), "utf8");
  writeFileSync(compliancePackPath, renderExportPack(root, "# Publishing Compliance Pack", PUBLISHING_COMPLIANCE_ARTIFACTS), "utf8");
  writeFileSync(launchPackPath, renderExportPack(root, "# Launch Readiness Pack", LAUNCH_READINESS_ARTIFACTS), "utf8");
  const coverPrompt = readIfExists(join(root, "artifacts", "cover-generation-prompt.md"));
  const files = [
    "delivery/manuscript-full.md",
    "delivery/manuscript-compile-report.md",
    "delivery/editorial-handoff.md",
    "delivery/revision-board.md",
    "delivery/beta-reader-packet.md",
    "delivery/commercial-validation-pack.md",
    "delivery/publishing-compliance-pack.md",
    "delivery/launch-readiness-pack.md",
  ];
  if (coverPrompt?.trim()) {
    writeFileSync(coverPromptPath, coverPrompt.trimEnd() + "\n", "utf8");
    files.push("delivery/cover-generation-prompt.md");
  }
  const presentArtifacts = existingArtifacts(root, [...COMMERCIAL_VALIDATION_ARTIFACTS, ...LAUNCH_READINESS_ARTIFACTS, ...PUBLISHING_COMPLIANCE_ARTIFACTS]);
  writeFileSync(manifestPath, [
    "# Genesis Export Manifest",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Delivery files",
    "",
    ...files.map((file) => `- ${file}`),
    "",
    "## Included project artifacts present at export time",
    "",
    ...(presentArtifacts.length ? presentArtifacts.map((file) => `- ${file}`) : ["- none detected"]),
    "",
  ].join("\n"), "utf8");
  return { ...compile, files: [...files, "delivery/genesis-export-manifest.md"] };
}

function lintArtifactFile(relativePath, text) {
  const findings = [];
  if (!text?.trim()) {
    findings.push({ file: relativePath, label: "empty file", evidence: `${relativePath} is empty.` });
    return findings;
  }

  for (const item of PLACEHOLDER_PATTERNS) {
    if (item.pattern.test(text)) findings.push({ file: relativePath, label: item.label, evidence: extractEvidence(text, item.pattern) });
  }

  const headings = [...text.matchAll(/^(#{1,3}\s.+)$/gm)];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index + headings[i][0].length;
    const end = headings[i + 1]?.index ?? text.length;
    const body = text.slice(start, end).replace(/^\s+|\s+$/g, "");
    if (!body || /^[-*]\s*$/.test(body)) findings.push({ file: relativePath, label: "empty section", evidence: headings[i][0] });
  }

  const tableOnlySkeleton = text.match(/\|.*\|\n\|\s*---[\s|:-]*\n?$/m);
  if (tableOnlySkeleton) findings.push({ file: relativePath, label: "empty table scaffold", evidence: tableOnlySkeleton[0].trim() });
  return findings;
}

function collectLintFindings(root, phase) {
  const expected = [...new Set([...getExpectedFilesForPhase(phase), ...(MODE_ARTIFACTS[detectWorkflowMode(root)] || [])])];
  const findings = [];
  for (const relativePath of expected) {
    const full = join(root, relativePath);
    if (!existsSync(full) || statSync(full).isDirectory()) continue;
    findings.push(...lintArtifactFile(relativePath, readIfExists(full) || ""));
  }
  return findings;
}

function collectBlockers(root, includeMissing = true) {
  const blockers = [];
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);

  for (const check of [...BLOCKER_CHECKS, ...(MODE_BLOCKER_CHECKS[workflowMode] || [])]) {
    const text = readIfExists(join(root, check.file));
    if (!text || !check.pattern.test(text)) continue;
    blockers.push({
      file: check.file,
      label: check.label,
      evidence: extractEvidence(text, check.pattern),
      suggestion: check.suggestion,
      severity: check.severity ?? "blocker",
    });
  }

  if (includeMissing) {
    for (const file of missingExpectedForPhase(root, phase).slice(0, 12)) {
      blockers.push({
        file,
        label: "Missing expected output for current phase",
        evidence: `${file} does not exist yet, but it is expected by ${phase}.`,
        suggestion: "Create the missing file or correct PROJECT_STATE.yaml if the phase is ahead of the actual project artifacts.",
        severity: file === "PROJECT_STATE.yaml" || file === "ASSUMPTIONS.md" ? "blocker" : "warning",
      });
    }
    for (const file of missingModeArtifacts(root, workflowMode)) {
      blockers.push({
        file,
        label: "Missing workflow-mode artifact",
        evidence: `${file} does not exist, but workflow mode is ${workflowMode}.`,
        suggestion: "Scaffold or create the missing mode-specific artifact before relying on this workflow mode.",
        severity: "warning",
      });
    }
  }

  const git = getGitState(root);
  if (!git.initialized) {
    blockers.push({
      file: ".git",
      label: "Git repository not initialized",
      evidence: `${root} is not inside a Git work tree.`,
      suggestion: "Run git init in the project root before writing more Genesis artifacts.",
      severity: "blocker",
    });
  } else if (git.dirty > 0) {
    blockers.push({
      file: ".git",
      label: "Uncommitted Genesis changes",
      evidence: `${git.dirty} file(s) currently have uncommitted changes.`,
      suggestion: "Commit each changed Genesis file separately to preserve rollback points.",
      severity: "warning",
    });
  }

  return blockers;
}

function blockerSummary(root) {
  return collectBlockers(root, false).map((blocker) => blocker.file);
}

function renderBlockers(root, includeMissing = true) {
  const blockers = collectBlockers(root, includeMissing);
  if (!blockers.length) return "No blockers detected by Genesis triage.";
  return blockers.map((blocker, index) => `${index + 1}. [${blocker.severity}] ${blocker.label}\n   file: ${blocker.file}\n   evidence: ${blocker.evidence}\n   suggested action: ${blocker.suggestion}`).join("\n\n");
}

function nextMissingOutput(root, phase) {
  return missingExpectedForPhase(root, phase)[0] || null;
}

function nextRecommendedAction(root) {
  const blockers = collectBlockers(root, true);
  const hard = blockers.find((blocker) => blocker.severity === "blocker");
  if (hard) return `Clear ${hard.file}: ${hard.suggestion}`;
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const missing = nextMissingOutput(root, phase);
  if (missing) return `Create ${missing} for ${phase}.`;
  return `Advance the next required ${phase} output with /genesis-next.`;
}

function renderValidationReport(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const expectedMissing = missingExpectedForPhase(root, phase);
  const phaseMissing = missingPhaseOutputs(root, phase);
  const modeMissing = missingModeArtifacts(root, workflowMode);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const phaseKnown = Boolean(PHASE_OUTPUTS[phase]);
  const phaseMismatch = phaseKnown && phaseMissing.length > 0;

  return [
    "# Genesis Validation",
    "",
    `- Project root: ${root}`,
    `- Detected phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Uncommitted changes: ${git.initialized ? git.dirty : "n/a"}`,
    `- Phase recognized: ${phaseKnown ? "yes" : "no"}`,
    `- Missing expected files through current phase: ${expectedMissing.length}`,
    `- Phase output mismatches: ${phaseMissing.length}`,
    `- Mode-specific missing artifacts: ${modeMissing.length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Blockers/warnings detected: ${blockers.length}`,
    "",
    "## Missing expected files through current phase",
    "",
    ...(expectedMissing.length ? expectedMissing.map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Lint findings",
    "",
    ...(lintFindings.length ? lintFindings.slice(0, 12).map((item) => `- ${item.file}: ${item.label}`) : ["- none"]),
    "",
    "## Verdict",
    "",
    phaseMismatch ? "- Phase contract mismatch detected. Repair missing outputs or correct PROJECT_STATE.yaml before advancing." : "- No phase-contract mismatch detected.",
    modeMissing.length ? "- Mode-specific artifacts are missing." : "- No mode-specific artifact gap detected.",
    lintFindings.length ? "- Artifact-quality lint findings exist; repair placeholder-heavy files before trusting them." : "- No placeholder-heavy artifact issues detected.",
    blockers.length ? "- Blockers or warnings exist. Review blocker files before advancing." : "- No blockers detected.",
    "",
  ].join("\n");
}

function renderStatusDashboard(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const missing = missingExpectedForPhase(root, phase);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const prdScore = readIfExists(join(root, "artifacts", "prd-completeness-score.md"))?.match(/Score:\s*(\d+)\/100/i)?.[1] || "unknown";
  const gateStatus = readIfExists(join(root, "artifacts", "quality-gates.md"))?.match(/gate_status:\s*([^\n]+)/i)?.[1]?.trim() || "unknown";
  const expansion = readIfExists(join(root, "artifacts", "expansion-integrity.md")) || "";
  const expansionRisk = /blocker|unresolved|padding|filler|ornamental subplot|no-state-change/i.test(expansion)
    ? "active risk"
    : existsSync(join(root, "artifacts", "expansion-integrity.md"))
      ? "no active risk detected"
      : "file not required yet or missing";
  const recent = listRecentProjectFiles(root, 5);

  return [
    "# Genesis Status",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- PRD completeness: ${prdScore}${prdScore !== "unknown" ? "/100" : ""}`,
    `- Quality gate status: ${gateStatus}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Git branch: ${git.branch || "n/a"}`,
    `- Uncommitted changes: ${git.initialized ? git.dirty : "n/a"}`,
    `- Blockers: ${blockers.length || "none detected"}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Missing expected files through current phase: ${missing.length}`,
    `- Expansion integrity: ${expansionRisk}`,
    `- Next recommended action: ${nextRecommendedAction(root)}`,
    "",
    "## Top blockers",
    "",
    ...(blockers.length ? blockers.slice(0, 8).map((blocker, index) => `${index + 1}. ${blocker.label} — ${blocker.file}`) : ["- none"]),
    "",
    "## Recent project files",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- none"]),
    "",
    "## First missing expected files",
    "",
    ...(missing.length ? missing.slice(0, 12).map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Notes",
    "",
    "- Regenerate this file with /genesis-status.",
    "- Use /genesis-resume for a smart resume summary.",
    "- Use /genesis-plan for a dry-run summary before /genesis-next.",
    "- Use /genesis-doctor for install, lint, and project-health checks.",
    "",
  ].join("\n");
}

function renderPlan(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const missing = missingExpectedForPhase(root, phase);
  const nextFile = nextMissingOutput(root, phase);
  const nextPhase = PHASE_DEFINITIONS[getPhaseIndex(phase)]?.next || "unknown";

  return [
    "# Genesis Plan",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Hard blockers: ${blockers.filter((blocker) => blocker.severity === "blocker").length}`,
    `- Warnings: ${blockers.filter((blocker) => blocker.severity === "warning").length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Next expected file: ${nextFile || "none missing in current phase"}`,
    `- Next pipeline phase after this one: ${nextPhase || "none"}`,
    "",
    "## What /genesis-next would do",
    "",
    ...(blockers.length
      ? ["- Clear hard blockers first when possible.", ...blockers.slice(0, 6).map((blocker) => `- ${blocker.label}: ${blocker.suggestion}`)]
      : nextFile
        ? [`- Create or repair ${nextFile}.`, "- Update PROJECT_STATE.yaml and STATUS.md to match reality."]
        : ["- Advance the next incomplete pipeline step.", "- Update PROJECT_STATE.yaml and STATUS.md to match reality."]),
    "",
    "## Missing expected files through current phase",
    "",
    ...(missing.length ? missing.map((file) => `- ${file}`) : ["- none"]),
    "",
  ].join("\n");
}

function renderResume(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const recent = listRecentProjectFiles(root, 8);
  const nextFile = nextMissingOutput(root, phase);

  return [
    "# Genesis Resume",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Next expected file: ${nextFile || "none"}`,
    `- Suggested command: ${blockers.length ? "/genesis-blockers or /genesis-plan" : "/genesis-next"}`,
    "",
    "## Where you left off",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- no recent project files found"]),
    "",
    "## Immediate risks",
    "",
    ...(blockers.length ? blockers.slice(0, 6).map((blocker) => `- ${blocker.label} — ${blocker.file}`) : ["- none detected"]),
    "",
  ].join("\n");
}

function renderDoctorReport(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const packageChecks = [MANIFEST_PATH, join(PACKAGE_ROOT, "SKILL.md"), join(PACKAGE_ROOT, "README.md")];
  const installIssues = packageChecks.filter((path) => !existsSync(path));
  const missingCoreDirs = PROJECT_ROOT_DIRS.filter((dir) => !pathExists(root, dir));

  return [
    "# Genesis Doctor",
    "",
    `- Package root: ${PACKAGE_ROOT}`,
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Package file issues: ${installIssues.length}`,
    `- Missing project directories: ${missingCoreDirs.length}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Blockers/warnings: ${blockers.length}`,
    `- Lint findings: ${lintFindings.length}`,
    "",
    "## Install health",
    "",
    ...(installIssues.length ? installIssues.map((path) => `- missing package file: ${path}`) : ["- package looks structurally complete"]),
    "",
    "## Project directory health",
    "",
    ...(missingCoreDirs.length ? missingCoreDirs.map((dir) => `- missing directory: ${dir}`) : ["- core directories look present"]),
    "",
    "## Lint findings",
    "",
    ...(lintFindings.length ? lintFindings.slice(0, 12).map((item) => `- ${item.file}: ${item.label}`) : ["- none"]),
    "",
    "## Blockers",
    "",
    ...(blockers.length ? blockers.slice(0, 12).map((item) => `- [${item.severity}] ${item.label} — ${item.file}`) : ["- none"]),
    "",
  ].join("\n");
}

function renderLintReport(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const findings = collectLintFindings(root, phase);
  return [
    "# Genesis Lint",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Findings: ${findings.length}`,
    "",
    ...(findings.length ? findings.map((item, index) => `${index + 1}. ${item.file} — ${item.label}\n   evidence: ${item.evidence}`) : ["No artifact-quality lint findings detected."]),
    "",
  ].join("\n");
}

function findGenesisProjects(startDir, maxDepth = 3) {
  const found = new Set();
  function walk(dir, depth) {
    if (existsSync(join(dir, "PROJECT_STATE.yaml"))) found.add(dir);
    if (depth >= maxDepth) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      walk(join(dir, entry.name), depth + 1);
    }
  }
  try {
    walk(startDir, 0);
  } catch {
    return [];
  }
  return [...found].sort();
}

function slugifyProjectName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "genesis-project";
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function scaffoldTemplate(projectRoot, templatePath, destinationPath, overwrite = false) {
  const source = resolve(PACKAGE_ROOT, templatePath);
  const destination = join(projectRoot, destinationPath);
  ensureDir(dirname(destination));
  if (!overwrite && existsSync(destination)) return "skipped";
  copyFileSync(source, destination);
  return "written";
}

function findTemplateEntryByDestination(destination) {
  return TEMPLATE_SCAFFOLDS.find((item) => item.destination === destination) || null;
}

function getModeTemplateEntries(mode) {
  const destinations = new Set(MODE_ARTIFACTS[mode] || []);
  return TEMPLATE_SCAFFOLDS.filter((item) => destinations.has(item.destination));
}

function getModeBundleEntries(mode) {
  const destinations = new Set(MODE_SCAFFOLD_BUNDLES[mode] || []);
  return TEMPLATE_SCAFFOLDS.filter((item) => destinations.has(item.destination));
}

function scaffoldModeArtifacts(projectRoot, mode, overwrite = false) {
  return getModeTemplateEntries(mode).map((item) => ({ label: item.label, destination: item.destination, status: scaffoldTemplate(projectRoot, item.template, item.destination, overwrite) }));
}

function scaffoldModeBundle(projectRoot, mode, overwrite = false) {
  return getModeBundleEntries(mode).map((item) => ({ label: item.label, destination: item.destination, status: scaffoldTemplate(projectRoot, item.template, item.destination, overwrite) }));
}

function writeIfMissing(path, content) {
  if (!existsSync(path)) writeFileSync(path, content, "utf8");
}

function initializeProject(root, projectName, idea) {
  ensureDir(root);
  for (const dir of PROJECT_ROOT_DIRS) ensureDir(join(root, dir));

  writeIfMissing(
    join(root, "PROJECT_STATE.yaml"),
    [
      `project_name: ${stringifyScalar(projectName)}`,
      `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
      `current_phase: ${stringifyScalar("Phase 0: Intake")}`,
      'phase_gate: "intake"',
      'status: "initialized"',
      'language: "unknown"',
      'workflow_mode: "unknown"',
      'project_root_initialized_by: "genesis-init"',
      'next_required_outputs:',
      '  - "ASSUMPTIONS.md"',
      '  - "artifacts/00-brief.md"',
      '  - "artifacts/01-market-map.md"',
      '  - "artifacts/02-story-engine.md"',
      '  - "artifacts/author-intent.md"',
      '  - "artifacts/taste-profile.md"',
      '  - "artifacts/risk-budget.md"',
      '  - "artifacts/discarded-choices.md"',
      '  - "artifacts/review-personas.md"',
      'notes: []',
      '',
    ].join("\n"),
  );

  writeIfMissing(
    join(root, "ASSUMPTIONS.md"),
    `# Assumptions\n\n## Explicit user input\n\n- Project: ${projectName}\n- Seed idea: ${idea || "Not provided yet."}\n\n## Inferred assumptions\n\n- Language: unknown\n- Genre: unknown\n- Audience: unknown\n- Target length: unknown\n- Narrative mode: unknown\n- Workflow mode: unknown (novel, memoir, narrative nonfiction, prescriptive nonfiction, study guide, certification prep, biblical fiction, sacred retelling, series installment, series repair, other)\n\nMark each assumption as confirmed, provisional, or rejected during Phase 0.\n`,
  );

  writeIfMissing(join(root, "artifacts", "00-brief.md"), `# Brief\n\n## Original idea\n\n${idea || "Add the writer's seed idea here."}\n\n## Intake scaffold\n\n- Language:\n- Genre:\n- Audience:\n- Target length:\n- Narrative mode:\n- Workflow mode:\n- Reader promise:\n`);
  writeIfMissing(join(root, "artifacts", "01-market-map.md"), "# Market Map\n\n- market signals\n- comp titles\n- recurring patterns\n- whitespace opportunity\n");
  writeIfMissing(join(root, "artifacts", "02-story-engine.md"), "# Story Engine\n\n- premise expansion\n- central conflict\n- escalation logic\n- differentiation strategy\n");
  writeIfMissing(join(root, "research", "reference-inventory.md"), "# Reference Inventory\n\n## Source index\n\n| id | source type | title | author / org | date | status | location | notes |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n");
  writeIfMissing(join(root, "research", "notes", "README.md"), "# Research Notes\n\nUse this folder for study notes, source summaries, interview notes, certification objective breakdowns, and working research memos.\n");
  writeIfMissing(join(root, "research", "sources", "README.md"), "# Research Sources\n\nStore downloaded PDFs, copied standards, exam blueprints, article captures, transcripts, and other raw reference material here when permitted.\n");

  for (const destination of ["artifacts/author-intent.md", "artifacts/taste-profile.md", "artifacts/risk-budget.md", "artifacts/review-personas.md", "artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md", "artifacts/expansion-integrity.md", "artifacts/publication-shape.md"]) {
    const item = findTemplateEntryByDestination(destination);
    if (item) scaffoldTemplate(root, item.template, item.destination, false);
  }

  writeIfMissing(join(root, "artifacts", "discarded-choices.md"), "# Discarded Choices\n\nTrack rejected openings, names, tones, premises, and turns here.\n");
  writeIfMissing(join(root, "STATUS.md"), renderStatusDashboard(root));
}

function maybeInitGit(root) {
  if (existsSync(join(root, ".git"))) return false;
  execSync("git init", { cwd: root, stdio: "ignore" });
  return true;
}

function applyWorkflowModeToProject(root, mode) {
  const statePath = join(root, "PROJECT_STATE.yaml");
  const assumptionsPath = join(root, "ASSUMPTIONS.md");
  const briefPath = join(root, "artifacts", "00-brief.md");
  writeFileSync(statePath, setWorkflowModeInState(readIfExists(statePath), mode), "utf8");
  writeFileSync(assumptionsPath, setWorkflowModeInAssumptions(readIfExists(assumptionsPath), mode), "utf8");
  const brief = readIfExists(briefPath);
  if (brief) writeFileSync(briefPath, updateBriefWorkflowMode(brief, mode), "utf8");
}

function inferPhaseFromFiles(root) {
  let phase = "Phase 0: Intake";
  for (const item of PHASE_DEFINITIONS) {
    const total = item.outputs.length || 1;
    const present = item.outputs.filter((file) => pathExists(root, file)).length;
    if (present > 0 && present >= Math.ceil(total / 3)) phase = item.label;
  }
  return phase;
}

function seriesBookDirName(index) {
  return `book-${String(index).padStart(2, "0")}`;
}

function findSeriesRoot(cwd) {
  let dir = cwd;
  let fallback = null;

  while (true) {
    if (existsSync(join(dir, "SERIES_STATE.yaml"))) return dir;
    if (!fallback && existsSync(join(dir, "artifacts", "series-bible.md")) && existsSync(join(dir, "books"))) fallback = dir;
    const parent = dirname(dir);
    if (parent === dir) return fallback || cwd;
    dir = parent;
  }
}

function findSeriesWorkspaces(startDir, maxDepth = 3) {
  const found = new Set();
  function walk(dir, depth) {
    if (existsSync(join(dir, "SERIES_STATE.yaml"))) found.add(dir);
    if (depth >= maxDepth) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      walk(join(dir, entry.name), depth + 1);
    }
  }
  try {
    walk(startDir, 0);
  } catch {
    return [];
  }
  return [...found].sort();
}

function seriesArtifactMissing(root) {
  return SERIES_ARTIFACTS.filter((file) => !pathExists(root, file));
}

function listSeriesBookProjects(seriesRoot) {
  const booksRoot = join(seriesRoot, "books");
  if (!existsSync(booksRoot)) return [];
  return readdirSync(booksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(booksRoot, entry.name))
    .filter((bookRoot) => existsSync(join(bookRoot, "PROJECT_STATE.yaml")))
    .sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
}

function initializeSeriesBookProject(seriesRoot, seriesName, index, total, premise) {
  const bookRoot = join(seriesRoot, "books", seriesBookDirName(index));
  initializeProject(bookRoot, `${seriesName} Book ${index}`, [`Series: ${seriesName}`, `Book position: ${index} of ${total}`, premise ? `Series premise: ${premise}` : ""].filter(Boolean).join("\n"));
  applyWorkflowModeToProject(bookRoot, "series installment");
  scaffoldModeBundle(bookRoot, "series installment", false);

  const statePath = join(bookRoot, "PROJECT_STATE.yaml");
  let state = readIfExists(statePath) || "";
  state = setYamlScalar(state, "series_root", "../..");
  state = setYamlScalar(state, "series_position", String(index));
  state = setYamlScalar(state, "series_total_books", String(total));
  writeFileSync(statePath, state, "utf8");

  const assumptionsPath = join(bookRoot, "ASSUMPTIONS.md");
  writeFileSync(assumptionsPath, `${readIfExists(assumptionsPath).trimEnd()}\n\n## Series context\n\n- Series root: ../..\n- Series position: ${index} of ${total}\n- Parent source of truth: ../../artifacts/series-bible.md and ../../artifacts/series-arc-map.md\n`, "utf8");
  writeFileSync(join(bookRoot, "STATUS.md"), renderStatusDashboard(bookRoot), "utf8");
  return bookRoot;
}

function initializeSeriesWorkspace(root, seriesName, premise = "", plannedBooks = 3) {
  ensureDir(root);
  for (const dir of SERIES_ROOT_DIRS) ensureDir(join(root, dir));

  const total = Math.max(1, Math.min(20, Number.parseInt(plannedBooks, 10) || 3));
  writeIfMissing(
    join(root, "SERIES_STATE.yaml"),
    [
      `series_name: ${stringifyScalar(seriesName)}`,
      `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
      `status: ${stringifyScalar("initialized")}`,
      `workflow_mode: ${stringifyScalar("series")}`,
      `planned_books: ${stringifyScalar(String(total))}`,
      `current_book: ${stringifyScalar("1")}`,
      `series_root_initialized_by: ${stringifyScalar("genesis-series-start")}`,
      "book_roots:",
      ...Array.from({ length: total }, (_, index) => `  - ${stringifyScalar(`books/${seriesBookDirName(index + 1)}`)}`),
      "",
    ].join("\n"),
  );

  writeIfMissing(join(root, "ASSUMPTIONS.md"), `# Series Assumptions\n\n## Explicit user input\n\n- Series: ${seriesName}\n- Premise: ${premise || "Not provided yet."}\n- Planned books: ${total}\n\n## Inferred assumptions\n\n- Genre: unknown\n- Audience: unknown\n- Series promise: unknown\n- Final destination: unknown\n\nMark each assumption as confirmed, provisional, or rejected during series intake.\n`);

  for (const destination of SERIES_ARTIFACTS) {
    const item = findTemplateEntryByDestination(destination);
    if (item) scaffoldTemplate(root, item.template, item.destination, false);
  }

  for (let index = 1; index <= total; index += 1) initializeSeriesBookProject(root, seriesName, index, total, premise);
  writeFileSync(join(root, "SERIES_STATUS.md"), renderSeriesStatus(root), "utf8");
  return { root, seriesName, plannedBooks: total, bookRoots: listSeriesBookProjects(root), missing: seriesArtifactMissing(root) };
}

function renderSeriesStatus(root) {
  const state = parseSimpleYaml(readIfExists(join(root, "SERIES_STATE.yaml")) || "");
  const books = listSeriesBookProjects(root);
  const missing = seriesArtifactMissing(root);
  const rows = books.map((bookRoot, index) => {
    const relative = bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
    const phase = detectPhase(readIfExists(join(bookRoot, "PROJECT_STATE.yaml")));
    const mode = detectWorkflowMode(bookRoot);
    const stats = manuscriptStats(bookRoot);
    const blockers = collectBlockers(bookRoot, true).filter((blocker) => blocker.severity === "blocker").length;
    return `| ${index + 1} | ${relative} | ${phase} | ${mode} | ${stats.chapters} | ${stats.words} | ${blockers} |`;
  });

  return [
    "# Genesis Series Status",
    "",
    `- Series root: ${root}`,
    `- Series name: ${state.series_name || basename(root)}`,
    `- Planned books: ${state.planned_books || books.length || "unknown"}`,
    `- Current book: ${state.current_book || "unknown"}`,
    `- Series-level missing artifacts: ${missing.length}`,
    `- Book projects: ${books.length}`,
    "",
    "## Series artifacts",
    "",
    ...(SERIES_ARTIFACTS.map((file) => `- ${existsSync(join(root, file)) ? "present" : "missing"}: ${file}`)),
    "",
    "## Books",
    "",
    "| # | project | phase | mode | chapters | words | hard blockers |",
    "| --- | --- | --- | --- | ---: | ---: | ---: |",
    ...(rows.length ? rows : ["| - | no book projects found | - | - | 0 | 0 | 0 |"]),
    "",
    "## Next best action",
    "",
    missing.length ? `- Fill or repair ${missing[0]} before relying on book-level drafting.` : "- Run `/genesis-series-next` to advance the series-level plan or the next incomplete book.",
    "",
  ].join("\n");
}

function buildSeriesNextPrompt(root, args = "") {
  const state = parseSimpleYaml(readIfExists(join(root, "SERIES_STATE.yaml")) || "");
  const books = listSeriesBookProjects(root);
  const missing = seriesArtifactMissing(root);
  const bookSummaries = books.map((bookRoot, index) => {
    const relative = bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
    const phase = detectPhase(readIfExists(join(bookRoot, "PROJECT_STATE.yaml")));
    const firstMissing = nextMissingOutput(bookRoot, phase) || "none";
    return `- Book ${index + 1}: ${relative}; phase=${phase}; next_missing=${firstMissing}`;
  });

  return [
    "Use the `genesis-for-pi` skill and advance this whole-series Genesis workspace.",
    "",
    `Series root: ${root}`,
    `Series name: ${state.series_name || basename(root)}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first:",
    "- SERIES_STATE.yaml",
    "- SERIES_STATUS.md when present",
    "- artifacts/series-bible.md",
    "- artifacts/series-arc-map.md",
    "- artifacts/series-timeline.md",
    "- artifacts/character-state-matrix.md",
    "- artifacts/reveal-spoiler-matrix.md",
    "- artifacts/canon-lock.md",
    "- artifacts/installment-promise-tracker.md",
    "- artifacts/series-payoff-ledger.md",
    "- artifacts/series-verification-matrix.md",
    "- artifacts/retcon-log.md",
    "- artifacts/series-repetition-radar.md",
    "- predecessor books' artifacts/book-handoff-packet.md when present",
    "- each book's PROJECT_STATE.yaml and STATUS.md",
    "",
    `Series-level missing artifacts: ${missing.length ? missing.join(", ") : "none"}`,
    "Book states:",
    ...(bookSummaries.length ? bookSummaries : ["- no book projects found"]),
    "",
    "Rules:",
    "1. Treat the series root as the source of truth for cross-book canon, escalation, and promises, but separate locked canon from provisional future plans.",
    "2. If series-level files are empty or placeholder-heavy, fill only the next useful series-level planning artifact before drafting more chapters.",
    "3. Advance one book/project step at a time; do not draft multiple installments in one turn unless explicitly asked.",
    "4. Do not over-plan all books at scene-level detail. Capture roles, pressures, payoff windows, and constraints; leave later-book specifics flexible until their active project reaches architecture.",
    "5. Do not invent definitive book endings prematurely. If a future ending is useful, mark it as planned/provisional, not canon.",
    "6. Do not let later-book improvements contradict locked canon or promises established by earlier books.",
    "7. Do not lock canon unless the user invoked a lock command or explicitly approved locking; otherwise mark candidate facts as planned, provisional, or ready-for-review.",
    "8. After changing any book-level canon or planned series obligation, synchronize artifacts/series-bible.md, artifacts/series-arc-map.md, artifacts/series-timeline.md, artifacts/character-state-matrix.md, artifacts/reveal-spoiler-matrix.md, artifacts/installment-promise-tracker.md, artifacts/series-payoff-ledger.md, artifacts/retcon-log.md, artifacts/series-repetition-radar.md, and artifacts/series-verification-matrix.md as needed.",
    "9. Update SERIES_STATUS.md and the active book's STATUS.md before stopping.",
    "10. Commit changed files separately when inside a Git work tree.",
    "",
    "Proceed with the next safest series-level or book-level step now.",
  ].join("\n");
}

function buildSeriesVerifyPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run cross-book series verification.",
    "",
    `Series root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Compare all book projects under `books/` against:",
    "- artifacts/series-bible.md",
    "- artifacts/series-arc-map.md",
    "- artifacts/series-timeline.md",
    "- artifacts/character-state-matrix.md",
    "- artifacts/reveal-spoiler-matrix.md",
    "- artifacts/canon-lock.md",
    "- artifacts/installment-promise-tracker.md",
    "- artifacts/series-payoff-ledger.md",
    "- artifacts/retcon-log.md",
    "- artifacts/series-repetition-radar.md",
    "- predecessor books' artifacts/book-handoff-packet.md when present",
    "- artifacts/continuity-ledger.md",
    "",
    "Required outputs:",
    "- update artifacts/series-verification-matrix.md with canon, voice, escalation, and promise alignment by book",
    "- update artifacts/series-timeline.md, artifacts/character-state-matrix.md, and artifacts/reveal-spoiler-matrix.md for any chronology, state, or knowledge-order failures",
    "- update artifacts/retcon-log.md and artifacts/series-repetition-radar.md when verification finds canon bending or repeated-book structure risk",
    "- update artifacts/continuity-ledger.md for cross-book continuity issues",
    "- create or update book-level artifacts/revision-tickets.md for concrete repairs",
    "- update SERIES_STATUS.md with verification summary",
    "",
    "Verification rules:",
    "- A book does not pass verification if it improves locally while breaking earlier canon, recurring character logic, series escalation, or inherited promises.",
    "- Treat canon-lock.md as stronger than series-arc-map.md when they disagree.",
    "- Treat future-book entries as planned/provisional unless they have been locked by /genesis-series-lock-book or explicit user approval.",
    "- Do not solve verification failures by inventing new unapproved endings for later books; create revision tickets or provisional options instead.",
  ].join("\n");
}

function buildSeriesLockBookPrompt(root, bookRoot, args = "") {
  const relative = bookRoot && bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
  return [
    "Use the `genesis-for-pi` skill and lock one series installment into canon.",
    "",
    `Series root: ${root}`,
    `Book to lock: ${relative || args.trim() || "ask user"}`,
    "",
    "Read the book's manuscript, PROJECT_STATE.yaml, STATUS.md, delivery files, and major artifacts.",
    "",
    "Required outputs:",
    "- update artifacts/canon-lock.md with immutable facts, relationship states, chronology anchors, revealed secrets, and promises created by this book",
    "- update artifacts/series-bible.md with durable character, world, relationship, object, and location facts",
    "- update artifacts/series-arc-map.md with the book's ending state and carryover pressure",
    "- update artifacts/series-timeline.md, artifacts/character-state-matrix.md, and artifacts/reveal-spoiler-matrix.md with any locked chronology, state, or knowledge-order changes",
    "- update artifacts/installment-promise-tracker.md with promises paid, preserved, or newly created",
    "- update artifacts/series-payoff-ledger.md with setups created, paid off, preserved, or orphaned by this book",
    "- update the selected book's artifacts/book-handoff-packet.md with what the next installment must inherit",
    "- update artifacts/series-verification-matrix.md and artifacts/retcon-log.md to mark this book locked, ready-for-lock-review, or blocked by contradiction",
    "- update SERIES_STATE.yaml and SERIES_STATUS.md to reflect the locked installment",
    "",
    "Locking rules:",
    "- Only facts evidenced by the selected book's manuscript/artifacts may become locked canon.",
    "- Planned future-book material remains planned/provisional unless the user explicitly approves it as canon.",
    "- Do not invent missing endings, secrets, relationship states, or sequel setup to make the lock feel complete.",
    "- Do not silently retcon previous locked facts. If a contradiction exists, create a revision ticket or mark the lock as blocked.",
    "- If the book is incomplete, internally contradictory, or not user-approved as final enough, mark it ready-for-lock-review rather than locked.",
  ].join("\n");
}

function rewriteSeriesState(root, overrides = {}) {
  const previous = parseSimpleYaml(readIfExists(join(root, "SERIES_STATE.yaml")) || "");
  const books = listSeriesBookProjects(root);
  const plannedBooks = String(overrides.planned_books || previous.planned_books || books.length || 1);
  const seriesName = overrides.series_name || previous.series_name || basename(root);
  const currentBook = overrides.current_book || previous.current_book || "1";
  writeFileSync(join(root, "SERIES_STATE.yaml"), [
    `series_name: ${stringifyScalar(seriesName)}`,
    `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
    `status: ${stringifyScalar(overrides.status || previous.status || "active")}`,
    `workflow_mode: ${stringifyScalar("series")}`,
    `planned_books: ${stringifyScalar(plannedBooks)}`,
    `current_book: ${stringifyScalar(currentBook)}`,
    `series_root_initialized_by: ${stringifyScalar(previous.series_root_initialized_by || "genesis-series-start")}`,
    "book_roots:",
    ...books.map((bookRoot) => `  - ${stringifyScalar(bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot)}`),
    "",
  ].join("\n"), "utf8");
}

function addSeriesBookToWorkspace(root, premise = "") {
  const state = parseSimpleYaml(readIfExists(join(root, "SERIES_STATE.yaml")) || "");
  const books = listSeriesBookProjects(root);
  const nextIndex = books.length + 1;
  const plannedBooks = Math.max(nextIndex, Number.parseInt(state.planned_books, 10) || nextIndex);
  const bookRoot = initializeSeriesBookProject(root, state.series_name || basename(root), nextIndex, plannedBooks, premise);
  rewriteSeriesState(root, { planned_books: String(plannedBooks), current_book: String(nextIndex), status: "active" });
  writeFileSync(join(root, "SERIES_STATUS.md"), renderSeriesStatus(root), "utf8");
  return { root, bookRoot, index: nextIndex, plannedBooks };
}

function collectSeriesBlockers(root) {
  const blockers = [];
  for (const file of seriesArtifactMissing(root)) {
    blockers.push({ file, label: "Missing series artifact", evidence: `${file} does not exist.`, suggestion: "Scaffold or create this series-level source-of-truth file before relying on later books.", severity: "warning" });
  }

  for (const file of SERIES_ARTIFACTS) {
    const text = readIfExists(join(root, file));
    if (!text) continue;
    for (const finding of lintArtifactFile(file, text)) {
      blockers.push({ file, label: `Series artifact quality: ${finding.label}`, evidence: finding.evidence, suggestion: "Replace placeholders with concrete series decisions, evidence, or accepted-risk notes.", severity: "warning" });
    }
  }

  const retconLog = readIfExists(join(root, "artifacts", "retcon-log.md")) || "";
  const openRetconPattern = /\b(pending|proposed|open)\b/i;
  if (openRetconPattern.test(retconLog)) {
    blockers.push({
      file: "artifacts/retcon-log.md",
      label: "Open retcon or canon-bend decision",
      evidence: extractEvidence(retconLog, openRetconPattern),
      suggestion: "Resolve or explicitly defer open retcons before trusting downstream continuity.",
      severity: "warning",
    });
  }

  const seriesRegression = readIfExists(join(root, "evaluations", "series-regression-check.md")) || "";
  if (/status\s*:\s*(blocked|fail)|\b(blocker|failed|blocked)\b/i.test(seriesRegression)) {
    blockers.push({
      file: "evaluations/series-regression-check.md",
      label: "Series regression hard stop",
      evidence: extractEvidence(seriesRegression, /status\s*:\s*(blocked|fail)|\b(blocker|failed|blocked)\b/i),
      suggestion: "Repair the named cross-book regression before advancing later books.",
      severity: "blocker",
    });
  }

  const books = listSeriesBookProjects(root);
  if (!books.length) blockers.push({ file: "books/", label: "No book projects", evidence: "No Genesis book projects were found under books/.", suggestion: "Run /genesis-series-add-book or /genesis-series-start to create installment projects.", severity: "blocker" });

  books.forEach((bookRoot, index) => {
    const relative = bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
    for (const blocker of collectBlockers(bookRoot, true).filter((item) => item.severity === "blocker")) {
      blockers.push({ file: `${relative}/${blocker.file}`, label: `Book ${index + 1}: ${blocker.label}`, evidence: blocker.evidence, suggestion: blocker.suggestion, severity: "blocker" });
    }
    const stats = manuscriptStats(bookRoot);
    if (index > 0 && stats.chapters > 0) {
      const canon = readIfExists(join(root, "artifacts", "canon-lock.md")) || "";
      const previous = seriesBookDirName(index);
      if (!canon.includes(previous) && !canon.includes(`Book ${index}`)) {
        blockers.push({ file: "artifacts/canon-lock.md", label: `Book ${index + 1} may depend on unlocked predecessor`, evidence: `${relative} has manuscript chapters, but ${previous}/Book ${index} is not obviously recorded in canon-lock.md.`, suggestion: "Lock or explicitly defer the predecessor before finalizing later-book canon.", severity: "warning" });
      }
      const predecessorHandoff = join(root, "books", previous, "artifacts", "book-handoff-packet.md");
      if (!existsSync(predecessorHandoff)) {
        blockers.push({ file: `books/${previous}/artifacts/book-handoff-packet.md`, label: `Book ${index + 1} is missing predecessor handoff packet`, evidence: `${relative} has manuscript chapters, but ${previous} does not have artifacts/book-handoff-packet.md.`, suggestion: "Generate the predecessor handoff packet when locking or approving the earlier book so later books inherit cleanly.", severity: "warning" });
      }
    }
  });
  return blockers;
}

function renderSeriesBlockers(root) {
  const blockers = collectSeriesBlockers(root);
  if (!blockers.length) return "No series blockers detected by Genesis triage.";
  return blockers.map((blocker, index) => `${index + 1}. [${blocker.severity}] ${blocker.label}\n   file: ${blocker.file}\n   evidence: ${blocker.evidence}\n   suggested action: ${blocker.suggestion}`).join("\n\n");
}

function buildSeriesScorePrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and produce a whole-series score.",
    "",
    `Series root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read shared series files and each book project under `books/`. Keep locked canon, draft facts, and planned future material separate while scoring.",
    "",
    "Score these dimensions from 0-100 with evidence:",
    "- canon stability",
    "- timeline / chronology coherence",
    "- series arc escalation",
    "- promise/payoff integrity",
    "- recurring character continuity",
    "- reveal-order / spoiler integrity",
    "- repetition and reader-fatigue risk",
    "- book-to-book onboarding clarity",
    "- final-book obligation readiness",
    "- commercial series cohesion",
    "",
    "Required outputs:",
    "- write artifacts/series-score.md",
    "- update artifacts/series-payoff-ledger.md for orphaned or underpaid promises",
    "- update artifacts/series-verification-matrix.md with score-relevant risks",
    "- create or update revision tickets in affected book projects for concrete fixes",
    "- update SERIES_STATUS.md with the score summary",
  ].join("\n");
}

function createSeriesExport(root) {
  ensureDir(join(root, "delivery"));
  const books = listSeriesBookProjects(root);
  const files = [];
  const combined = [];
  for (const bookRoot of books) {
    const relative = bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
    const result = compileManuscript(bookRoot);
    const compiled = readIfExists(join(bookRoot, "delivery", "manuscript-full.md")) || "";
    const destinationName = `${basename(bookRoot)}-manuscript.md`;
    writeFileSync(join(root, "delivery", destinationName), compiled, "utf8");
    files.push(`delivery/${destinationName}`);
    combined.push(`# ${relative}\n\n${compiled.trim()}`);
    writeFileSync(join(bookRoot, "STATUS.md"), renderStatusDashboard(bookRoot), "utf8");
  }
  writeFileSync(join(root, "delivery", "full-series-manuscript.md"), combined.length ? combined.join("\n\n---\n\n") + "\n" : "# Full Series Manuscript\n\n_No book manuscripts found._\n", "utf8");
  files.push("delivery/full-series-manuscript.md");

  const status = renderSeriesStatus(root);
  writeFileSync(join(root, "SERIES_STATUS.md"), status, "utf8");
  writeFileSync(join(root, "delivery", "series-status-report.md"), status, "utf8");
  const handoffSections = books.map((bookRoot) => {
    const relative = bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot;
    const handoff = readIfExists(join(bookRoot, "artifacts", "book-handoff-packet.md"));
    return handoff ? `# ${relative} — Book Handoff Packet\n\n${handoff.trim()}` : null;
  }).filter(Boolean);
  writeFileSync(join(root, "delivery", "series-bible-export.md"), [
    readIfExists(join(root, "artifacts", "series-bible.md")) || "# Series Bible\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "series-arc-map.md")) || "# Series Arc Map\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "series-timeline.md")) || "# Series Timeline\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "character-state-matrix.md")) || "# Character State Matrix\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "reveal-spoiler-matrix.md")) || "# Reveal / Spoiler Matrix\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "series-payoff-ledger.md")) || "# Series Payoff Ledger\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "series-verification-matrix.md")) || "# Series Verification Matrix\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "retcon-log.md")) || "# Retcon Log\n\n_missing_",
    "\n---\n",
    readIfExists(join(root, "artifacts", "series-repetition-radar.md")) || "# Series Repetition Radar\n\n_missing_",
    readIfExists(join(root, "evaluations", "series-regression-check.md")) ? `\n---\n\n${readIfExists(join(root, "evaluations", "series-regression-check.md")).trim()}` : "",
    ...(handoffSections.length ? ["\n---\n", ...handoffSections] : []),
  ].join("\n"), "utf8");
  files.push("delivery/series-status-report.md", "delivery/series-bible-export.md");

  writeFileSync(join(root, "delivery", "series-editorial-handoff.md"), [
    "# Series Editorial Handoff",
    "",
    `- Series root: ${root}`,
    `- Book projects: ${books.length}`,
    `- Series blockers/warnings: ${collectSeriesBlockers(root).length}`,
    "- Full series manuscript: delivery/full-series-manuscript.md",
    "- Series bible export: delivery/series-bible-export.md",
    "",
    "## Book projects",
    "",
    ...books.map((bookRoot, index) => `- Book ${index + 1}: ${bookRoot.startsWith(root) ? bookRoot.slice(root.length + 1) : bookRoot}`),
    "",
  ].join("\n"), "utf8");
  writeFileSync(join(root, "delivery", "series-export-manifest.md"), ["# Series Export Manifest", "", `Generated: ${new Date().toISOString()}`, "", ...files.map((file) => `- ${file}`), "- delivery/series-editorial-handoff.md", ""].join("\n"), "utf8");
  files.push("delivery/series-editorial-handoff.md", "delivery/series-export-manifest.md");
  return { root, books: books.length, files };
}

function migrateProject(root) {
  ensureDir(root);
  for (const dir of PROJECT_ROOT_DIRS) ensureDir(join(root, dir));
  if (!existsSync(join(root, "PROJECT_STATE.yaml"))) {
    const inferredPhase = inferPhaseFromFiles(root);
    const projectName = basename(root);
    writeFileSync(
      join(root, "PROJECT_STATE.yaml"),
      [
        `project_name: ${stringifyScalar(projectName)}`,
        `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
        `current_phase: ${stringifyScalar(inferredPhase)}`,
        `workflow_mode: ${stringifyScalar("unknown")}`,
        `status: ${stringifyScalar("migrated")}`,
        `migration_note: ${stringifyScalar("PROJECT_STATE.yaml created by genesis-migrate")}`,
        "",
      ].join("\n"),
      "utf8",
    );
  } else {
    const statePath = join(root, "PROJECT_STATE.yaml");
    const state = readIfExists(statePath) || "";
    if (!/^genesis_schema_version\s*:/im.test(state)) writeFileSync(statePath, setYamlScalar(state, "genesis_schema_version", GENESIS_SCHEMA_VERSION), "utf8");
  }
  writeIfMissing(join(root, "ASSUMPTIONS.md"), "# Assumptions\n\n## Inferred assumptions\n\n- Workflow mode: unknown\n");
  writeIfMissing(join(root, "artifacts", "00-brief.md"), "# Brief\n\nRecovered by /genesis-migrate. Fill in the original idea and reader promise.\n");
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  for (const expected of getExpectedFilesForPhase(phase)) {
    const template = findTemplateEntryByDestination(expected);
    if (template) scaffoldTemplate(root, template.template, template.destination, false);
    else if (expected.endsWith("/") || expected === "manuscript/chapters") ensureDir(join(root, expected));
  }
  const mode = detectWorkflowMode(root);
  scaffoldModeArtifacts(root, mode, false);
  const gitInitialized = maybeInitGit(root);
  writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
  return { root, phase, mode, gitInitialized, missing: missingExpectedForPhase(root, phase) };
}


function extractTitleFromText(text, fallback) {
  const heading = String(text || "").match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function collectTextFiles(root, maxDepth = 3) {
  const files = [];
  function walk(dir, depth) {
    if (!existsSync(dir) || depth > maxDepth) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (/\.(md|markdown|txt)$/i.test(entry.name)) files.push(full);
    }
  }
  try {
    const stat = statSync(root);
    if (stat.isDirectory()) walk(root, 0);
    else files.push(root);
  } catch {
    return [];
  }
  return files.sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
}

function readPrdSource(sourcePath) {
  const files = collectTextFiles(sourcePath, 4);
  const parts = [];
  for (const file of files) {
    const text = readIfExists(file) || "";
    if (!text.trim()) continue;
    parts.push({ file, text });
  }
  return { files, firstText: parts[0]?.text || "", text: parts.map((part) => `# Source: ${part.file}\n\n${part.text.trim()}`).join("\n\n---\n\n") };
}

function inferWorkflowModeFromPrd(text) {
  const lower = String(text || "").toLowerCase();
  if (/certification|exam|blueprint|objectives|practice questions|domain/.test(lower)) return "certification prep";
  if (/bible|biblical|scripture|gospel|old testament|new testament|jesus|mary|moses|david|apostle|prophet|sacred retelling|parable/.test(lower)) return "biblical fiction";
  if (/study guide|lesson|learning objective|quiz|chapter objectives/.test(lower)) return "study guide";
  if (/memoir|personal essay|lived experience|my story/.test(lower)) return "memoir";
  if (/series|book\s*[1-9]|installment|trilogy|saga/.test(lower)) return "series installment";
  if (/nonfiction|argument|framework|prescriptive|reader transformation|case stud/.test(lower)) return "prescriptive nonfiction";
  return "novel";
}

const PRD_COMPLETENESS_DIMENSIONS = [
  { key: "reader", label: "Target reader / audience", patterns: [/audience/i, /target reader/i, /reader persona/i, /market/i], question: "Who is the exact reader and what do they already want, fear, or believe?" },
  { key: "promise", label: "Reader promise", patterns: [/reader promise/i, /promise/i, /hook/i, /premise/i, /value proposition/i], question: "What promise does the book make in the first pages and on the sales page?" },
  { key: "voice", label: "Voice and taste", patterns: [/voice/i, /tone/i, /style/i, /taste/i, /sounds like/i], question: "What should the prose sound like, and what must it never sound like?" },
  { key: "structure", label: "Structure / architecture", patterns: [/outline/i, /structure/i, /chapters?/i, /acts?/i, /table of contents/i], question: "What is the intended structure, act shape, or chapter sequence?" },
  { key: "scope", label: "Scope and length", patterns: [/word count/i, /length/i, /scope/i, /deliverables?/i, /page count/i], question: "What target length and scope boundaries should Genesis protect?" },
  { key: "success", label: "Success criteria", patterns: [/success criteria/i, /definition of done/i, /acceptance criteria/i, /quality bar/i], question: "How will you know the book is good enough to draft, revise, and package?" },
  { key: "risk", label: "Risk budget", patterns: [/risk/i, /controvers/i, /must not/i, /non-negotiable/i, /avoid/i], question: "Which risks are intentional, and which failures are unacceptable?" },
  { key: "market", label: "Positioning / comps", patterns: [/comps?/i, /positioning/i, /category/i, /genre/i, /competitive/i], question: "What shelf/category, comp set, or market expectation should shape the publication target?" },
  { key: "research", label: "Research / evidence", patterns: [/research/i, /sources?/i, /evidence/i, /references?/i, /interview/i], question: "What sources, domain checks, interviews, or canon files are authoritative?" },
];

function analyzePrdCompleteness(text) {
  const results = PRD_COMPLETENESS_DIMENSIONS.map((dimension) => {
    const matched = dimension.patterns.filter((pattern) => pattern.test(text || ""));
    const confidence = matched.length >= 2 ? "high" : matched.length === 1 ? "medium" : "missing";
    const points = matched.length >= 2 ? 12 : matched.length === 1 ? 7 : 0;
    return { ...dimension, matched: matched.length, confidence, points };
  });
  const total = results.reduce((sum, item) => sum + item.points, 0);
  const max = PRD_COMPLETENESS_DIMENSIONS.length * 12;
  const score = Math.round((total / max) * 100);
  const missing = results.filter((item) => item.confidence === "missing");
  const weak = results.filter((item) => item.confidence === "medium");
  const readiness = score >= 80 && !missing.length ? "ready_with_minor_gaps" : score >= 60 ? "usable_but_gap_interview_required" : "not_ready_without_writer_answers";
  return { score, readiness, results, missing, weak };
}

function renderPrdCompletenessScore(root, sourceLabel, analysis) {
  return [
    "# PRD Completeness Score",
    "",
    `- Project root: ${root}`,
    `- Source: ${sourceLabel}`,
    `- Score: ${analysis.score}/100`,
    `- Readiness: ${analysis.readiness}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Dimension results",
    "",
    "| Dimension | Confidence | Points | Gap question |",
    "| --- | --- | ---: | --- |",
    ...analysis.results.map((item) => `| ${item.label} | ${item.confidence} | ${item.points} | ${item.confidence === "high" ? "—" : item.question} |`),
    "",
    "## Gate policy",
    "",
    "- 80+ with no missing dimensions: Genesis may proceed into Foundation after writer approval.",
    "- 60-79 or any missing dimension: run gap-only interview before trusting extracted artifacts.",
    "- Below 60: do not draft prose; repair the PRD or answer the gap report first.",
    "",
  ].join("\n");
}

function renderPrdGapReport(sourceLabel, analysis) {
  return [
    "# PRD Gap Report",
    "",
    `Source: ${sourceLabel}`,
    `Readiness: ${analysis.readiness}`,
    "",
    "## Gap-only interview",
    "",
    ...(analysis.missing.length || analysis.weak.length
      ? [...analysis.missing, ...analysis.weak].map((item, index) => `${index + 1}. ${item.question} _(dimension: ${item.label}; confidence: ${item.confidence})_`)
      : ["No major PRD gaps detected by the lightweight importer. Writer approval is still required before autopilot drafting."]),
    "",
    "## Extraction rule",
    "",
    "Only fill Genesis artifacts from claims supported by the PRD. Anything inferred must be recorded in ASSUMPTIONS.md and traced here or in prd-traceability-map.md.",
    "",
  ].join("\n");
}

function renderPrdTraceabilityMap(sourceLabel, analysis) {
  return [
    "# PRD Traceability Map",
    "",
    `Source: ${sourceLabel}`,
    "",
    "## How to use this map",
    "",
    "Every Genesis decision imported from the PRD should be traced to a section, quote, or source file. Do not treat unsupported ideas as facts.",
    "",
    "| Genesis artifact / decision | PRD source evidence | Confidence | Open questions |",
    "| --- | --- | --- | --- |",
    "| artifacts/00-brief.md | pending agent extraction from PRD | pending | confirm premise, reader promise, workflow mode |",
    "| artifacts/author-intent.md | pending agent extraction from PRD | pending | confirm why this book must exist |",
    "| artifacts/taste-profile.md | pending agent extraction from PRD | pending | confirm what should not be smoothed away |",
    "| artifacts/risk-budget.md | pending agent extraction from PRD | pending | separate intentional risks from unacceptable failures |",
    "| artifacts/publication-shape.md | pending agent extraction from PRD | pending | confirm standalone vs series, ending obligation, commercial promise |",
    "| artifacts/reader-promise-tracker.md | pending agent extraction from PRD | pending | identify opening, genre, emotional, nonfiction, or study-guide promises |",
    "",
    "## Lightweight importer findings",
    "",
    ...analysis.results.map((item) => `- ${item.label}: ${item.confidence}`),
    "",
  ].join("\n");
}

function renderQualityGates(root, analysis = null) {
  const blockers = collectBlockers(root, false).filter((item) => item.file !== "artifacts/quality-gates.md");
  const prdScore = analysis?.score ?? null;
  const prdBlocked = typeof prdScore === "number" && prdScore < 80;
  return [
    "# Quality Gates",
    "",
    "gate_status: " + (prdBlocked || blockers.some((item) => item.severity === "blocker") ? "blocked" : "open_for_next_safe_step"),
    "",
    "## Hard gates",
    "",
    `- PRD readiness: ${typeof prdScore === "number" ? `${prdScore}/100` : "unknown"}${prdBlocked ? " — blocked until gap-only interview is answered or accepted" : ""}`,
    `- Active hard blockers: ${blockers.filter((item) => item.severity === "blocker").length}`,
    "- Writer approval required after PRD import, voice fingerprint, first-page/sample draft, chapter one, pre-full-drafting, and final polish.",
    "- Autopilot may not change premise, audience, voice, ending, POV, genre promise, risk budget, or major structure without explicit writer approval.",
    "",
    "## Approval gate statuses",
    "",
    "| Gate | Status | Evidence / next action |",
    "| --- | --- | --- |",
    `| PRD import | ${prdBlocked ? "needs_writer_approval" : "ready_for_review"} | Review prd-gap-report.md and prd-traceability-map.md |`,
    "| Voice fingerprint | pending | Run /genesis-voice-ingest or fill author-voice-fingerprint.md |",
    "| First-page sample | pending | Draft and approve a sample before full drafting |",
    "| Chapter one | pending | Approve or repair Chapter 1 before chapter autopilot |",
    "| Pre-full-drafting | pending | Approve outline, queue, continuity, and quality gates |",
    "| Final polish | pending | Run adversarial audit and Genesis Score first |",
    "",
  ].join("\n");
}

function renderTasteLock() {
  return [
    "# Taste Lock",
    "",
    "Purpose: protect the writer's actual taste from being optimized away by automation.",
    "",
    "## Locked taste constraints",
    "",
    "- pending PRD/voice extraction",
    "",
    "## Things automation may not smooth away",
    "",
    "- productive roughness: pending",
    "- intentional opacity: pending",
    "- moral or emotional risk: pending",
    "- taboo phrases / generic cadences to avoid: pending",
    "",
    "## Approval policy",
    "",
    "Any proposed change to voice, weirdness, ending shape, reader cost, darkness, humor, restraint, or risk budget requires writer approval and a decision-ledger entry.",
    "",
  ].join("\n");
}

function renderDecisionLedger() {
  return [
    "# Decision Ledger",
    "",
    "Track approved pivots, rejected ideas, unresolved choices, and decisions that automation must not silently reverse.",
    "",
    "| Date | Decision | Source / evidence | Status | Do-not-reintroduce notes |",
    "| --- | --- | --- | --- | --- |",
    `| ${new Date().toISOString().slice(0, 10)} | PRD-first Genesis workflow initialized | /genesis-prd-start | active | Do not replace PRD-backed decisions with generic genre defaults |`,
    "",
  ].join("\n");
}

function renderChapterProductionQueue(root) {
  const outline = readIfExists(join(root, "artifacts", "05-outline.md")) || "";
  const chapters = collectManuscriptChapters(root);
  const outlineHeadings = [...outline.matchAll(/^#{2,3}\s+(.+)$/gm)].slice(0, 40).map((match) => match[1].trim());
  const queueRows = outlineHeadings.length
    ? outlineHeadings.map((title, index) => `| ${index + 1} | ${title} | queued | define scene goal, function profile, reader promise, continuity constraints, carry-forward constraints, tension forecast, taste lock checks |`)
    : ["| 1 | pending outline | blocked | Create or approve artifacts/05-outline.md before chapter autopilot |"];
  return [
    "# Chapter Production Queue",
    "",
    `- Existing chapter files: ${chapters.length}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Queue",
    "",
    "| # | Chapter / packet | Status | Draft packet requirements |",
    "| ---: | --- | --- | --- |",
    ...queueRows,
    "",
    "## Per-chapter packet contract",
    "",
    "Each chapter packet must include: chapter purpose, dominant scene engine and contrast, scene/section list, scene-function profile, reader promise touched, causality link, subplot/argument pressure, external-clock/midpoint/ending pressure, protagonist and secondary-character agency, continuity constraints, carry-forward constraints, tension forecast, technical/plain-language load, mode-specific safeguards such as sacred-retelling source/invention/translation/figure/supernatural checks when applicable, human-specificity seeds, voice/taste-lock notes, rhetorical-shape watch, forbidden filler, and post-draft ledger updates.",
    "",
  ].join("\n");
}

function renderWriterCockpit(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const mode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const hard = blockers.filter((item) => item.severity === "blocker");
  const stats = manuscriptStats(root);
  const prdScore = readIfExists(join(root, "artifacts", "prd-completeness-score.md"))?.match(/Score:\s*(\d+)\/100/i)?.[1] || "unknown";
  const gates = readIfExists(join(root, "artifacts", "quality-gates.md")) || "";
  const gateStatus = gates.match(/gate_status:\s*([^\n]+)/i)?.[1]?.trim() || "unknown";
  const nextDecisions = [];
  if (prdScore === "unknown" || Number(prdScore) < 80) nextDecisions.push("Answer or accept PRD gap report before trusting automation.");
  if (!existsSync(join(root, "artifacts", "author-voice-fingerprint.md"))) nextDecisions.push("Provide voice samples or approve a generated voice fingerprint.");
  if (!existsSync(join(root, "artifacts", "05-outline.md"))) nextDecisions.push("Approve architecture/outline before chapter queue autopilot.");
  if (hard.length) nextDecisions.push(`Clear hard blocker: ${hard[0].file}`);
  return [
    "# Writer Cockpit",
    "",
    `- Project root: ${root}`,
    `- Phase: ${phase}`,
    `- Workflow mode: ${mode}`,
    `- PRD completeness: ${prdScore}${prdScore !== "unknown" ? "/100" : ""}`,
    `- Gate status: ${gateStatus}`,
    `- Manuscript: ${stats.chapters} chapter file(s), ${stats.words} words`,
    `- Hard blockers: ${hard.length}`,
    `- Next best action: ${nextRecommendedAction(root)}`,
    "",
    "## Writer decisions needed next",
    "",
    ...(nextDecisions.length ? nextDecisions.map((item) => `- ${item}`) : ["- none detected by lightweight cockpit; review quality-gates.md before autopilot."]),
    "",
    "## Automation allowed now",
    "",
    hard.length || /blocked|needs_writer_approval/i.test(gateStatus)
      ? "- No ungated autopilot. Use /genesis-blockers, answer gap questions, or explicitly update quality-gates.md."
      : "- Safe to run /genesis-autopilot for the next bounded phase or /genesis-chapter-queue if architecture is approved.",
    "",
    "## Top blockers / warnings",
    "",
    ...(blockers.length ? blockers.slice(0, 6).map((item) => `- [${item.severity}] ${item.label} — ${item.file}`) : ["- none"]),
    "",
  ].join("\n");
}

function createPrdAutomationArtifacts(root, sourceLabel, analysis) {
  ensureDir(join(root, "artifacts"));
  writeFileSync(join(root, "artifacts", "prd-completeness-score.md"), renderPrdCompletenessScore(root, sourceLabel, analysis), "utf8");
  writeFileSync(join(root, "artifacts", "prd-gap-report.md"), renderPrdGapReport(sourceLabel, analysis), "utf8");
  writeFileSync(join(root, "artifacts", "prd-traceability-map.md"), renderPrdTraceabilityMap(sourceLabel, analysis), "utf8");
  writeFileSync(join(root, "artifacts", "quality-gates.md"), renderQualityGates(root, analysis), "utf8");
  writeFileSync(join(root, "artifacts", "taste-lock.md"), renderTasteLock(), "utf8");
  writeFileSync(join(root, "artifacts", "decision-ledger.md"), renderDecisionLedger(), "utf8");
  writeFileSync(join(root, "artifacts", "writer-questions.md"), renderWriterQuestions(root), "utf8");
  writeFileSync(join(root, "artifacts", "chapter-production-queue.md"), renderChapterProductionQueue(root), "utf8");
  writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
}

function buildPrdExtractionPrompt(root, sourceLabel, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run PRD-first intake automation.",
    "",
    `Project root: ${root}`,
    `PRD source: ${sourceLabel}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read first:",
    "- artifacts/book-prd.md",
    "- research/notes/source-prd.md",
    "- artifacts/prd-completeness-score.md",
    "- artifacts/prd-gap-report.md",
    "- artifacts/prd-traceability-map.md",
    "- PROJECT_STATE.yaml",
    "- ASSUMPTIONS.md",
    "",
    "Required outputs:",
    "- update artifacts/00-brief.md from PRD-supported facts only",
    "- update artifacts/author-intent.md, artifacts/taste-profile.md, artifacts/risk-budget.md, and artifacts/publication-shape.md",
    "- update artifacts/reader-promise-tracker.md and artifacts/review-personas.md",
    "- update artifacts/prd-traceability-map.md so every imported decision cites PRD section/file evidence and confidence",
    "- update artifacts/prd-gap-report.md with a gap-only interview: ask only missing questions not answered by the PRD",
    "- update artifacts/quality-gates.md with gate_status blocked if writer approval or missing PRD evidence is required",
    "- update artifacts/taste-lock.md and artifacts/decision-ledger.md for non-negotiables, rejected ideas, and automation boundaries",
    "- update artifacts/writer-cockpit.md as the one-page writer dashboard",
    "- update PROJECT_STATE.yaml, ASSUMPTIONS.md, and STATUS.md",
    "",
    "Rules:",
    "1. The PRD is upstream source material, not a license to hallucinate. Extract only what it supports.",
    "2. Anything inferred goes in ASSUMPTIONS.md as provisional and in prd-traceability-map.md with low confidence.",
    "3. If the PRD lacks reader promise, audience, voice/taste, structure, scope, success criteria, or risk budget, stop with gap questions instead of drafting.",
    "4. Do not draft manuscript prose in this pass.",
    "5. Preserve creative sovereignty: do not optimize away intentional risk, weirdness, opacity, or taste to satisfy the PRD score.",
    "6. Commit each changed file separately when inside a Git work tree.",
    "",
    "Proceed with PRD import and gap-only interview now.",
  ].join("\n");
}

function buildAutopilotPrompt(root, args = "") {
  const blockers = collectBlockers(root, true).filter((item) => item.severity === "blocker");
  return [
    "Use the `genesis-for-pi` skill and run gated writer-safe autopilot.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Autopilot target/instructions: ${args.trim()}` : "Autopilot target/instructions: next safe bounded step only",
    `Known hard blockers: ${blockers.length ? blockers.map((item) => item.file).join(", ") : "none from lightweight precheck"}`,
    "",
    "Read first:",
    "- artifacts/quality-gates.md",
    "- artifacts/writer-cockpit.md",
    "- artifacts/prd-gap-report.md and artifacts/prd-traceability-map.md when present",
    "- artifacts/taste-lock.md and artifacts/decision-ledger.md",
    "- PROJECT_STATE.yaml and STATUS.md",
    "",
    "Autopilot rules:",
    "1. Advance only one bounded step: foundation, architecture, chapter queue, one chapter packet, one chapter draft, or one post-chapter ledger update.",
    "2. Stop at writer approval gates: PRD import, voice fingerprint, first page/sample, chapter one, pre-full-drafting, final polish.",
    "3. Do not change premise, reader, voice, ending, POV, genre promise, risk budget, or major structure without explicit writer approval recorded in decision-ledger.md.",
    "4. Do not draft around quality gates. If gate_status is blocked or needs_writer_approval, update writer-cockpit.md with what the writer must decide and stop.",
    "5. Use PRD traceability and taste lock as constraints; do not replace them with generic best practices.",
    "6. Update quality-gates.md, writer-cockpit.md, decision-ledger.md, PROJECT_STATE.yaml, and STATUS.md before stopping.",
    "7. Commit each changed file separately when inside a Git work tree.",
    "",
    "Proceed only if gates allow it; otherwise explain the blocked gate in project files.",
  ].join("\n");
}

function buildChapterQueuePrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and build or advance the chapter/scene production queue.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read first:",
    "- artifacts/05-outline.md",
    "- artifacts/causality-chain.md",
    "- artifacts/05-subplot-map.md or artifacts/argument-spine.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/taste-lock.md",
    "- artifacts/quality-gates.md",
    "",
    "Required output:",
    "- update artifacts/chapter-production-queue.md with draftable packets",
    "- each packet must name chapter goal, dominant scene engine and contrast, scene/section beats, scene-function profile, therefore/but link, promise touched, pressure added, external-clock/midpoint/ending pressure, protagonist and secondary-character agency, continuity constraints, carry-forward constraints, tension forecast, technical/plain-language load, mode-specific safeguards such as sacred-retelling source/invention/translation/figure/supernatural checks when applicable, human-specificity seeds, voice/taste constraints, rhetorical-shape watch, forbidden filler, and post-draft ledger tasks",
    "- mark packets blocked when outline, voice, or quality gates are not approved",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Do not draft chapter prose unless the user explicitly asks. Build the queue so drafting can be automated safely later.",
  ].join("\n");
}

function buildPostChapterUpdatePrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run automatic post-chapter ledger updates.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Chapter selection/instructions: ${args.trim()}` : "Chapter selection/instructions: latest changed chapter(s) or ask if unclear",
    "",
    "Read manuscript chapter files and update only evidence-backed project memory:",
    "- artifacts/continuity-ledger.md: names, timeline, objects, locations, facts, unresolved questions, clues, reveals",
    "- artifacts/reader-promise-tracker.md: promises touched, paid, delayed, or newly opened",
    "- artifacts/causality-chain.md: therefore/but links created or broken",
    "- artifacts/scene-embodiment-map.md: physical action, objects, interruption, spatial pressure, practical stakes",
    "- artifacts/human-specificity-ledger.md: restrained lived details actually present or needed",
    "- evaluations/chapter-scorecards.md: compact diagnostic for the chapter, including packet carry-through, dropped constraints, and whether the ending became too easy to forecast",
    "- artifacts/chapter-production-queue.md: packet status and next packet",
    "- artifacts/revision-tickets.md: concrete issues only, with evidence and affected files",
    "- artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Rules:",
    "- Do not invent continuity facts not present in chapters or artifacts.",
    "- Do not polish prose in this pass unless the user explicitly asks; this is memory and QA automation.",
    "- If the chapter violates taste-lock, quality-gates, or reader promise, create revision tickets instead of silently fixing the book's direction.",
    "- If prose drops packet-required promises, reveals, continuity constraints, or other carry-forward obligations, record the drift and ticket it.",
  ].join("\n");
}

function buildTasteLockPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and update the project taste lock.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Taste/voice/risk instructions: ${args.trim()}` : "Taste/voice/risk instructions: derive from PRD, voice samples, author-intent, taste-profile, and risk-budget; ask only missing questions",
    "",
    "Required outputs:",
    "- update artifacts/taste-lock.md with locked taste constraints and automation boundaries",
    "- update artifacts/taste-profile.md, artifacts/risk-budget.md, artifacts/author-voice-fingerprint.md, and artifacts/voice-bible.md when supported by evidence",
    "- update artifacts/decision-ledger.md with approved non-negotiables and rejected smoothing moves",
    "- update artifacts/quality-gates.md if writer approval is needed",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Do not make the book safer, smoother, cleaner, or more generically marketable unless the writer explicitly approves that tradeoff.",
  ].join("\n");
}

function canRunAutopilot(root) {
  const hard = collectBlockers(root, true).filter((item) => item.severity === "blocker");
  return { ok: hard.length === 0, hard };
}


function extractMarkdownHeadings(text, limit = 20) {
  return [...String(text || "").matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => match[1].trim()).slice(0, limit);
}

function renderPrdChangeLog(root, candidateSource, oldText, newText) {
  const oldWords = countWords(oldText || "");
  const newWords = countWords(newText || "");
  const oldHeadings = extractMarkdownHeadings(oldText, 30);
  const newHeadings = extractMarkdownHeadings(newText, 30);
  const addedHeadings = newHeadings.filter((heading) => !oldHeadings.includes(heading));
  const removedHeadings = oldHeadings.filter((heading) => !newHeadings.includes(heading));
  return [
    "# PRD Change Log",
    "",
    `- Project root: ${root}`,
    `- Candidate PRD source: ${candidateSource}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Previous PRD words: ${oldWords}`,
    `- Candidate PRD words: ${newWords}`,
    `- Word-count delta: ${newWords - oldWords}`,
    "",
    "## Lightweight structural changes",
    "",
    "### Added headings",
    "",
    ...(addedHeadings.length ? addedHeadings.map((item) => `- ${item}`) : ["- none detected by lightweight precheck"]),
    "",
    "### Removed headings",
    "",
    ...(removedHeadings.length ? removedHeadings.map((item) => `- ${item}`) : ["- none detected by lightweight precheck"]),
    "",
    "## Required agent review",
    "",
    "Classify semantic changes to audience, promise, voice, structure, scope, ending/publication shape, success criteria, risk budget, research/canon, and constraints. Update this file with evidence before accepting the new PRD as source of truth.",
    "",
  ].join("\n");
}

function renderDecisionImpactReport(root, candidateSource) {
  return [
    "# Decision Impact Report",
    "",
    `- Project root: ${root}`,
    `- Candidate PRD source: ${candidateSource}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Impact matrix",
    "",
    "| Area | Impact | Evidence | Required action |",
    "| --- | --- | --- | --- |",
    "| Audience / target reader | pending semantic diff | pending | confirm before updating artifacts |",
    "| Reader promise / hook | pending semantic diff | pending | confirm before updating brief and promise tracker |",
    "| Voice / taste | pending semantic diff | pending | update taste-lock only with writer approval |",
    "| Structure / outline | pending semantic diff | pending | run outline stress test after changes |",
    "| Scope / target length | pending semantic diff | pending | update expansion-integrity and quality gates |",
    "| Ending / publication shape | pending semantic diff | pending | writer approval required |",
    "| Risk budget | pending semantic diff | pending | update risk-budget and decision-ledger |",
    "| Research / canon | pending semantic diff | pending | update reference inventory, canon, or assumptions |",
    "",
    "## Gate",
    "",
    "Do not replace `artifacts/book-prd.md` with the candidate PRD until the writer accepts the impacted decisions or the changes are classified as non-substantive.",
    "",
  ].join("\n");
}

function renderWriterQuestions(root) {
  const questions = [];
  const gap = readIfExists(join(root, "artifacts", "prd-gap-report.md")) || "";
  for (const match of gap.matchAll(/^\d+\.\s+(.+)$/gm)) questions.push(match[1].trim());
  const gates = readIfExists(join(root, "artifacts", "quality-gates.md")) || "";
  if (/needs_writer_approval|blocked/i.test(gates)) questions.push("Which blocked quality gate should be approved, revised, or kept blocked?");
  if (!existsSync(join(root, "artifacts", "author-voice-fingerprint.md"))) questions.push("Can you provide or approve voice samples so Genesis can lock author voice before full drafting?");
  if (!existsSync(join(root, "artifacts", "publication-shape.md"))) questions.push("Should this book resolve as standalone, series-open, literary-residue, commercial-closure, or another publication shape?");
  if (!existsSync(join(root, "artifacts", "05-outline.md"))) questions.push("Should Genesis build architecture now, or do you want to supply/approve an outline first?");
  const unique = [...new Set(questions)].slice(0, 30);
  return [
    "# Writer Questions",
    "",
    `- Project root: ${root}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Must answer before safe automation",
    "",
    ...(unique.length ? unique.map((item, index) => `${index + 1}. ${item}`) : ["- none detected by lightweight precheck"]),
    "",
    "## Can defer unless relevant",
    "",
    "- Final title, unless market positioning depends on it.",
    "- Epigraph, appendix, acknowledgments, and front/back matter preferences.",
    "- Fine-grained chapter titles until the outline is approved.",
    "",
  ].join("\n");
}

function renderOutlineStressTest(root) {
  const outline = readIfExists(join(root, "artifacts", "05-outline.md")) || "";
  const headings = extractMarkdownHeadings(outline, 60);
  return [
    "# Outline Stress Test",
    "",
    `- Project root: ${root}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Outline headings detected: ${headings.length}`,
    "",
    "## Lightweight precheck",
    "",
    ...(headings.length ? headings.map((heading, index) => `- ${index + 1}. ${heading}`) : ["- No outline headings detected. Create or repair `artifacts/05-outline.md` before drafting."]),
    "",
    "## Stress-test dimensions for agent review",
    "",
    "| Dimension | Risk to check | Verdict | Evidence | Required repair |",
    "| --- | --- | --- | --- | --- |",
    "| Middle movement | sag, repetition, no-state-change chapters | pending | pending | pending |",
    "| Scene-engine variety | repeated discovery/call/dashboard/conversation pattern | pending | pending | pending |",
    "| Setup becomes live problem | opening setup stays descriptive instead of turning into active pressure | pending | pending | pending |",
    "| External clock | no visible deadline or pressure countdown where genre needs one | pending | pending | pending |",
    "| Causality | and-then sequence instead of therefore/but | pending | pending | pending |",
    "| Reversals | missing option-changing turns | pending | pending | pending |",
    "| Midpoint turn | danger remains private, abstract, or merely diagnostic | pending | pending | pending |",
    "| Protagonist agency | lead only discovers, explains, audits, or reacts | pending | pending | pending |",
    "| Human pressure point | antagonist/system/institution remains abstract too long | pending | pending | pending |",
    "| Technical / conceptual clarity | jargon pileup or missing early plain-language model | pending | pending | pending |",
    "| Exposition by local need | explanation arrives because the scene needs it, not because the outline knows it | pending | pending | pending |",
    "| Subplot / argument pressure | decorative thread or weak integration | pending | pending | pending |",
    "| Reader promises | setup without payoff or genre betrayal | pending | pending | pending |",
    "| Tension forecastability | ending becomes too easy to predict too early; too few viable competing outcomes | pending | pending | pending |",
    "| Climax / final proof | false climax or underpowered final argument | pending | pending | pending |",
    "| Ending shape | mismatch with publication-shape.md | pending | pending | pending |",
    "| Expansion integrity | chapters that only add volume | pending | pending | pending |",
    "",
  ].join("\n");
}

function buildPrdDiffPrompt(root, candidateSource, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a PRD diff / impact review.",
    "",
    `Project root: ${root}`,
    `Candidate PRD source: ${candidateSource}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read first:",
    "- artifacts/book-prd.md (current accepted PRD)",
    "- research/notes/source-prd-candidate.md (candidate PRD)",
    "- artifacts/prd-change-log.md",
    "- artifacts/decision-impact-report.md",
    "- artifacts/prd-traceability-map.md",
    "- artifacts/quality-gates.md",
    "- artifacts/decision-ledger.md",
    "- artifacts/writer-cockpit.md",
    "",
    "Required outputs:",
    "- update artifacts/prd-change-log.md with semantic changes, not just wording changes",
    "- update artifacts/decision-impact-report.md with impact on audience, promise, voice, structure, scope, publication shape, risk, research/canon, and current draft/artifacts",
    "- update artifacts/writer-questions.md with only decisions the writer must answer",
    "- update artifacts/quality-gates.md with blocked/needs_writer_approval if changes affect protected decisions",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "- do not replace artifacts/book-prd.md unless the user explicitly says to accept the candidate PRD",
    "",
    "Rules:",
    "1. Treat changed premise, audience, ending, voice/taste, risk budget, POV, genre promise, target length, or structure as protected decisions requiring writer approval.",
    "2. Separate wording-only PRD edits from decision-changing edits.",
    "3. Create revision tickets only when the candidate PRD conflicts with existing outline/manuscript/artifacts and the repair is clear.",
  ].join("\n");
}

function buildQuestionsPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and generate writer-only questions.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read project state, PRD gap report, quality gates, writer cockpit, decision ledger, taste lock, outline, reader promises, revision tickets, and blockers.",
    "",
    "Required outputs:",
    "- update artifacts/writer-questions.md",
    "- group questions as must-answer-before-drafting, must-answer-before-revision, approval-needed, can-defer, and ignore/noise",
    "- remove questions already answered by PRD, decision-ledger, taste-lock, or explicit writer approval",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Question policy: ask only decisions that require the writer's judgment. Do not ask the writer to do artifact maintenance the agent can do safely.",
  ].join("\n");
}

function buildOutlineStressTestPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run an outline stress test before drafting.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read first:",
    "- artifacts/05-outline.md",
    "- artifacts/causality-chain.md",
    "- artifacts/05-subplot-map.md or artifacts/argument-spine.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/publication-shape.md",
    "- artifacts/expansion-integrity.md",
    "- artifacts/taste-lock.md",
    "- artifacts/prd-traceability-map.md when present",
    "",
    "Required outputs:",
    "- update evaluations/outline-stress-test.md with dimension verdicts and evidence",
    "- create or update artifacts/revision-tickets.md for concrete structural repairs",
    "- update artifacts/chapter-production-queue.md only if the outline passes or specific packets can be safely queued",
    "- update artifacts/writer-questions.md for decisions only the writer can answer",
    "- update artifacts/quality-gates.md, artifacts/writer-cockpit.md, and STATUS.md",
    "",
    "Stress dimensions: middle sag, repeated scene engines, opening setup that never becomes active pressure, missing external clock, weak therefore/but causality, missing reversals, soft midpoint, protagonist passivity/reactivity, abstract antagonist/system pressure, jargon without a plain model, exposition delivered before local scene need, decorative subplots, broken promises, premature ending forecastability, false climax, ending underpayment, nonfiction argument gaps, study-guide objective gaps, and padding risk.",
    "Do not draft prose in this pass.",
  ].join("\n");
}

function buildReviewPersonasPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and generate or refresh the reader/reviewer persona panel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read PRD, brief, market map, reader-promise-tracker, taste-profile, risk-budget, publication-shape, comps, and manuscript/outline if present.",
    "",
    "Required output:",
    "- update artifacts/review-personas.md with 4-7 concrete personas",
    "- include ideal core reader, genre-native reviewer, voice-sensitive craft reader, skeptical-but-persuadable reader, and hostile/misaligned reader unless the project needs different roles",
    "- for each persona include why they picked up the book, what they need from page one, what they forgive, what they will not forgive, what they will praise, what makes them DNF, what criticism to ignore, useful signal they may still provide, and review questions",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Personas should protect reader experience and author voice. Do not let a hostile persona become the target reader.",
    "When possible, keep critique blind and non-convergent: collect independent persona judgments before synthesis, and do not smooth them into one consensus voice too early.",
  ].join("\n");
}

function buildPersonaReviewPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a persona-based review panel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Review target/instructions: ${args.trim()}` : "Review target/instructions: choose outline if no manuscript exists, otherwise review the current manuscript at the safest scope",
    "",
    "Read first:",
    "- artifacts/review-personas.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/taste-lock.md",
    "- artifacts/publication-shape.md",
    "- artifacts/05-outline.md and/or manuscript/chapters/ depending on target",
    "- artifacts/revision-tickets.md when present",
    "",
    "Required outputs:",
    "- write or update evaluations/persona-review.md",
    "- for each persona, provide likely praise, likely complaint, DNF trigger, promise/payoff concern, voice/taste concern, and actionable repair",
    "- separate wrong-reader complaints from useful signal",
    "- create or update artifacts/revision-tickets.md only for concrete repairs supported by evidence",
    "- update artifacts/writer-questions.md if the review exposes decisions only the writer can make",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Do not revise the manuscript in this pass unless explicitly asked. Review first, ticket second.",
  ].join("\n");
}


function renderRegressionCheck(root) {
  const tickets = readIfExists(join(root, "artifacts", "revision-tickets.md")) || "";
  const promises = readIfExists(join(root, "artifacts", "reader-promise-tracker.md")) || "";
  const gates = readIfExists(join(root, "artifacts", "quality-gates.md")) || "";
  const chapters = collectManuscriptChapters(root);
  const openTicketCount = (tickets.match(/status\s*:\s*open|\|\s*open\s*\|/gi) || []).length;
  const gateStatus = gates.match(/gate_status:\s*([^\n]+)/i)?.[1]?.trim() || "unknown";
  return [
    "# Regression Check",
    "",
    `- Project root: ${root}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Chapter files: ${chapters.length}`,
    `- Open-ticket signals: ${openTicketCount}`,
    `- Quality gate status: ${gateStatus}`,
    `- Reader-promise tracker present: ${promises.trim() ? "yes" : "no"}`,
    "",
    "## Regression dimensions",
    "",
    "| Dimension | Verdict | Evidence | Required action |",
    "| --- | --- | --- | --- |",
    "| PRD / accepted decisions | pending | pending | check against book-prd, prd-traceability-map, decision-ledger |",
    "| Reader promise | pending | pending | verify promises remain opened, developed, and paid/managed |",
    "| Publication shape / ending | pending | pending | verify ending still matches publication-shape.md |",
    "| Continuity | pending | pending | verify names, facts, timeline, objects, locations, canon |",
    "| Voice / taste lock | pending | pending | verify author voice and non-smoothing constraints survived revision |",
    "| Causality / outline | pending | pending | verify revisions did not break therefore/but logic |",
    "| Plan-to-prose propagation | pending | pending | verify chapter packets, promises, reveals, and constraints still survive in the prose |",
    "| Revision tickets | pending | pending | verify fixed tickets stayed fixed and no resolved issue reopened |",
    "| Expansion integrity | pending | pending | verify no padding, duplicated beats, or ornamental expansion appeared |",
    "| Persona panel signal | pending | pending | verify target-reader concerns improved without obeying wrong-reader noise |",
    "",
    "## Reopened risks",
    "",
    "- pending",
    "",
    "## Gate recommendation",
    "",
    "- pending",
    "",
  ].join("\n");
}

function buildRegressionCheckPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a regression check after revision or PRD changes.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions / revision scope: ${args.trim()}` : "User instructions / revision scope: current project changes since last checkpoint or ask if unclear",
    "",
    "Read first:",
    "- artifacts/book-prd.md and artifacts/prd-traceability-map.md when present",
    "- artifacts/decision-ledger.md",
    "- artifacts/quality-gates.md and artifacts/writer-cockpit.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/publication-shape.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/taste-lock.md, artifacts/voice-bible.md, and artifacts/author-voice-fingerprint.md",
    "- artifacts/causality-chain.md and artifacts/05-outline.md",
    "- artifacts/revision-tickets.md",
    "- evaluations/persona-review.md and evaluations/outline-stress-test.md when present",
    "- manuscript/chapters/",
    "",
    "Required outputs:",
    "- update evaluations/regression-check.md with verdicts, evidence, and required actions",
    "- mark reopened or newly introduced failures in artifacts/revision-tickets.md",
    "- update artifacts/writer-questions.md for decisions only the writer can make",
    "- update artifacts/quality-gates.md if regression creates a hard stop or approval gate",
    "- update artifacts/writer-cockpit.md and STATUS.md",
    "",
    "Check whether the revision broke: PRD-backed decisions, reader promise, ending/publication shape, continuity, voice/taste lock, causality, chapter-packet carry-forward constraints, resolved tickets, expansion integrity, or useful persona-panel signal.",
    "Do not rewrite the manuscript in this pass unless explicitly asked; diagnose and ticket first.",
  ].join("\n");
}

function renderSeriesRegressionCheck(root) {
  const books = listSeriesBookProjects(root);
  const openRetcons = (readIfExists(join(root, "artifacts", "retcon-log.md"))?.match(/\b(proposed|pending|open)\b/gi) || []).length;
  const verification = readIfExists(join(root, "artifacts", "series-verification-matrix.md")) || "";
  const failedBooks = (verification.match(/\b(fail|failed|blocked)\b/gi) || []).length;
  return [
    "# Series Regression Check",
    "",
    `- Series root: ${root}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Book projects: ${books.length}`,
    `- Open retcon signals: ${openRetcons}`,
    `- Failed / blocked verification signals: ${failedBooks}`,
    "",
    "## Regression dimensions",
    "",
    "| Dimension | Verdict | Evidence | Required action |",
    "| --- | --- | --- | --- |",
    "| Locked canon | pending | pending | verify canon-lock.md and series-bible.md still match the books |",
    "| Timeline / chronology | pending | pending | verify series-timeline.md anchors, elapsed time, ages, and recovery windows |",
    "| Character state continuity | pending | pending | verify character-state-matrix.md still matches relationship, goal, and power-state changes |",
    "| Reveal / spoiler order | pending | pending | verify reveal-spoiler-matrix.md still fits reader and character knowledge timing |",
    "| Promise / payoff integrity | pending | pending | verify installment and series promises remain paid, preserved, or intentionally deferred |",
    "| Retcon safety | pending | pending | verify retcon-log.md is explicit and all downstream fixes were applied |",
    "| Repetition / escalation | pending | pending | verify series-repetition-radar.md shows growth instead of recycled structure |",
    "| Book handoff integrity | pending | pending | verify predecessor book-handoff-packet.md files still hand off cleanly to later books |",
    "",
    "## Reopened cross-book risks",
    "",
    "- pending",
    "",
    "## Gate recommendation",
    "",
    "- pending",
    "",
  ].join("\n");
}

function buildSeriesRegressionCheckPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a series regression check after draft changes, rewrites, book locks, or PRD shifts.",
    "",
    `Series root: ${root}`,
    args.trim() ? `User instructions / revision scope: ${args.trim()}` : "User instructions / revision scope: current cross-book changes since the last checkpoint or ask if unclear",
    "",
    "Read first:",
    "- SERIES_STATE.yaml and SERIES_STATUS.md",
    "- artifacts/series-bible.md",
    "- artifacts/series-arc-map.md",
    "- artifacts/series-timeline.md",
    "- artifacts/character-state-matrix.md",
    "- artifacts/reveal-spoiler-matrix.md",
    "- artifacts/canon-lock.md",
    "- artifacts/installment-promise-tracker.md",
    "- artifacts/series-payoff-ledger.md",
    "- artifacts/series-verification-matrix.md",
    "- artifacts/retcon-log.md",
    "- artifacts/series-repetition-radar.md",
    "- each completed predecessor book's artifacts/book-handoff-packet.md when present",
    "- book PROJECT_STATE.yaml, STATUS.md, revision tickets, and manuscript chapters for touched books",
    "",
    "Required outputs:",
    "- update evaluations/series-regression-check.md with verdicts, evidence, and required actions",
    "- update artifacts/series-verification-matrix.md for any reopened cross-book failures",
    "- update artifacts/series-timeline.md, artifacts/character-state-matrix.md, artifacts/reveal-spoiler-matrix.md, artifacts/retcon-log.md, and artifacts/series-repetition-radar.md when the revision changed cross-book truth",
    "- create or update affected book-level artifacts/revision-tickets.md for concrete repairs",
    "- update SERIES_STATUS.md and touched book STATUS.md files",
    "",
    "Check whether the revision broke locked canon, chronology, character-state continuity, reveal order, promise/payoff integrity, retcon safety, repetition/escalation shape, or predecessor-to-successor handoff logic.",
    "Do not rewrite multiple books in this pass unless explicitly asked; diagnose, synchronize artifacts, and ticket first.",
  ].join("\n");
}

function buildNextPrompt(root, args, commandName = "genesis-next") {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const missing = missingExpectedForPhase(root, phase).slice(0, 12);
  const blockers = blockerSummary(root);
  const nextFile = nextMissingOutput(root, phase);

  return `Use the \`genesis-for-pi\` skill and advance this Genesis for Pi project. The invoking command was \`/${commandName}\`.

Project root: ${root}
Detected current phase: ${phase}
User instructions: ${args.trim() || "none"}
Known blocker files from extension precheck: ${blockers.length ? blockers.join(", ") : "none detected by lightweight precheck"}
First missing expected files through the current phase: ${missing.length ? missing.join(", ") : "none"}
Next expected file by phase-aware precheck: ${nextFile || "none"}

Rules:
1. Load \`PROJECT_STATE.yaml\`, \`ASSUMPTIONS.md\`, and \`references/pipeline/manifest.yaml\` from the skill package before doing anything else.
2. Identify the current phase, the next incomplete required output, and any active blocker that prevents safe advancement.
3. Continue from the current state; do not restart unless state is missing or explicitly invalid.
4. Bypass optional writer approval gates for this turn unless the user explicitly asks for a check-in.
5. Do not bypass hard blockers: active drift-loop hard stops, open blocker/high revision tickets, unresolved name-collision blockers, unresolved AI-tell blockers, unresolved author-voice blockers, unresolved subtext/ear/over-polish blockers, unresolved expansion-integrity blockers, unresolved publication-shape softness, unresolved system-rule/authority-chain/opposition/domain-plausibility blockers, missing required phase outputs, or phase contract mismatches.
6. If blockers exist, clear them first when possible by updating the relevant blocker files, repair artifacts, revision tickets, and manuscript/project files with concrete evidence-based fixes.
7. Once blockers are cleared or none exist, produce only the next required pipeline step's outputs, update \`PROJECT_STATE.yaml\`, and commit each changed file separately.
8. Preserve the Human Voice Rule and the Expansion Integrity Rule.
9. Do not skip Phase 4. Do not run Final Score before Adversarial Audit is complete.

Proceed now.`;
}

function buildScoreToTicketsPrompt(root) {
  return [
    "Use the `genesis-for-pi` skill and convert current scoring/audit findings into actionable revision tickets.",
    "",
    `Project root: ${root}`,
    "",
    "Inspect these files first:",
    "- artifacts/09-genesis-score.md",
    "- artifacts/08-adversarial-audit.md",
    "- artifacts/revision-tickets.md",
    "- evaluations/chapter-scorecards.md",
    "",
    "Required outputs:",
    "- update artifacts/revision-tickets.md with issue, evidence, affected files, severity, repair type, owner phase, and status",
    "- if scoring evidence is weak, note that explicitly instead of inventing certainty",
  ].join("\n");
}

function buildAiThrillerReviewPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a publication-facing developmental review for an AI thriller, system thriller, or near-future governance/automation novel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- docs/ai-thriller-review-prompt.md",
    "- docs/ai-thriller-qa-checklist.md",
    "- manuscript/chapters/",
    "- artifacts/publication-shape.md",
    "- artifacts/system-rule-sheet.md",
    "- artifacts/authority-chain-map.md",
    "- artifacts/opposition-case.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/revision-tickets.md",
    "",
    "Focus the review on:",
    "- middle-act repetition or stall",
    "- repeated scene engine: discovery, plain-language correction, legal/comms call, human-cost message, dashboard update, guilt realization, aphoristic close",
    "- protagonist withholding as a plot engine",
    "- protagonist agency versus reactive auditing/explaining",
    "- external clock and midpoint turn strength",
    "- reveal fatigue / too many hidden layers",
    "- embodied consequence versus screen-based diagnosis",
    "- plain-language reader model versus jargon pileup",
    "- system-rule clarity",
    "- authority-chain plausibility",
    "- governance / organizational clarity",
    "- character voice differentiation",
    "- agency-before-cost for harmed or beneficiary characters",
    "- opposition positive-case strength",
    "- prose over-concentration and repeated verdict lines",
    "- ordinary-life grounding for emotional-anchor characters",
    "- climax technical clarity",
    "- ending shape: standalone vs series, moral resolution vs publication-strength closure",
    "- continuity and domain plausibility risks",
    "",
    "Required outputs:",
    "- write the review to artifacts/ai-thriller-review.md",
    "- create or update artifacts/revision-tickets.md for any concrete high-leverage fixes",
    "- if the review finds publication-shape or authority/system clarity problems, reflect them in the matching artifacts instead of leaving them only in prose",
    "",
    "Use the structure and standards in docs/ai-thriller-review-prompt.md.",
  ].join("\n");
}

function buildAiThrillerFixPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a prioritized repair pass for an AI thriller, system thriller, or near-future governance/automation novel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- artifacts/ai-thriller-review.md",
    "- docs/ai-thriller-review-prompt.md",
    "- docs/ai-thriller-qa-checklist.md",
    "- artifacts/revision-tickets.md",
    "- artifacts/publication-shape.md",
    "- artifacts/system-rule-sheet.md",
    "- artifacts/authority-chain-map.md",
    "- artifacts/opposition-case.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/expansion-integrity.md",
    "- manuscript/chapters/",
    "",
    "Repair priorities:",
    "1. publication shape, external clock, midpoint, and protagonist agency",
    "2. middle-act repetition and withholding-stall",
    "3. reveal consolidation, embodied consequence, and ordinary-life grounding",
    "4. plain-language reader model, system-rule clarity, and authority-chain clarity",
    "5. character voice differentiation and agency-before-cost",
    "6. opposition positive-case and ending publication shape",
    "7. continuity and domain plausibility fixes",
    "",
    "Rules:",
    "- make the highest-leverage fixes first; do not do cosmetic cleanup before structural repair",
    "- update artifacts/revision-tickets.md as tickets are fixed, deferred, or split",
    "- update matching artifacts when a repair changes system rules, authority logic, opposition framing, publication shape, or continuity",
    "- if the fix scope is too large for one pass, complete the most important repair cluster and leave the next cluster as explicit open tickets",
    "- preserve the morally difficult parts that make the book distinct; do not flatten the system into a generic evil AI",
    "",
    "Required outputs:",
    "- repair the manuscript and supporting artifacts where the fixes are clear and high-leverage",
    "- update artifacts/revision-tickets.md with current statuses",
    "- update PROJECT_STATE.yaml and STATUS.md to reflect the repair pass",
  ].join("\n");
}

function buildIngestPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and ingest existing manuscript, notes, research, or canon material into this Genesis project.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Material or instructions: ${args.trim()}` : "Material or instructions: ask the user what file, folder, or manuscript material should be ingested.",
    "",
    "Goals:",
    "- do not restart the project unless the user explicitly asks",
    "- identify source files before drawing conclusions",
    "- populate or update durable artifacts rather than leaving the ingestion only in chat",
    "- preserve uncertainty with evidence notes when source material is incomplete",
    "",
    "Possible outputs depending on source material:",
    "- artifacts/continuity-ledger.md",
    "- artifacts/voice-bible.md",
    "- artifacts/author-voice-fingerprint.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/revision-tickets.md",
    "- artifacts/canon-lock.md for series repair",
    "- PROJECT_STATE.yaml and STATUS.md updates",
  ].join("\n");
}

function buildVoiceIngestPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and ingest author voice samples for this project.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Voice sample paths or instructions: ${args.trim()}` : "Voice sample paths or instructions: ask the user for sample files or pasted samples.",
    "",
    "Required outputs:",
    "- update artifacts/author-voice-fingerprint.md with sentence habits, rhythm, punctuation tolerance, humor, lyricism, emotional restraint, taboo phrasing, obsessions, and productive imperfections",
    "- update artifacts/voice-bible.md with voice rules and anti-voice constraints",
    "- update artifacts/over-polish-audit.md if sample evidence shows productive roughness that must be protected",
    "- update PROJECT_STATE.yaml and STATUS.md if the approval gate or voice state changes",
    "",
    "Do not make the voice cleaner than the samples. Preserve specificity, asymmetry, and controlled awkwardness where present.",
  ].join("\n");
}

function buildVoiceDriftPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a voice-drift audit against the current manuscript.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- artifacts/author-voice-fingerprint.md",
    "- artifacts/voice-bible.md",
    "- artifacts/over-polish-audit.md",
    "- artifacts/ear-pass.md",
    "- manuscript/chapters/",
    "",
    "Audit for:",
    "- generic competence replacing author rhythm",
    "- too-smooth revision polish",
    "- repeated assistant-like sentence shapes",
    "- dialogue that violates the voice bible",
    "- loss of productive imperfection, omission, humor, or restraint",
    "",
    "Required outputs:",
    "- update artifacts/ear-pass.md",
    "- update artifacts/over-polish-audit.md",
    "- create or update artifacts/revision-tickets.md for concrete voice-drift repairs",
  ].join("\n");
}

function buildCommercialProofPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a commercial proof / market-test pass before treating this book as sellable.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: validate the current idea, package, or manuscript against market evidence.",
    "",
    "Create or update these artifacts with source/date-driven evidence:",
    "- artifacts/commercial-proof.md",
    "- artifacts/category-competition-map.md",
    "- artifacts/title-subtitle-options.md",
    "- artifacts/blurb-test-results.md",
    "- artifacts/cover-conversion-notes.md",
    "- artifacts/sample-reader-feedback.md",
    "- artifacts/launch-channel-plan.md",
    "- artifacts/review-risk-log.md",
    "- artifacts/publishing-metadata-checklist.md",
    "",
    "Minimum gates:",
    "- target reader named in one sentence",
    "- 10-20 comparable books or shelf neighbors mapped with source URL/searched phrase and as-of date",
    "- why this / why now / why this author answer",
    "- recurring review complaints identified and at least one manuscript/package response proposed",
    "- at least 3 title/subtitle or blurb alternatives compared",
    "- outside-reader sample signal recorded if available; otherwise mark status as needs_validation, not proven",
    "",
    "Do not fake validation. If evidence is missing, leave a blocker or needs_validation status and create concrete next validation actions.",
  ].join("\n");
}

export default function (pi) {
  pi.registerTool({
    name: "genesis_blocker_triage",
    label: "Genesis Blocker Triage",
    description: "Inspect a Genesis for Pi project for blocker files, evidence snippets, and suggested repair actions.",
    promptSnippet: "Inspect Genesis blocker files and missing required outputs with evidence snippets.",
    promptGuidelines: ["Use genesis_blocker_triage before or during Genesis advancement when you need a fast blocker summary with evidence and suggested actions."],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String({ description: "Optional project root. Defaults to current working directory." })),
      include_missing: Type.Optional(Type.Boolean({ description: "Include missing required outputs in the report for the current phase." })),
      focus_file: Type.Optional(Type.String({ description: "Optional blocker file to isolate in the response." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = findProjectRoot(params.project_root || ctx.cwd);
      const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
      let blockers = collectBlockers(root, params.include_missing ?? true);
      if (params.focus_file) blockers = blockers.filter((blocker) => blocker.file === params.focus_file);
      const text = blockers.length
        ? [`Genesis root: ${root}`, `Current phase: ${phase}`, "", ...blockers.map((blocker, index) => `${index + 1}. ${blocker.label} (${blocker.file})\nEvidence: ${blocker.evidence}\nSuggested action: ${blocker.suggestion}`)].join("\n")
        : `Genesis root: ${root}\nCurrent phase: ${phase}\n\nNo blockers detected by Genesis triage.`;
      return { content: [{ type: "text", text }], details: { root, phase, blockers } };
    },
  });

  const registerStatusCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderStatusDashboard(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerPlanCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderPlan(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerResumeCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderResume(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerValidateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const report = renderValidationReport(root);
    ctx.ui.notify(`${report}\nSTATUS.md updated.`, /mismatch|blockers|lint findings: [1-9]/i.test(report) ? "warning" : "info");
  } });

  const registerDoctorCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderDoctorReport(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerLintCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ctx.ui.notify(renderLintReport(root), /Findings: 0/.test(renderLintReport(root)) ? "info" : "warning");
  } });

  const registerDashboardCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const dashboard = renderDashboard(root);
    writeFileSync(join(root, "STATUS.md"), dashboard, "utf8");
    ctx.ui.notify(`${dashboard}\nSTATUS.md updated.`, "info");
  } });

  const registerCompileCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = compileManuscript(root);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Compiled manuscript.\n- delivery/manuscript-full.md\n- delivery/manuscript-compile-report.md\nChapters: ${result.chapters}\nWords: ${result.words}\nSTATUS.md updated.`, result.chapters ? "info" : "warning");
  } });

  const registerExportCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = createEditorialExport(root);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Created Genesis delivery package files:\n${result.files.map((file) => `- ${file}`).join("\n")}\nChapters: ${result.chapters}\nWords: ${result.words}\nSTATUS.md updated.`, "info");
  } });

  const registerCommercialProofCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    const results = MARKET_TEST_ARTIFACTS.map((destination) => {
      const item = findTemplateEntryByDestination(destination);
      return item ? { destination, status: scaffoldTemplate(root, item.template, item.destination, false) } : { destination, status: "missing_template" };
    });
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildCommercialProofPrompt(root, args);
    const notice = `Commercial proof artifacts prepared:\n${results.map((item) => `- ${item.destination}: ${item.status}`).join("\n")}\nSTATUS.md updated.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`${notice}\nQueued /${name} as a follow-up.`, "info");
      return;
    }
    ctx.ui.notify(notice, "info");
    pi.sendUserMessage(message);
  } });

  const registerCheckpointCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = checkpointGenesisFiles(root, args);
    const lines = result.results.length ? result.results.map((item) => `- ${item.file}: ${item.status}${item.status === "committed" ? ` (${item.message})` : ` — ${item.message}`}`) : ["- no changed Genesis files matched the checkpoint request"];
    ctx.ui.notify(`Genesis checkpoint\nProject: ${root}\nChanged Genesis files: ${result.changed}\nAttempted commits: ${result.attempted}\n${lines.join("\n")}`, result.results.some((item) => item.status === "failed") ? "warning" : "info");
  } });

  const queuePromptCommand = (name, description, buildPrompt) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSetModeCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const requested = args.trim().toLowerCase();
    const mode = WORKFLOW_MODES.includes(requested) ? requested : await ctx.ui.select("Choose a workflow mode:", [...WORKFLOW_MODES]);
    if (!mode) return;
    applyWorkflowModeToProject(root, mode);
    const bundleEntries = getModeBundleEntries(mode);
    let bundleResults = [];
    if (bundleEntries.length) {
      const shouldScaffold = await ctx.ui.confirm("Scaffold recommended mode bundle?", `Create starter files for ${mode}?\n\n${bundleEntries.map((item) => `- ${item.destination}`).join("\n")}`);
      if (shouldScaffold) bundleResults = scaffoldModeBundle(root, mode, false);
    }
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Workflow mode set to ${mode}. STATUS.md updated.${bundleResults.length ? `\nMode bundle:\n${bundleResults.map((item) => `- ${item.destination}: ${item.status}`).join("\n")}` : ""}`, "info");
  } });

  const registerNextCommand = (name, description) => pi.registerCommand(name, { description, getArgumentCompletions: (prefix) => {
    const items = ["main checkpoints only", "careful mode", "fast mode", "do not draft prose yet", "continue without optional approval gates", "clear blockers first"].map((value) => ({ value, label: value }));
    const filtered = items.filter((item) => item.value.startsWith(prefix));
    return filtered.length ? filtered : null;
  }, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    if (!ctx.isIdle()) {
      ctx.ui.notify(`Agent is busy. Queueing /${name} as a follow-up.`, "info");
      pi.sendUserMessage(buildNextPrompt(root, args, name), { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(buildNextPrompt(root, args, name));
  } });

  const registerTemplateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const labels = TEMPLATE_SCAFFOLDS.map((item) => item.label);
    const selected = await ctx.ui.multiSelect?.("Choose templates to scaffold:", labels);
    const chosen = selected?.length ? selected : [await ctx.ui.select("Choose a template to scaffold:", labels)].filter(Boolean);
    if (!chosen.length) return;
    const overwrite = await ctx.ui.confirm("Overwrite existing files?", "If yes, existing artifact files for the selected templates will be replaced.");
    const results = chosen.map((label) => {
      const item = TEMPLATE_SCAFFOLDS.find((entry) => entry.label === label);
      return `${label}: ${scaffoldTemplate(root, item.template, item.destination, overwrite)}`;
    });
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Scaffolded templates in ${root}\n${results.join("\n")}`, "info");
  } });

  const registerFluffAuditCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = [
      "Use the `genesis-for-pi` skill and run a focused fluff audit.",
      "",
      `Project root: ${root}`,
      "",
      "Audit for padding, ornamental subplots, duplicate beats, atmospheric drift, repeated introspection, duplicate exposition, low-stakes banter, and no-state-change scenes.",
      "Update artifacts/expansion-integrity.md, artifacts/revision-tickets.md, and artifacts/drift-loop-alarm.md as needed.",
    ].join("\n");
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerScoreToTicketsCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildScoreToTicketsPrompt(root);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerAiThrillerReviewCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildAiThrillerReviewPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerAiThrillerFixCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildAiThrillerFixPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerBlockerCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const blockers = collectBlockers(root, true);
    if (!blockers.length) {
      ctx.ui.notify("No Genesis blockers detected.", "info");
      return;
    }
    const options = blockers.map((blocker) => `${blocker.label} — ${blocker.file}`);
    const selected = await ctx.ui.select("Choose a Genesis blocker to inspect:", options);
    if (!selected) return;
    const blocker = blockers[options.indexOf(selected)];
    if (!blocker) return;
    ctx.ui.notify([`${blocker.label}`, `file: ${blocker.file}`, `evidence: ${blocker.evidence}`, `suggested action: ${blocker.suggestion}`].join("\n"), blocker.severity === "blocker" ? "warning" : "info");
    const shouldQueueFix = await ctx.ui.confirm("Queue Genesis fix?", `Ask Genesis to clear this blocker now?\n\n${blocker.file}`);
    if (!shouldQueueFix) return;
    const message = `${buildNextPrompt(root, `Focus first on blocker file ${blocker.file}. Evidence: ${blocker.evidence}. Suggested action: ${blocker.suggestion}.`, name)}\n\nStart by clearing ${blocker.file}.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued blocker-fix follow-up for ${blocker.file}.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerInitCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const typedName = args.trim() || (await ctx.ui.input("Genesis project name:", "my-book"));
    if (!typedName) return;
    const projectRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(projectRoot) && existsSync(join(projectRoot, "PROJECT_STATE.yaml"))) {
      ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
      return;
    }
    const idea = (await ctx.ui.editor("Seed idea:", "Describe the book idea, tone, genre pressure, reader promise, and anything that must not be smoothed away.")) || "";
    initializeProject(projectRoot, typedName, idea);
    let gitInitialized = false;
    try { gitInitialized = maybeInitGit(projectRoot); } catch { ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning"); }
    writeFileSync(join(projectRoot, "STATUS.md"), renderStatusDashboard(projectRoot), "utf8");
    ctx.ui.notify(`Initialized Genesis project at ${projectRoot}${gitInitialized ? "\nGit repository initialized." : ""}`, "info");
    const shouldStart = await ctx.ui.confirm("Start intake now?", "Queue Genesis to begin Phase 0 intake in the new project?");
    if (!shouldStart) return;
    const kickoff = `${buildNextPrompt(projectRoot, `Project root: ${projectRoot}. Start with Phase 0 intake using this seed idea: ${idea || "No idea captured yet."}`, name)}\n\nThe project tree already exists. Fill in the Phase 0 outputs now.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });

  const registerStartCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const typedName = args.trim() || (await ctx.ui.input("Genesis project name:", "my-book"));
    if (!typedName) return;
    const projectRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(projectRoot) && existsSync(join(projectRoot, "PROJECT_STATE.yaml"))) {
      ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
      return;
    }
    const idea = (await ctx.ui.editor("Seed idea:", "Describe the book idea, tone, genre pressure, reader promise, and anything that must not be smoothed away.")) || "";
    const mode = await ctx.ui.select("Choose a workflow mode:", [...WORKFLOW_MODES]);
    if (!mode) return;
    initializeProject(projectRoot, typedName, idea);
    try { maybeInitGit(projectRoot); } catch { ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning"); }
    applyWorkflowModeToProject(projectRoot, mode);
    const bundleResults = scaffoldModeBundle(projectRoot, mode, false);
    writeFileSync(join(projectRoot, "STATUS.md"), renderStatusDashboard(projectRoot), "utf8");
    ctx.ui.notify(`Initialized Genesis project at ${projectRoot}\nWorkflow mode: ${mode}${bundleResults.length ? `\nMode bundle:\n${bundleResults.map((item) => `- ${item.destination}: ${item.status}`).join("\n")}` : ""}`, "info");
    const kickoff = `${buildNextPrompt(projectRoot, `Project root: ${projectRoot}. Workflow mode: ${mode}. Start with Phase 0 intake using this seed idea: ${idea || "No idea captured yet."}`, name)}\n\nThe project tree already exists. Fill in the Phase 0 outputs now.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });


  const registerWriterCockpitCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "artifacts", "chapter-production-queue.md"), existsSync(join(root, "artifacts", "chapter-production-queue.md")) ? (readIfExists(join(root, "artifacts", "chapter-production-queue.md")) || renderChapterProductionQueue(root)) : renderChapterProductionQueue(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderWriterCockpit(root)}\nartifacts/writer-cockpit.md and STATUS.md updated.`, "info");
  } });

  const registerPrdStartCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const sourceInput = args.trim() || (await ctx.ui.input("PRD file or folder:", "book-prd.md"));
    if (!sourceInput) return;
    const sourcePath = resolve(ctx.cwd, sourceInput);
    if (!existsSync(sourcePath)) {
      ctx.ui.notify(`PRD source not found: ${sourcePath}`, "warning");
      return;
    }
    const prd = readPrdSource(sourcePath);
    if (!prd.text.trim()) {
      ctx.ui.notify(`No Markdown/text PRD content found in ${sourcePath}`, "warning");
      return;
    }
    const inferredName = extractTitleFromText(prd.firstText || prd.text, basename(sourcePath, ".md"));
    const typedName = (await ctx.ui.input("Genesis project name:", inferredName)) || inferredName;
    const projectRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(projectRoot) && existsSync(join(projectRoot, "PROJECT_STATE.yaml"))) {
      ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
      return;
    }
    const mode = inferWorkflowModeFromPrd(prd.text);
    const analysis = analyzePrdCompleteness(prd.text);
    initializeProject(projectRoot, typedName, `Imported from PRD source: ${sourcePath}`);
    try { maybeInitGit(projectRoot); } catch { ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning"); }
    applyWorkflowModeToProject(projectRoot, mode);
    scaffoldModeBundle(projectRoot, mode, false);
    const publicationShape = findTemplateEntryByDestination("artifacts/publication-shape.md");
    if (publicationShape) scaffoldTemplate(projectRoot, publicationShape.template, publicationShape.destination, false);
    ensureDir(join(projectRoot, "research", "notes"));
    writeFileSync(join(projectRoot, "artifacts", "book-prd.md"), prd.text + "\n", "utf8");
    writeFileSync(join(projectRoot, "research", "notes", "source-prd.md"), prd.text + "\n", "utf8");
    writeFileSync(join(projectRoot, "research", "notes", "source-prd-manifest.md"), [
      "# Source PRD Manifest",
      "",
      `- Imported from: ${sourcePath}`,
      `- Files: ${prd.files.length}`,
      `- Inferred workflow mode: ${mode}`,
      `- PRD completeness score: ${analysis.score}/100`,
      "",
      ...prd.files.map((file) => `- ${file}`),
      "",
    ].join("\n"), "utf8");
    createPrdAutomationArtifacts(projectRoot, sourcePath, analysis);
    writeFileSync(join(projectRoot, "STATUS.md"), renderStatusDashboard(projectRoot), "utf8");
    ctx.ui.notify(`Initialized PRD-first Genesis project at ${projectRoot}\nWorkflow mode: ${mode}\nPRD completeness: ${analysis.score}/100\nGap questions: ${analysis.missing.length + analysis.weak.length}\nWriter cockpit: artifacts/writer-cockpit.md`, analysis.score >= 80 ? "info" : "warning");
    const shouldQueue = await ctx.ui.confirm("Run PRD import agent pass now?", "Genesis will map PRD-supported claims into artifacts, update traceability, and ask only gap questions. It will not draft prose.");
    if (!shouldQueue) return;
    const message = buildPrdExtractionPrompt(projectRoot, sourcePath, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerPrdIngestCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const sourceInput = args.trim() || (await ctx.ui.input("PRD file or folder to ingest:", "book-prd.md"));
    if (!sourceInput) return;
    const sourcePath = resolve(ctx.cwd, sourceInput);
    if (!existsSync(sourcePath)) {
      ctx.ui.notify(`PRD source not found: ${sourcePath}`, "warning");
      return;
    }
    const prd = readPrdSource(sourcePath);
    if (!prd.text.trim()) {
      ctx.ui.notify(`No Markdown/text PRD content found in ${sourcePath}`, "warning");
      return;
    }
    const analysis = analyzePrdCompleteness(prd.text);
    ensureDir(join(root, "artifacts"));
    ensureDir(join(root, "research", "notes"));
    writeFileSync(join(root, "artifacts", "book-prd.md"), prd.text + "\n", "utf8");
    writeFileSync(join(root, "research", "notes", "source-prd.md"), prd.text + "\n", "utf8");
    writeFileSync(join(root, "research", "notes", "source-prd-manifest.md"), [
      "# Source PRD Manifest",
      "",
      `- Imported from: ${sourcePath}`,
      `- Files: ${prd.files.length}`,
      `- PRD completeness score: ${analysis.score}/100`,
      "",
      ...prd.files.map((file) => `- ${file}`),
      "",
    ].join("\n"), "utf8");
    createPrdAutomationArtifacts(root, sourcePath, analysis);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildPrdExtractionPrompt(root, sourcePath, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`PRD ingested and import pass queued. Score: ${analysis.score}/100`, analysis.score >= 80 ? "info" : "warning");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerAutopilotCommand = (name, description) => pi.registerCommand(name, { description, getArgumentCompletions: (prefix) => {
    const items = ["foundation", "architecture", "chapter-queue", "one chapter packet", "one chapter draft", "post-chapter-update", "status only"].map((value) => ({ value, label: value }));
    const filtered = items.filter((item) => item.value.startsWith(prefix));
    return filtered.length ? filtered : null;
  }, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const gate = canRunAutopilot(root);
    if (!gate.ok) {
      ctx.ui.notify(`Autopilot blocked by ${gate.hard.length} hard gate(s):\n${gate.hard.slice(0, 6).map((item) => `- ${item.file}: ${item.label}`).join("\n")}\n\nUpdated artifacts/writer-cockpit.md and STATUS.md.`, "warning");
      return;
    }
    const message = buildAutopilotPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerChapterQueueCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "artifacts", "chapter-production-queue.md"), renderChapterProductionQueue(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildChapterQueuePrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created lightweight chapter queue and queued agent refinement.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerPostChapterUpdateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildPostChapterUpdatePrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerTasteLockCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    if (!existsSync(join(root, "artifacts", "taste-lock.md"))) writeFileSync(join(root, "artifacts", "taste-lock.md"), renderTasteLock(), "utf8");
    if (!existsSync(join(root, "artifacts", "decision-ledger.md"))) writeFileSync(join(root, "artifacts", "decision-ledger.md"), renderDecisionLedger(), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    const message = buildTasteLockPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });


  const registerPrdDiffCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const sourceInput = args.trim() || (await ctx.ui.input("Candidate PRD file or folder:", "book-prd.md"));
    if (!sourceInput) return;
    const sourcePath = resolve(ctx.cwd, sourceInput);
    if (!existsSync(sourcePath)) {
      ctx.ui.notify(`Candidate PRD source not found: ${sourcePath}`, "warning");
      return;
    }
    const candidate = readPrdSource(sourcePath);
    if (!candidate.text.trim()) {
      ctx.ui.notify(`No Markdown/text PRD content found in ${sourcePath}`, "warning");
      return;
    }
    ensureDir(join(root, "artifacts"));
    ensureDir(join(root, "research", "notes"));
    const current = readIfExists(join(root, "artifacts", "book-prd.md")) || readIfExists(join(root, "research", "notes", "source-prd.md")) || "";
    writeFileSync(join(root, "research", "notes", "source-prd-candidate.md"), candidate.text + "\n", "utf8");
    writeFileSync(join(root, "artifacts", "prd-change-log.md"), renderPrdChangeLog(root, sourcePath, current, candidate.text), "utf8");
    writeFileSync(join(root, "artifacts", "decision-impact-report.md"), renderDecisionImpactReport(root, sourcePath), "utf8");
    writeFileSync(join(root, "artifacts", "writer-questions.md"), renderWriterQuestions(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildPrdDiffPrompt(root, sourcePath, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created PRD diff scaffolds and queued impact review.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerQuestionsCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "artifacts", "writer-questions.md"), renderWriterQuestions(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildQuestionsPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created lightweight writer questions and queued refinement.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerOutlineStressTestCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "evaluations"));
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "evaluations", "outline-stress-test.md"), renderOutlineStressTest(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-questions.md"), renderWriterQuestions(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildOutlineStressTestPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created outline stress-test scaffold and queued review.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerReviewPersonasCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "artifacts"));
    const template = findTemplateEntryByDestination("artifacts/review-personas.md");
    if (template && !existsSync(join(root, "artifacts", "review-personas.md"))) scaffoldTemplate(root, template.template, template.destination, false);
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildReviewPersonasPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued review-persona generation.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerPersonaReviewCommand = (name, description) => pi.registerCommand(name, { description, getArgumentCompletions: (prefix) => {
    const items = ["outline", "chapter-01", "latest chapter", "manuscript", "opening", "ending"].map((value) => ({ value, label: value }));
    const filtered = items.filter((item) => item.value.startsWith(prefix));
    return filtered.length ? filtered : null;
  }, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "evaluations"));
    ensureDir(join(root, "artifacts"));
    if (!existsSync(join(root, "evaluations", "persona-review.md"))) {
      const template = findTemplateEntryByDestination("evaluations/persona-review.md");
      if (template) scaffoldTemplate(root, template.template, template.destination, false);
    }
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildPersonaReviewPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued persona-based review.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });


  const registerRegressionCheckCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ensureDir(join(root, "evaluations"));
    ensureDir(join(root, "artifacts"));
    writeFileSync(join(root, "evaluations", "regression-check.md"), renderRegressionCheck(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-questions.md"), renderWriterQuestions(root), "utf8");
    writeFileSync(join(root, "artifacts", "writer-cockpit.md"), renderWriterCockpit(root), "utf8");
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const message = buildRegressionCheckPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created regression-check scaffold and queued analysis.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerMigrateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = migrateProject(root);
    ctx.ui.notify(`Migrated Genesis project at ${result.root}\nPhase: ${result.phase}\nWorkflow mode: ${result.mode}\nRemaining missing files: ${result.missing.length}`, result.missing.length ? "warning" : "info");
  } });

  const registerSeriesStartCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const typedName = args.trim() || (await ctx.ui.input("Series name:", "my-series"));
    if (!typedName) return;
    const seriesRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(seriesRoot) && existsSync(join(seriesRoot, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`Genesis series already exists: ${seriesRoot}`, "warning");
      return;
    }
    const plannedRaw = await ctx.ui.input("How many books should Genesis scaffold?", "3");
    const plannedBooks = Math.max(1, Math.min(20, Number.parseInt(plannedRaw, 10) || 3));
    const premise = (await ctx.ui.editor("Series premise:", "Describe the whole-series premise, genre pressure, recurring promise, planned endpoint, and anything that must not drift across books.")) || "";
    const result = initializeSeriesWorkspace(seriesRoot, typedName, premise, plannedBooks);
    try { maybeInitGit(seriesRoot); } catch { ctx.ui.notify("Series workspace created, but git init failed. Initialize git manually if needed.", "warning"); }
    writeFileSync(join(seriesRoot, "SERIES_STATUS.md"), renderSeriesStatus(seriesRoot), "utf8");
    ctx.ui.notify(`Initialized Genesis series at ${seriesRoot}\nBooks scaffolded: ${result.bookRoots.length}\nSERIES_STATUS.md updated.`, "info");
    const shouldStart = await ctx.ui.confirm("Start series planning now?", "Queue Genesis to fill the series bible, arc map, and book ladder before drafting?");
    if (!shouldStart) return;
    const message = buildSeriesNextPrompt(seriesRoot, `Start whole-series planning from this premise: ${premise || "No premise captured yet."}`);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesStatusCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const status = renderSeriesStatus(root);
    writeFileSync(join(root, "SERIES_STATUS.md"), status, "utf8");
    ctx.ui.notify(`${status}\nSERIES_STATUS.md updated.`, "info");
  } });

  const registerSeriesOpenCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const workspaces = findSeriesWorkspaces(ctx.cwd, 4);
    if (!workspaces.length) {
      ctx.ui.notify("No Genesis series workspaces found under the current working directory.", "warning");
      return;
    }
    const selectedSeries = await ctx.ui.select("Choose a Genesis series workspace:", workspaces);
    if (!selectedSeries) return;
    const action = await ctx.ui.select("What should Genesis do with this series?", ["Show status", "Advance next step", "Verify series", "Run series regression check", "Inspect blockers", "Export series package"]);
    if (!action) return;
    if (action === "Show status") {
      const status = renderSeriesStatus(selectedSeries);
      writeFileSync(join(selectedSeries, "SERIES_STATUS.md"), status, "utf8");
      ctx.ui.notify(`${status}\nSERIES_STATUS.md updated.`, "info");
      return;
    }
    if (action === "Inspect blockers") {
      writeFileSync(join(selectedSeries, "SERIES_STATUS.md"), renderSeriesStatus(selectedSeries), "utf8");
      ctx.ui.notify(`Genesis series: ${selectedSeries}\n\n${renderSeriesBlockers(selectedSeries)}`, "info");
      return;
    }
    if (action === "Export series package") {
      const result = createSeriesExport(selectedSeries);
      ctx.ui.notify(`Created Genesis series export for ${selectedSeries}.\nBooks: ${result.books}\n${result.files.map((file) => `- ${file}`).join("\n")}`, result.books ? "info" : "warning");
      return;
    }
    if (action === "Run series regression check") {
      ensureDir(join(selectedSeries, "evaluations"));
      writeFileSync(join(selectedSeries, "evaluations", "series-regression-check.md"), renderSeriesRegressionCheck(selectedSeries), "utf8");
      writeFileSync(join(selectedSeries, "SERIES_STATUS.md"), renderSeriesStatus(selectedSeries), "utf8");
      const message = buildSeriesRegressionCheckPrompt(selectedSeries, `Series root: ${selectedSeries}. Run a regression check for this selected series workspace.`);
      if (!ctx.isIdle()) {
        pi.sendUserMessage(message, { deliverAs: "followUp" });
        ctx.ui.notify(`Queued /${name} run series regression check as a follow-up.`, "info");
        return;
      }
      pi.sendUserMessage(message);
      return;
    }
    const message = action === "Verify series"
      ? buildSeriesVerifyPrompt(selectedSeries, `Series root: ${selectedSeries}. Verify this selected series workspace.`)
      : buildSeriesNextPrompt(selectedSeries, `Series root: ${selectedSeries}. Continue this selected series workspace from its current state.`);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} ${action.toLowerCase()} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesNextCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const message = buildSeriesNextPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesVerifyCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const message = buildSeriesVerifyPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesRegressionCheckCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    ensureDir(join(root, "evaluations"));
    writeFileSync(join(root, "evaluations", "series-regression-check.md"), renderSeriesRegressionCheck(root), "utf8");
    writeFileSync(join(root, "SERIES_STATUS.md"), renderSeriesStatus(root), "utf8");
    const message = buildSeriesRegressionCheckPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Created series-regression-check scaffold and queued analysis.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesAddBookCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const premise = args.trim() || (await ctx.ui.editor("New book setup:", "Describe this installment's role, inherited promises, ending state, and any new pressure it adds.")) || "";
    const result = addSeriesBookToWorkspace(root, premise);
    ctx.ui.notify(`Added ${result.bookRoot.startsWith(root) ? result.bookRoot.slice(root.length + 1) : result.bookRoot}\nPlanned books: ${result.plannedBooks}\nSERIES_STATUS.md updated.`, "info");
  } });

  const registerSeriesBlockersCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const report = renderSeriesBlockers(root);
    writeFileSync(join(root, "SERIES_STATUS.md"), renderSeriesStatus(root), "utf8");
    ctx.ui.notify(report, /\[blocker\]/i.test(report) ? "warning" : "info");
  } });

  const registerSeriesScoreCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const message = buildSeriesScorePrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSeriesExportCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const result = createSeriesExport(root);
    ctx.ui.notify(`Created Genesis series export.\nBooks: ${result.books}\n${result.files.map((file) => `- ${file}`).join("\n")}`, result.books ? "info" : "warning");
  } });

  const registerSeriesLockBookCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findSeriesRoot(ctx.cwd);
    if (!existsSync(join(root, "SERIES_STATE.yaml"))) {
      ctx.ui.notify(`No Genesis series workspace found from ${ctx.cwd}. Run /genesis-series-start first.`, "warning");
      return;
    }
    const books = listSeriesBookProjects(root);
    if (!books.length) {
      ctx.ui.notify("No book projects found under this series workspace.", "warning");
      return;
    }
    const requested = args.trim();
    let bookRoot = requested ? books.find((book) => book.includes(requested) || basename(book) === requested) : null;
    if (!bookRoot) {
      const labels = books.map((book) => book.startsWith(root) ? book.slice(root.length + 1) : book);
      const selected = await ctx.ui.select("Choose book to lock into series canon:", labels);
      if (!selected) return;
      bookRoot = join(root, selected);
    }
    const message = buildSeriesLockBookPrompt(root, bookRoot, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerOpenCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const projects = findGenesisProjects(ctx.cwd, 3);
    if (!projects.length) {
      ctx.ui.notify("No Genesis projects found under the current working directory.", "warning");
      return;
    }
    const selectedProject = await ctx.ui.select("Choose a Genesis project:", projects);
    if (!selectedProject) return;
    const action = await ctx.ui.select("What should Genesis do with this project?", ["Show dashboard", "Show status", "Show plan", "Show resume", "Run doctor", "Inspect blockers", "Compile manuscript", "Export delivery package", "Migrate project", "Advance next step"]);
    if (!action) return;
    if (action === "Show dashboard") {
      const dashboard = renderDashboard(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), dashboard, "utf8");
      ctx.ui.notify(`${dashboard}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show status") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderStatusDashboard(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show plan") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderPlan(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show resume") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderResume(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Run doctor") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderDoctorReport(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Inspect blockers") {
      ctx.ui.notify(`Genesis root: ${selectedProject}\n\n${renderBlockers(selectedProject, true)}`, "info");
      return;
    }
    if (action === "Compile manuscript") {
      const result = compileManuscript(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`Compiled delivery/manuscript-full.md (${result.chapters} chapter file(s), ${result.words} words).`, result.chapters ? "info" : "warning");
      return;
    }
    if (action === "Export delivery package") {
      const result = createEditorialExport(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`Exported delivery package files:\n${result.files.map((file) => `- ${file}`).join("\n")}`, "info");
      return;
    }
    if (action === "Migrate project") {
      const result = migrateProject(selectedProject);
      ctx.ui.notify(`Migrated Genesis project at ${result.root}\nRemaining missing files: ${result.missing.length}`, result.missing.length ? "warning" : "info");
      return;
    }
    const kickoff = `${buildNextPrompt(selectedProject, `Project root: ${selectedProject}. Continue this project from its current state.`, name)}\n\nUse ${selectedProject} as the active project root.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });

  registerStatusCommand("genesis-status", "Show Genesis for Pi project status from PROJECT_STATE and artifact files");
  registerPlanCommand("genesis-plan", "Show a dry-run summary of what Genesis would do next");
  registerResumeCommand("genesis-resume", "Summarize where a Genesis project left off and what should happen next");
  registerDoctorCommand("genesis-doctor", "Check install health, project health, blockers, and lint findings");
  registerLintCommand("genesis-lint", "Lint Genesis artifacts for placeholders, empty sections, and weak scaffolds");
  registerDashboardCommand("genesis-dashboard", "Show a richer Genesis project dashboard and write it to STATUS.md");
  registerCompileCommand("genesis-compile", "Compile manuscript chapters into delivery/manuscript-full.md");
  registerExportCommand("genesis-export", "Create editorial handoff, beta packet, revision board, commercial/compliance packs, and export manifest files");
  registerCommercialProofCommand("genesis-market-test", "Scaffold and run commercial proof, category competition, title/blurb/cover, launch, and metadata validation");
  registerCommercialProofCommand("genesis-commercial-proof", "Scaffold and run commercial proof, category competition, title/blurb/cover, launch, and metadata validation");
  registerCheckpointCommand("genesis-checkpoint", "Commit changed Genesis project files one file at a time");
  registerPrdStartCommand("genesis-prd-start", "Bootstrap a PRD-first Genesis project, score PRD completeness, and queue gap-only intake");
  registerPrdIngestCommand("genesis-prd-ingest", "Ingest a PRD into the current Genesis project with traceability and gap reporting");
  registerWriterCockpitCommand("genesis-cockpit", "Write a one-page writer cockpit with gates, blockers, decisions, and next actions");
  registerAutopilotCommand("genesis-autopilot", "Run a bounded, writer-gated autopilot step without bypassing quality gates");
  registerChapterQueueCommand("genesis-chapter-queue", "Build draftable chapter packets from the approved outline and project constraints");
  registerPostChapterUpdateCommand("genesis-post-chapter-update", "Update continuity, promises, scorecards, and queue status after chapter drafting");
  registerTasteLockCommand("genesis-taste-lock", "Protect author taste, risk, voice, and automation boundaries in durable artifacts");
  registerPrdDiffCommand("genesis-prd-diff", "Compare a candidate PRD against the accepted PRD and report decision impact");
  registerQuestionsCommand("genesis-questions", "Generate only the writer decisions needed for safe next automation");
  registerOutlineStressTestCommand("genesis-outline-stress-test", "Stress-test outline architecture before drafting");
  registerReviewPersonasCommand("genesis-review-personas", "Generate or refresh the reader/reviewer persona panel");
  registerPersonaReviewCommand("genesis-persona-review", "Run an outline/chapter/manuscript review through the persona panel");
  registerRegressionCheckCommand("genesis-regression-check", "Check whether revisions broke approved promises, continuity, voice, gates, or tickets");
  queuePromptCommand("genesis-ingest", "Ingest an existing manuscript, notes folder, research, or canon material into Genesis artifacts", buildIngestPrompt);
  queuePromptCommand("genesis-voice-ingest", "Ingest author voice samples into the voice fingerprint and voice bible", buildVoiceIngestPrompt);
  queuePromptCommand("genesis-voice-drift", "Audit manuscript chapters against the author voice fingerprint and voice bible", buildVoiceDriftPrompt);
  registerInitCommand("genesis-init", "Create a fresh Genesis for Pi project tree and optionally start intake");
  registerStartCommand("genesis-start", "Bootstrap a new Genesis project with mode selection, scaffolds, and intake kickoff");
  registerSeriesStartCommand("genesis-series-start", "Bootstrap a whole-series workspace with shared series artifacts and per-book projects");
  registerSeriesOpenCommand("genesis-series-open", "Pick an existing series workspace, then inspect or continue it");
  registerSeriesStatusCommand("genesis-series-status", "Show whole-series status across shared artifacts and book projects");
  registerSeriesNextCommand("genesis-series-next", "Advance the next safest series-level or book-level step");
  registerSeriesAddBookCommand("genesis-series-add-book", "Add another installment project to an existing series workspace");
  registerSeriesBlockersCommand("genesis-series-blockers", "Inspect series-level and cross-book blockers");
  registerSeriesVerifyCommand("genesis-series-verify", "Run cross-book canon, continuity, escalation, and promise verification");
  registerSeriesRegressionCheckCommand("genesis-series-regression-check", "Check whether cross-book revisions broke canon, timeline, reveal order, handoffs, or escalation");
  registerSeriesScoreCommand("genesis-series-score", "Score whole-series canon, escalation, payoff, repetition, and cohesion");
  registerSeriesExportCommand("genesis-series-export", "Create whole-series delivery and editorial handoff files");
  registerSeriesLockBookCommand("genesis-series-lock-book", "Extract one completed installment into locked series canon");
  registerOpenCommand("genesis-open", "Pick an existing Genesis project, then inspect or continue it");
  registerNextCommand("genesis-next", "Clear blockers when possible, then advance Genesis for Pi to the next incomplete pipeline step");
  registerValidateCommand("genesis-validate", "Validate the current Genesis phase contract, missing outputs, and blocker state");
  registerMigrateCommand("genesis-migrate", "Repair or upgrade an older Genesis project tree to the current layout");
  registerSetModeCommand("genesis-set-mode", "Set the active Genesis workflow mode and update project files");
  registerBlockerCommand("genesis-blockers", "Interactively inspect Genesis blockers and optionally queue a blocker-fix turn");
  registerTemplateCommand("genesis-scaffold-templates", "Scaffold core Genesis artifact templates into the current project");
  registerScoreToTicketsCommand("genesis-score-to-tickets", "Convert Genesis score and audit findings into revision tickets");
  registerAiThrillerReviewCommand("genesis-ai-thriller-review", "Run a publication-facing developmental review for an AI thriller or system-driven novel");
  registerAiThrillerFixCommand("genesis-ai-thriller-fix", "Run a prioritized repair pass for an AI thriller or system-driven novel");
  registerFluffAuditCommand("genesis-audit-fluff", "Run a focused anti-padding audit for fluff, filler scenes, and ornamental subplots");
}
