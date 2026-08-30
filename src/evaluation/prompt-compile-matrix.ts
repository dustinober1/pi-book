import { compilePrompt, PromptBudgetError, type CompiledPrompt } from "../application/prompt-compiler.js";
import { bookPlanStagePromptPlan, type BookPlanPromptPhase } from "../application/book-plan-prompt-plan.js";
import {
  automationDraftStageSpec,
  bookPlanStageSpec,
  canonLockStageSpec,
  packageStageSpec,
  premisePlanStageSpec,
  queueStageSpec,
  readerTestStageSpec,
  reviewStageSpec,
  revisionStageSpec,
  seriesPlanStageSpec,
  voicePlanStageSpec,
  type BookPlanStageInput,
} from "../application/stage-specs/index.js";
import { sceneExecutionDraftStageSpec } from "../application/stage-specs/draft-execution.js";
import type { StageSpec } from "../application/stage-specs/types.js";
import { RUNTIME_PROFILES, RUNTIME_PROFILE_IDS, type RuntimeProfile, type RuntimeProfileId } from "../domain/runtime-profile.js";
import { PROFILE_IDS, type ProfileId } from "../domain/schemas.js";
import { getProfile } from "../profiles/index.js";

/**
 * Every host prompt Novel Forge can send is compiled from a stage spec against a
 * runtime profile, and the compiler refuses — correctly — to truncate a
 * normative rule to fit an instruction budget. That refusal turns an oversized
 * spec into a hard stop at whatever stage first compiles it. The book-plan spec
 * exceeded tiny-local's instruction ceiling for two releases, which made the
 * profile unusable from stage three onward, and nothing failed until a writer
 * hit it live: the prompt benchmark only ever compared `full` against `local`.
 *
 * This matrix closes that hole. It compiles every registered stage spec under
 * every runtime profile and every genre profile, with representative
 * worst-case inputs (full lint evidence at the profile's cap, the profile's
 * revision-ticket allowance, genre planning questions and rules, public-review
 * evidence present and absent). A stage may compile to a sequence of phase
 * prompts feeding one guarded event; each phase must then fit on its own.
 * A cell failure is a build failure, not a live-session discovery.
 */

export interface PromptMatrixCell {
  stageId: string;
  variant: string;
  runtimeProfile: RuntimeProfileId;
  genre: ProfileId;
  prompts: number;
  characters: number[];
  error: string | null;
}

export interface PromptMatrixReport {
  schemaVersion: "1.0.0";
  cells: PromptMatrixCell[];
  failures: PromptMatrixCell[];
}

interface StageScenario {
  stageId: string;
  variant: string;
  /** Compile the scenario to its prompt plan: one prompt, or ordered phases. */
  compile(genre: ProfileId, runtime: RuntimeProfile): CompiledPrompt[];
}

const ROOT = "/matrix/novel";
const BOOK_ID = "book-01";
const HASH = "matrix-project-hash";

const INTAKE_CONTEXT = [
  "Original author idea: A damaged analyst hears a signal nobody else can verify.",
  "Explicit decision: preserve institutional realism and writer-controlled tradeoffs.",
  "Explicit decision: the protagonist's sister is off-limits as a casualty.",
].join("\n");

const PREMISE_CONTEXT = "Selected premise: the signal is genuine, but acting on it creates an irreversible public cost.";

function lintEvidenceFor(runtime: RuntimeProfile): string {
  // Mirrors reviewPrompt's per-profile lint cap so the matrix measures the
  // worst case the real caller can produce, not an empty placeholder.
  const cap = runtime.id === "full" ? 5_000 : runtime.id === "local" ? 1_400 : 700;
  const line = "- style-pattern/em-dash-density: 4.1 per 1000 words against a 1.8 band ceiling in chapters 3, 5, 9.\n";
  return `Deterministic prose lint evidence:\n${line.repeat(Math.ceil(cap / line.length))}`.slice(0, Math.min(cap, runtime.maxPromptChars));
}

