import { NOVEL_FORGE_VERSION } from "../application/version-core.js";
import { defaultHistoricalContext, defaultInventionLedger } from "../domain/historical-fiction.js";
import type { ModelExecutionProfileId } from "../domain/model-execution-profile.js";
import { defaultQualityProjectState, type QualityProjectState } from "../domain/quality-profile.js";
import type { RuntimeProfileId } from "../domain/runtime-profile.js";
import type { ProfileId, ProjectType, BookState } from "../domain/schemas.js";
import { defaultMarketingMetadata, defaultPublishingMetadata } from "../domain/v1-2-schemas.js";
import { defaultPhase4StressTest } from "../domain/v1-3-architecture-schemas.js";
import {
  defaultBookStrategy,
  defaultResearchLedger,
  defaultTasteProfile,
  defaultVoiceAudits,
  defaultVoiceExperimentIndex,
  defaultVoiceGuardrails,
} from "../domain/v1-3-schemas.js";
import type { ProjectStateV14 } from "../domain/v1-4-project-schema.js";
import { defaultDecisionLedger, defaultIntake, defaultPremiseLab } from "../domain/v1-4-schemas.js";
import { thrillerEvidenceTemplate } from "../domain/thriller-evidence.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";

export interface ProjectTemplateOptions {
  projectName: string;
  projectType: ProjectType;
  profile: ProfileId;
  targetWords?: number;
  runtimeProfile?: RuntimeProfileId;
  modelExecutionProfile?: ModelExecutionProfileId;
  quality?: QualityProjectState;
}

export function bookTemplateFiles(bookId: string, bookNumber: number, profileId: ProfileId, targetWords = 100000): Record<string, string> {
  const profile = getProfile(profileId);
  const book: BookState = {
    schema_version: "1.0.0",
    book_id: bookId,
    title: `Untitled Book ${bookNumber}`,
    profile: profileId,
    status: "planning",
    current_chapter: 0,
    target_words: targetWords,
    actual_words: 0,
    act_checkpoint: null,
    canon_locked: false,
  };
  const strategy = {
    ...defaultBookStrategy(),
    plan_stress_test: defaultPhase4StressTest(),
    revision_learning_guardrails: [],
  };
  const base = `books/${bookId}`;
  const historicalFiles = profileId === "historical-fiction" ? {
    [`${base}/historical-context.yaml`]: stringifyYaml(defaultHistoricalContext(bookId)),
    [`${base}/invention-ledger.yaml`]: stringifyYaml(defaultInventionLedger(bookId)),
  } : {};
  return {
    [`${base}/BOOK.yaml`]: stringifyYaml(book),
    [`${base}/book-bible.md`]: `# Book ${bookNumber} Bible

## Book promise

## External conflict

## Internal conflict

## Opposition

## POV rules

## Character pressures

## Setting

## Ending contract

## Research dependencies

## Previous-book inheritance

## Next-book handoff
`,
    [`${base}/genre.yaml`]: stringifyYaml(profile.defaultGenreConfig()),
    [`${base}/plot-grid.yaml`]: stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [], decisions: [] }),
    [`${base}/chapter-queue.yaml`]: stringifyYaml({ schema_version: "1.0.0", active_window: "unplanned", packets: [] }),
    [`${base}/continuity-delta.yaml`]: stringifyYaml({ schema_version: "1.0.0", proposed_facts: [], conflicts: [] }),
    [`${base}/revision-tickets.yaml`]: stringifyYaml({ schema_version: "1.0.0", tickets: [] }),
    [`${base}/remarkability.yaml`]: stringifyYaml({
      schema_version: "1.0.0",
      safe_obvious_version: "",
      author_only_advantage: "",
      productive_discomfort: "",
      retellable_hook: "",
      signature_moments: [],
      productive_disagreements: [],
      recurring_motifs: [],
      lingering_question: "",
      hand_sell_reason: "",
      accepted_reader_costs: [],
    }),
    [`${base}/reader-experiments.yaml`]: stringifyYaml({ schema_version: "1.0.0", experiments: [] }),
    [`${base}/publishing.yaml`]: stringifyYaml(defaultPublishingMetadata(book, bookNumber)),
    [`${base}/marketing.yaml`]: stringifyYaml(defaultMarketingMetadata()),
    [`${base}/reader-kits/index.yaml`]: stringifyYaml({ schema_version: "1.0.0", experiments: [] }),
    [`${base}/research-ledger.yaml`]: stringifyYaml(defaultResearchLedger()),
    [`${base}/book-strategy.yaml`]: stringifyYaml(strategy),
    ...(profile.id === "thriller" ? { [`${base}/thriller-evidence.yaml`]: stringifyYaml(thrillerEvidenceTemplate()) } : {}),
    [`${base}/voice-audits.yaml`]: stringifyYaml(defaultVoiceAudits()),
    [`${base}/premise-lab.yaml`]: stringifyYaml(defaultPremiseLab(bookId)),
    ...historicalFiles,
  };
}

