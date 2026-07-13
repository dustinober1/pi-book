import type { ProfileId, ProjectState, ProjectType, BookState } from "../domain/schemas.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";

export interface ProjectTemplateOptions {
  projectName: string;
  projectType: ProjectType;
  profile: ProfileId;
  targetWords?: number;
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
  const base = `books/${bookId}`;
  return {
    [`${base}/BOOK.yaml`]: stringifyYaml(book),
    [`${base}/book-bible.md`]: `# Book ${bookNumber} Bible\n\n## Book promise\n\n## External conflict\n\n## Internal conflict\n\n## Opposition\n\n## POV rules\n\n## Character pressures\n\n## Setting\n\n## Ending contract\n\n## Research dependencies\n\n## Previous-book inheritance\n\n## Next-book handoff\n`,
    [`${base}/genre.yaml`]: stringifyYaml(profile.defaultGenreConfig()),
    [`${base}/plot-grid.yaml`]: stringifyYaml({ schema_version: "1.0.0", acts: [], chapters: [] }),
    [`${base}/chapter-queue.yaml`]: stringifyYaml({ schema_version: "1.0.0", active_window: "unplanned", packets: [] }),
    [`${base}/continuity-delta.yaml`]: stringifyYaml({ schema_version: "1.0.0", proposed_facts: [], conflicts: [] }),
    [`${base}/revision-tickets.yaml`]: stringifyYaml({ schema_version: "1.0.0", tickets: [] }),
    [`${base}/review-report.md`]: "# Review Report\n\nNo milestone review has been run.\n",
    [`${base}/package.md`]: "# Book Package\n\nPackage work begins only after manuscript approval.\n",
  };
}

export function projectTemplateFiles(options: ProjectTemplateOptions): Record<string, string> {
  const project: ProjectState = {
    schema_version: "1.0.0",
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
    automation: {
      max_chapters_per_run: 3,
      require_first_chapter_approval: true,
      git_checkpoints: true,
    },
    migration_history: [],
  };
  return {
    "PROJECT.yaml": stringifyYaml(project),
    "STATUS.md": "# Novel Forge Status\n\nRun `/novel-status` to refresh this file.\n",
    "series/series-bible.md": `# Series Bible\n\n## Core premise\n\n## Reader promise\n\n## Recurring cast\n\n## Series engine\n\n## Tonal boundaries\n\n## Book closure rule\n\nEach installment closes its immediate conflict while preserving only earned longer pressure.\n`,
    "series/voice-profile.md": `# Voice Profile\n\n## Author intent\n\n## Positive voice evidence\n\n## Sentence and paragraph behavior\n\n## Dialogue behavior\n\n## Emotional restraint and intensity\n\n## Productive imperfections to preserve\n\n## Not-this-author evidence\n\n## Permissioned lived material\n\n## Approval\n\nstatus: pending\n`,
    "series/series-arc.yaml": stringifyYaml({ schema_version: "1.0.0", books: [{ id: "book-01", status: "active", role: "establish the series promise", closes: [], carries: [] }], long_arcs: [] }),
    "series/canon.yaml": stringifyYaml({ schema_version: "1.0.0", facts: [], relationships: [] }),
    "series/story-threads.yaml": stringifyYaml({ schema_version: "1.0.0", threads: [] }),
    ...bookTemplateFiles("book-01", 1, options.profile, options.targetWords ?? 100000),
    "research/source-register.yaml": stringifyYaml({ schema_version: "1.0.0", sources: [] }),
  };
}