function ticketDetailsFor(runtime: RuntimeProfile): string[] {
  const count = runtime.maxRevisionTickets ?? 3;
  return Array.from({ length: count }, (_, index) => [
    `B1-T${index + 1}: Chapter ${index + 3} resolves its standoff through an unmotivated confession.`,
    "Required change: give the confession a driver already planted in the chapter's evidence.",
    "Protected: the reveal order of the archive subplot; the sister's absence from the casualty list.",
    "Acceptance and regression: the confession follows from on-page pressure | no other scene changes | canon and thread state untouched.",
  ].join("\n"));
}

function bookPlanInput(genre: ProfileId, hasPublicReviewEvidence: boolean): BookPlanStageInput {
  const profile = getProfile(genre);
  return {
    root: ROOT,
    bookId: BOOK_ID,
    intakeContext: INTAKE_CONTEXT,
    premiseContext: PREMISE_CONTEXT,
    planningQuestions: profile.planningQuestions,
    profileRules: profile.bookPlanRules,
    profileOutputs: profile.bookPlanOutputs,
    hasPublicReviewEvidence,
    projectHash: HASH,
  };
}

function single(spec: StageSpec, runtime: RuntimeProfile): CompiledPrompt[] {
  return [compilePrompt(spec, runtime)];
}