export function projectTemplateFiles(options: ProjectTemplateOptions): Record<string, string> {
  const project: ProjectStateV14 = {
    schema_version: "1.0.0",
    novel_forge_version: NOVEL_FORGE_VERSION,
    project_name: options.projectName,
    project_type: options.projectType,
    active_book: "book-01",
    default_profile: options.profile,
    current_stage: "voice-intake",
    next_gate: "voice-approval",
    gates: {
      "voice-approval": "open",
      "book-plan-approval": "open",
      "first-chapter-approval": "open",
      "act-1-review": "open",
      "midpoint-review": "open",
      "pre-final-act-review": "open",
      "manuscript-approval": "open",
      "package-approval": "open",
    },
    approvals: [],
    automation: {
      max_chapters_per_run: 3,
      require_first_chapter_approval: true,
      git_checkpoints: true,
      active_run: null,
    },
    runtime: {
      profile: options.runtimeProfile ?? "full",
      ...(options.modelExecutionProfile ? { model_execution_profile: options.modelExecutionProfile } : {}),
      telemetry: true,
    },
    quality: structuredClone(options.quality ?? defaultQualityProjectState()),
    migration_history: [],
  };
  return {
    "PROJECT.yaml": stringifyYaml(project),
    "START-HERE.md": `# Start Here

Run \`/novel\`.

Novel Forge will show the one action that matters now. Read \`STATUS.md\` for the current decision and \`HANDOFF.md\` when moving to another session. Power-user commands remain available through the guided Advanced menu.
`,
    "STATUS.md": "# Novel Forge\n\nRun `/novel` to refresh the guided decision screen.\n",
    "HANDOFF.md": `# Novel Forge Handoff

This file is regenerated by Novel Forge. Run \`/novel\` for the exact next action.
`,
    "series/series-bible.md": `# Series Bible

## Core premise

## Reader promise

## Recurring cast

## Series engine

## Tonal boundaries

## Book closure rule

Each installment closes its immediate conflict while preserving only earned longer pressure.
`,
    "series/voice-profile.md": `# Voice Profile

## Author intent

## Positive voice evidence

## Sentence and paragraph behavior

## Dialogue behavior

## Emotional restraint and intensity

## Productive imperfections to preserve

## Not-this-author evidence

## Permissioned lived material

## Approval

status: pending
`,
    "series/intake.yaml": stringifyYaml(defaultIntake()),
    "series/decision-ledger.yaml": stringifyYaml(defaultDecisionLedger()),
    "series/taste-profile.yaml": stringifyYaml(defaultTasteProfile()),
    "series/voice-guardrails.yaml": stringifyYaml(defaultVoiceGuardrails()),
    "series/voice-experiments/index.yaml": stringifyYaml(defaultVoiceExperimentIndex()),
    "series/series-arc.yaml": stringifyYaml({ schema_version: "1.0.0", books: [{ id: "book-01", status: "active", role: "establish the series promise", closes: [], carries: [] }], long_arcs: [] }),
    "series/canon.yaml": stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }),
    "series/story-threads.yaml": stringifyYaml({ schema_version: "1.0.0", threads: [] }),
    ...bookTemplateFiles("book-01", 1, options.profile, options.targetWords ?? 100000),
    "research/source-register.yaml": stringifyYaml({ schema_version: "1.0.0", sources: [] }),
  };
}