function scenarios(): StageScenario[] {
  return [
    {
      stageId: "premise-plan",
      variant: "seeded",
      compile: (_genre, runtime) => single(premisePlanStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        rawIdea: "A damaged analyst hears a signal nobody else can verify.",
        seedElements: ["institutional realism", "ambiguous evidence", "irreversible choice", "series potential"],
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "voice-plan",
      variant: "intake",
      compile: (_genre, runtime) => single(voicePlanStageSpec({ root: ROOT, intakeContext: INTAKE_CONTEXT, projectHash: HASH }), runtime),
    },
    {
      stageId: "series-plan",
      variant: "profile-questions",
      compile: (genre, runtime) => single(seriesPlanStageSpec({
        root: ROOT,
        planningQuestions: getProfile(genre).planningQuestions,
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "book-plan",
      variant: "fresh-project",
      compile: (genre, runtime) => bookPlanStagePromptPlan(bookPlanInput(genre, false), runtime).map((plan: BookPlanPromptPhase) => plan.compiled),
    },
    {
      stageId: "book-plan",
      variant: "public-review-evidence",
      compile: (genre, runtime) => bookPlanStagePromptPlan(bookPlanInput(genre, true), runtime).map((plan: BookPlanPromptPhase) => plan.compiled),
    },
    {
      stageId: "book-plan",
      variant: "single-spec-full-rules",
      // The unsplit spec with every rule loaded still has to compile where the
      // real caller would send it unsplit; failures here are tolerated only for
      // profiles whose caller switches to the phased plan.
      compile: (genre, runtime) => single(bookPlanStageSpec(bookPlanInput(genre, true)), runtime),
    },
    {
      stageId: "chapter-queue",
      variant: "refill",
      compile: (genre, runtime) => {
        const profile = getProfile(genre);
        return single(queueStageSpec({
          root: ROOT,
          bookId: BOOK_ID,
          refillInstruction: "Create packets only for chapters 7, 8, 9, 10. Preserve the existing active packets for chapters 5, 6. Return one complete replacement chapter-queue.yaml containing the preserved active packets plus the new packets.",
          profileLabel: profile.label,
          packetRequirements: profile.chapterPacketRequirements,
          projectHash: HASH,
        }), runtime);
      },
    },
    {
      stageId: "draft-chapter",
      variant: "scene-execution",
      compile: (_genre, runtime) => single(sceneExecutionDraftStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        chapter: 7,
        estimatedTokens: 4_200,
        excluded: ["RES-004", "SRC-011"],
        projectHash: HASH,
        repetitionConstraints: [
          "Chapter openings: 4 of the last 6 chapters open on weather.",
          "Dialogue tags: 'murmured' has appeared 11 times since chapter 3.",
        ],
      }), runtime),
    },
    {
      stageId: "automation-draft",
      variant: "bounded",
      compile: (genre, runtime) => single(automationDraftStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        maxChapters: 3,
        until: "act-1-review",
        draftingRules: getProfile(genre).draftingRules,
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "review",
      variant: "manuscript-with-lint",
      compile: (genre, runtime) => single(reviewStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        scope: "manuscript",
        expectedStage: "manuscript-review",
        lintEvidence: lintEvidenceFor(runtime),
        reviewLanes: getProfile(genre).milestoneReviewLanes,
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "reader-test",
      variant: "existing-artifact",
      compile: (_genre, runtime) => single(readerTestStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        scope: "act-1",
        expectedStage: "act-review",
        existingArtifact: "schema_version: 1.0.0\nexperiments:\n  - id: RX-001\n    status: collecting\n    minimum_reader_count: 5",
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "revision",
      variant: "profile-ticket-allowance",
      compile: (_genre, runtime) => single(revisionStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        ticketDetails: ticketDetailsFor(runtime),
        projectHash: HASH,
      }), runtime),
    },
    {
      stageId: "canon-lock",
      variant: "default",
      compile: (_genre, runtime) => single(canonLockStageSpec({ root: ROOT, bookId: BOOK_ID, projectHash: HASH }), runtime),
    },
    {
      stageId: "package",
      variant: "existing-package",
      compile: (_genre, runtime) => single(packageStageSpec({
        root: ROOT,
        bookId: BOOK_ID,
        existingPackage: "# Package\n\nTitle options: pending\nBlurb: pending",
        projectHash: HASH,
      }), runtime),
    },
  ];
}

/**
 * The unsplit book-plan spec with every rule loaded genuinely does not fit the
 * tiny-local instruction ceiling — that is the finding this matrix exists to
 * pin, and the phased plan is the remedy the real caller uses there. This cell
 * documents the boundary instead of failing the build: it must fail for exactly
 * these profiles (proving the phase split stays necessary) and must compile
 * everywhere else (proving nothing else regressed).
 */
const EXPECTED_SINGLE_SPEC_OVERFLOWS: ReadonlySet<string> = new Set(["book-plan:single-spec-full-rules:tiny-local"]);

export function expectedOverflowKey(cell: Pick<PromptMatrixCell, "stageId" | "variant" | "runtimeProfile">): string {
  return `${cell.stageId}:${cell.variant}:${cell.runtimeProfile}`;
}

export function isExpectedOverflow(cell: Pick<PromptMatrixCell, "stageId" | "variant" | "runtimeProfile">): boolean {
  return EXPECTED_SINGLE_SPEC_OVERFLOWS.has(expectedOverflowKey(cell));
}

export function runPromptCompileMatrix(): PromptMatrixReport {
  const cells: PromptMatrixCell[] = [];
  for (const scenario of scenarios()) {
    for (const runtimeId of RUNTIME_PROFILE_IDS) {
      for (const genre of PROFILE_IDS) {
        const runtime = RUNTIME_PROFILES[runtimeId];
        try {
          const prompts = scenario.compile(genre, runtime);
          cells.push({
            stageId: scenario.stageId,
            variant: scenario.variant,
            runtimeProfile: runtimeId,
            genre,
            prompts: prompts.length,
            characters: prompts.map((prompt) => prompt.characterCount),
            error: null,
          });
        } catch (error) {
          cells.push({
            stageId: scenario.stageId,
            variant: scenario.variant,
            runtimeProfile: runtimeId,
            genre,
            prompts: 0,
            characters: [],
            error: error instanceof PromptBudgetError ? error.message : `unexpected: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
    }
  }
  const failures = cells.filter((cell) => (cell.error !== null) !== isExpectedOverflow(cell));
  return { schemaVersion: "1.0.0", cells, failures };
}
