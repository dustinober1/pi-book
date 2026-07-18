import type { StageSpec } from "./types.js";

interface EventRuleInput {
  eventType: string;
  expectedStage: string;
  projectHash: string;
  extra?: string;
}

function eventToolRules(input: EventRuleInput): string[] {
  return [
    "Do not write project files directly.",
    `When the content is ready, call the novel_apply_event tool with event_type ${input.eventType}, expected_stage ${input.expectedStage}, expected_project_hash ${input.projectHash}, and only the allowed changed files.`,
    input.extra ?? "",
    "The tool validates schemas, references, state transitions, file allowlists, stale writes, and commits the complete workflow event.",
    "If the tool returns a structured rejection code, correct only schema-validation or reference-validation payloads and resubmit once.",
    "For stale-stage or stale-project-hash, reload canonical state and rebuild the proposal.",
    "For all other rejection codes, stop automatic work and surface the failure.",
  ].filter(Boolean);
}

const interviewRule = "Inspect existing evidence first. Conduct a short author interview only for unresolved decisions: ask one question at a time and no more than four normal questions. Ask one additional question only when a genuine blocker prevents a complete required workflow artifact. Derive the detailed structure internally, then present the complete result for writer approval.";

export interface PremisePlanStageInput {
  root: string;
  bookId: string;
  rawIdea: string;
  seedElements: readonly string[];
  projectHash: string;
}

export function premisePlanStageSpec(input: PremisePlanStageInput): StageSpec {
  return {
    id: "premise-plan",
    role: "a neutral premise laboratory facilitator",
    objective: "Prepare three to five recognizable structural premise variants for an explicit writer decision.",
    inputs: [
      `Project root: ${input.root}`,
      `Active book: ${input.bookId}`,
      `Raw author idea: ${input.rawIdea || "not yet supplied"}`,
      `Seed elements: ${input.seedElements.length ? input.seedElements.join(", ") : "derive only from the author idea and explicit decisions"}`,
    ],
    must: [
      "Variant 1 is the raw-idea baseline or closest faithful expansion.",
      "Preserve every declared seed element in every variant.",
      "Give each variant a unique story engine, central final-page question, immediate gain, deferred cost, irreversible effect, differentiation, series potential, accepted tradeoffs, and neutral diagnostic observations.",
      "Present the comparison for an explicit writer decision; the writer must select the final variant.",
      "Use the state-neutral premise-update event for comparison evidence and the decision ledger.",
    ],
    avoid: [
      "Do not score, rank, recommend, or choose a winner.",
      "Do not read or use private taste-profile influence names.",
      "Never select a variant without the matching writer decision.",
    ],
    outputs: ["three to five complete premise variants", "premise comparison evidence", "decision-ledger update when the writer decides"],
    validation: ["Every seed element appears in every variant.", "No variant is ranked or selected by the model.", "The final selection remains blocked until a writer decision exists."],
    toolRules: eventToolRules({ eventType: "premise-update", expectedStage: "book-planning", projectHash: input.projectHash }),
  };
}

export interface VoicePlanStageInput {
  root: string;
  intakeContext: string;
  projectHash: string;
}

export function voicePlanStageSpec(input: VoicePlanStageInput): StageSpec {
  return {
    id: "voice-plan",
    role: "a voice-intake facilitator and evidence custodian",
    objective: "Prepare a complete atomic voice evidence bundle for writer approval without imitating named authors.",
    inputs: [`Project root: ${input.root}`, input.intakeContext || "No additional intake context is currently recorded.", interviewRule],
    must: [
      "Resolve intended reader effect, positive evidence, unwanted tendencies, productive imperfections, and lived-material boundaries.",
      "Start with the writer's own samples, accepted chapters, explicit decisions, and not-this-author examples.",
      "Writer samples and explicit decisions outrank an accepted baseline, the approved voice profile, external influence references, and genre defaults.",
      "Preserve productive roughness and never invent lived experience.",
      "For each named influence, record the private reference only in series/taste-profile.yaml and capture both admired_for and not_for.",
      "Translate influence answers into neutral derived traits.",
      "When existing evidence is insufficient to choose the opening voice, run one anonymous calibration using one representative 600–900 words source scene and anonymous variants A, B, and C, each 600–900 words and materially different only in high-level craft choices.",
      "Present only A, B, and C for writer scoring on feels-like-the-book, desire to continue, character intimacy, naturalness, distinctiveness, and density.",
      "Preserve the writer's accepted or combined version as baseline.md and calculate its exact normalized content hash.",
      "Store experiment.yaml, source-scene.md, variant-a.md, variant-b.md, variant-c.md, and baseline.md through the non-transitioning research-update event.",
      "After any research-update, use the project_hash returned by that tool result for the final event instead of the earlier hash.",
      "Prepare series/voice-profile.md, series/taste-profile.yaml, series/voice-guardrails.yaml, and series/voice-experiments/index.yaml as one complete atomic voice evidence bundle.",
      "Use the state-neutral intake-update event for any intake or decision-ledger evidence.",
      "Produce complete required artifacts, not a questionnaire transcript.",
    ],
    avoid: [
      "Never copy signature phrasing, distinctive imagery, character templates, or imitation instructions into the readable profile, guardrails, experiment prose, or drafting context.",
      "Never label a variant with an author or book.",
      "Never include a raw influence name or title inside source, variants, or baseline.",
      "Never silently rewrite assumption history or decision history.",
    ],
    outputs: ["series/voice-profile.md", "series/taste-profile.yaml", "series/voice-guardrails.yaml", "series/voice-experiments/index.yaml", "optional anonymous calibration artifacts"],
    validation: ["Readable voice artifacts contain only neutral craft language.", "Accepted baseline hashes agree across the index and guardrails.", "Named influences remain private and never become imitation instructions.", "Calibration is skipped when existing evidence is sufficient."],
    toolRules: [
      ...eventToolRules({ eventType: "research-update", expectedStage: "voice-intake", projectHash: input.projectHash, extra: "Submit only the experiment YAML and its Markdown source, anonymous variants, and accepted baseline. This event does not advance stage or change gates." }),
      ...eventToolRules({ eventType: "voice-profile", expectedStage: "voice-intake", projectHash: input.projectHash, extra: "If a research-update ran first, pass its returned project_hash as expected_project_hash for this final event." }),
    ],
  };
}

export interface SeriesPlanStageInput {
  root: string;
  planningQuestions: readonly string[];
  projectHash: string;
}

export function seriesPlanStageSpec(input: SeriesPlanStageInput): StageSpec {
  return {
    id: "series-plan",
    role: "a series architecture planner",
    objective: "Define the recurring promise, escalation logic, recurring-cast pressure, and closure/carry rules without over-planning future books.",
    inputs: [`Project root: ${input.root}`, interviewRule, ...input.planningQuestions.map((question) => `Profile question: ${question}`)],
    must: [
      "Future books remain provisional.",
      "Produce the complete typed series state and required series bible rather than exposing schema fields to the writer.",
      "series/canon.yaml top level requires schema_version 1.0.0, facts as an array, and relationships as an array.",
      "For series/canon.yaml, facts entries require non-empty string fields id, category, subject, fact, and source, plus status and introduced_in; status must be locked or provisional, and introduced_in is a string or null.",
      "For series/canon.yaml, relationship entries require id, characters, state, trust, public_status, private_status, unresolved, and status; characters is an array of at least two strings, unresolved is an array of strings, and status must be locked or provisional.",
      "series/story-threads.yaml top level requires schema_version 1.0.0 and threads as an array.",
      "For series/story-threads.yaml, thread entries require id, type, setup, reader_knows, characters_know, status, intended_payoff, and last_advanced_in; id and type are non-empty strings, characters_know is a string-to-string map, intended_payoff and last_advanced_in are each a string or null, and status is only planned, open, advanced, paid-off, or abandoned.",
    ],
    avoid: ["Do not over-plan future books scene by scene.", "Do not lock provisional future-book facts as canon."],
    outputs: ["series/series-bible.md", "series/series-arc.yaml", "series/canon.yaml", "series/story-threads.yaml"],
    validation: ["Every recurring promise and escalation rule is explicit.", "Future-book material is marked provisional.", "Only the declared four files change."],
    toolRules: eventToolRules({ eventType: "series-plan", expectedStage: "series-planning", projectHash: input.projectHash, extra: "Submit all four series-plan files in one event: series-bible.md, series-arc.yaml, canon.yaml, and story-threads.yaml." }),
  };
}

export interface BookPlanStageInput {
  root: string;
  bookId: string;
  intakeContext: string;
  premiseContext: string;
  planningQuestions: readonly string[];
  profileRules: readonly string[];
  profileOutputs: readonly string[];
  projectHash: string;
}

export function bookPlanStageSpec(input: BookPlanStageInput): StageSpec {
  return {
    id: "book-plan",
    role: "a complete book architecture planner",
    objective: "Derive the complete typed genre, plot, queue, continuity, thread, remarkability, research, and reader-strategy artifacts for writer approval.",
    inputs: [
      `Project root: ${input.root}`,
      `Active book: ${input.bookId}`,
      input.intakeContext || "No additional intake context is currently recorded.",
      input.premiseContext || "No selected premise context is currently recorded.",
      interviewRule,
      ...input.planningQuestions.map((question) => `Profile planning question: ${question}`),
    ],
    must: [
      "Resolve the four primary author decisions: What is the safe, predictable version of this book that must be avoided? What can this project uniquely deliver? What moment should readers retell to someone else? What should remain alive after the ending?",
      "The finished plan must define the book promise, POV rules, conflicts, opposition, ending contract, research dependencies, acts, chapter causality, setup/payoff IDs, profile obligations, productive discomfort, 2–5 signature moments, productive disagreements, restrained motifs, a hand-sell reason, and accepted reader costs.",
      "Build a decision-and-consequence ledger in plot-grid.yaml.",
      "Every consequential choice records the chapter, the choice, its immediate gain, deferred cost, irreversible effect, and a forward payoff window inside planned chapters.",
      "Preserve fair setup-before-payoff order and avoid three consecutive chapters with the same scene engine.",
      "Before book-plan approval, resolve all ten stress concerns with rationale and evidence: early genre promise, middle repetition, motivated risk, fair information, uneven alternatives or suspects, avoidable silence, redundant characters, the external ending contract, the emotional ending contract, and reference similarity plus intentional tradeoffs.",
      "A stress check may pass or be linked to an explicit accepted tradeoff; pending or blocked checks cannot proceed to approval.",
      "Research uses exactly four lanes: taste-and-voice, story-world, human-authenticity, and reader-and-market.",
      "A claim may remain planned or researching while evidence is incomplete.",
      "Mark a research claim ready only when it has registered source IDs, source reliability, an observation or verification date, confidence, fictionalization status, knowledge scope, risks, at least one dramatic use, and the exact story decision it affects.",
      "Public-review observations are market evidence, never reader evidence for this manuscript.",
      "Accept only user-supplied manual, pasted, linked, or CSV public-review observations.",
      "Store a paraphrase and at most a short excerpt; discard reviewer names, handles, and profile URLs.",
      "Derive ratings 1–2 as negative, 3 as mixed, and 4–5 as positive.",
      "Keep praise as positive counterweights instead of flattening it into complaint clusters.",
      "Confidence is weak below three observations or on one title, moderate at three observations across two titles, and strong only at six observations across three titles with high execution relevance and a positive counterweight.",
      "One-star-only evidence can never exceed moderate.",
      "Every project-relevant public-review cluster requires the writer to choose prevent, mitigate, accept-as-tradeoff, or irrelevant-to-project.",
      "Only prevent or mitigate clusters may become approved review-derived guardrails.",
      "Use the state-neutral intake-update event for any intake or decision-ledger evidence.",
      "The research ledger may contain planned or researching items, but do not mark unsupported claims ready.",
      "The book strategy may begin with empty public-review observations, but its expectation decisions and plan stress test must be complete for approval.",
      ...input.profileRules,
    ],
    avoid: [
      "Do not make the writer fill out the schema field by field.",
      "Never invent public-review evidence.",
      "Never update reader-experiments.yaml or manuscript validation claims from public observations.",
      "Never silently rewrite assumption history or decision history.",
      "Do not mark unsupported research claims ready.",
    ],
    outputs: [
      `books/${input.bookId}/book-bible.md`,
      `books/${input.bookId}/genre.yaml`,
      `books/${input.bookId}/plot-grid.yaml`,
      `books/${input.bookId}/chapter-queue.yaml`,
      `books/${input.bookId}/continuity-delta.yaml`,
      `books/${input.bookId}/remarkability.yaml`,
      `books/${input.bookId}/research-ledger.yaml`,
      `books/${input.bookId}/book-strategy.yaml`,
      "research/source-register.yaml when provenance changes",
      "series/story-threads.yaml",
      ...input.profileOutputs.map((output) => `books/${input.bookId}/${output}`),
    ],
    validation: [
      "All required typed artifacts are complete.",
      "All ten stress concerns are passed or linked to an explicit accepted tradeoff.",
      "Every setup precedes its payoff.",
      "No three consecutive chapters use the same scene engine.",
      "Every ready research claim has complete provenance and dramatic use.",
      "Public-review evidence remains separate from human reader evidence.",
      "The writer retains premise and gate approval authority.",
      ...(input.profileRules.length ? ["Every profile-specific planning and evidence rule is satisfied."] : []),
    ],
    toolRules: eventToolRules({ eventType: "book-plan", expectedStage: "book-planning", projectHash: input.projectHash }),
  };
}

export interface QueueStageInput {
  root: string;
  bookId: string;
  refillInstruction: string;
  profileLabel: string;
  packetRequirements: readonly string[];
  projectHash: string;
}

export function queueStageSpec(input: QueueStageInput): StageSpec {
  return {
    id: "chapter-queue",
    role: "a rolling chapter-packet maintainer",
    objective: "Maintain a rolling active window of at most six ready chapter packets and refill only when fewer than two remain.",
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, input.refillInstruction, ...input.packetRequirements.map((item) => `Required ${input.profileLabel} profile field: ${item}`)],
    must: [
      "Drafted, reviewed, and revised packets must not remain in the active window.",
      "Every new packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook.",
      "Use remarkability.yaml to protect the retellable hook and planned signature moments without forcing every chapter to perform them.",
      "New required_research entries use only ready RES-NNN research-ledger IDs.",
      "Existing SRC-NNN references remain readable as legacy advisories and should be migrated during the next plan rebuild.",
      "Carry approved book guardrails into drafting context.",
      "Generate only the requested refill packets.",
    ],
    avoid: ["Never copy raw public-review observations into a packet.", "Do not regenerate packets when no refill is required.", "Do not exceed six ready packets."],
    outputs: ["one complete replacement chapter-queue.yaml containing preserved active packets plus only the requested new packets"],
    validation: ["The active window contains at most six ready packets.", "No drafted, reviewed, or revised packet remains active.", "Every research reference is ready or a readable legacy advisory."],
    toolRules: eventToolRules({ eventType: "chapter-queue", expectedStage: "chapter-queue", projectHash: input.projectHash }),
  };
}

export interface DraftStageInput {
  root: string;
  bookId: string;
  chapter: number;
  contextText: string;
  estimatedTokens: number;
  excluded: readonly string[];
  projectHash: string;
}

export function draftStageSpec(input: DraftStageInput): StageSpec {
  return {
    id: "draft-chapter",
    role: "the approved novel's chapter drafter",
    objective: `Draft exactly Chapter ${input.chapter} for ${input.bookId}.`,
    inputs: [input.contextText, `Context: ~${input.estimatedTokens} tokens; excluded: ${input.excluded.join(", ")}.`],
    must: ["Make prose specific to the approved voice, characters, pressure, omissions, scene, and compact remarkability contract.", "Include the complete chapter Markdown plus any justified continuity, story-thread, or ticket deltas."],
    avoid: ["Do not chase AI-detector patterns.", "Do not mechanically restate the hook.", "Do not manufacture quotable lines.", "Do not pad to target length.", "Do not turn audit metrics into prose quotas.", "Do not submit PROJECT.yaml, BOOK.yaml, STATUS.md, or HANDOFF.md; they are derived."],
    outputs: [`Chapter ${input.chapter} Markdown`, "only justified continuity, story-thread, or ticket deltas"],
    validation: ["Chapter satisfies its approved packet and context.", "Canon and reveal order remain intact.", "No excluded context is invented."],
    toolRules: [
      "Use one guarded novel_apply_event; never write project files directly.",
      `Send event_type=draft-chapter, expected_stage=drafting, expected_project_hash=${input.projectHash}, chapter=${input.chapter}, and only allowed files.`,
      "Tool validation of schemas, references, stage, allowlists, stale state, and atomic commit is authoritative.",
      "Retry once only for schema-validation or reference-validation. Reload for stale-stage or stale-project-hash; stop on any other rejection.",
    ],
  };
}

export interface AutomationDraftStageInput {
  root: string;
  bookId: string;
  maxChapters: number;
  until: string;
  draftingRules: readonly string[];
  projectHash: string;
}

export function automationDraftStageSpec(input: AutomationDraftStageInput): StageSpec {
  return {
    id: "automation-draft",
    role: "a bounded chapter-workflow runner",
    objective: `Run no more than ${input.maxChapters} chapter workflow events, stopping earlier at ${input.until}.`,
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, ...input.draftingRules.map((rule) => `Profile drafting rule: ${rule}`)],
    must: ["For each chapter, reload state and call novel_apply_event once.", "Use the project_hash returned by the previous tool result as the expected_project_hash for the next chapter.", "Stop at any human gate, blocker/high ticket, continuity conflict, reveal-order conflict, missing research, invalid packet, or context-budget problem."],
    avoid: ["Do not bypass approval.", "Do not run heavyweight review after each chapter.", "Do not create extra control files."],
    outputs: ["one coherent guarded draft-chapter event at a time"],
    validation: ["The normalized chapter limit is never exceeded.", "Every event begins from freshly loaded canonical state.", "The loop stops immediately on a listed boundary."],
    toolRules: eventToolRules({ eventType: "draft-chapter", expectedStage: "drafting", projectHash: input.projectHash, extra: "Pass the selected chapter number and one coherent event at a time." }),
  };
}

export interface ReviewStageInput {
  root: string;
  bookId: string;
  scope: string;
  expectedStage: string;
  reviewLanes: readonly string[];
  projectHash: string;
  lintEvidence?: string;
}

export function reviewStageSpec(input: ReviewStageInput): StageSpec {
  return {
    id: "review",
    role: "an independent evidence-backed manuscript reviewer",
    objective: `Review ${input.scope} through independent review lanes without anchoring each lane to another lane's score.`,
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, `Review scope: ${input.scope}`, ...(input.lintEvidence ? [input.lintEvidence] : []), ...input.reviewLanes.map((lane) => `Independent review lane: ${lane}`)],
    must: [
      "Run independent review lanes without anchoring each lane to another lane's score.",
      "Compare the manuscript to remarkability.yaml without confusing planned ambition with achieved reader impact.",
      "Consult reader-experiments.yaml only for accepted source: human responses to this manuscript.",
      "Public-review observations in book-strategy.yaml are market-friction evidence only: use them to check planned tradeoffs and expectations, never to change reader metrics, verdicts, or claims that this manuscript was tested.",
      "Missing, simulated, model-only, or persona-only responses are not outside-reader evidence.",
      "Voice metrics are evidence, not quotas or automatic severity conclusions.",
      "Review their baseline and POV context, preserve declared intentional exceptions, and do not instruct the writer to hit a target sentence length, dialogue ratio, or fragment frequency.",
      "Review the scene engine sequence and state changes: flag more than two consecutive identical engines, dominant engines in a sufficiently large plan, state-neutral interviews or conversations, and adjacent chapters with indistinguishable state movement.",
      "Attach recurrence metadata only to a concrete recurring problem.",
      "Use one stable pattern ID and the current milestone scope.",
      "A learning rule becomes eligible only after three distinct chapters or two distinct milestone reviews.",
      "Eligibility is not approval: the writer must explicitly approve the proposed rule in book-strategy.yaml.",
      "Require manuscript evidence.",
      "Distinguish blockers from preferences, public-market friction, and wrong-reader noise.",
      "Preserve accepted tradeoffs.",
      "Prepare review-report.md and revision-tickets.yaml; the guarded event appends deterministic voice-audit evidence and scene-audit tickets atomically.",
    ],
    avoid: ["Do not rewrite earlier prose or perform a retroactive sweep when a candidate is promoted.", "Do not treat public reviews as reader evidence for this manuscript.", "Do not convert metrics into mechanical prose quotas.", "Do not issue unsupported blockers."],
    outputs: ["review-report.md", "revision-tickets.yaml", "deterministic voice-audit and scene-audit evidence appended by the guarded event"],
    validation: ["Every blocker cites manuscript evidence.", "Every ticket protects unaffected work and accepted tradeoffs.", "Reader claims derive only from recorded human responses to this manuscript.", "Recurrence eligibility never bypasses explicit writer approval."],
    toolRules: eventToolRules({ eventType: "review", expectedStage: input.expectedStage, projectHash: input.projectHash, extra: `Pass scope: ${input.scope}.` }),
  };
}

export interface ReaderTestStageInput {
  root: string;
  bookId: string;
  scope: string;
  expectedStage: string;
  existingArtifact: string;
  projectHash: string;
}

export function readerTestStageSpec(input: ReaderTestStageInput): StageSpec {
  return {
    id: "reader-test",
    role: "a real-reader evidence recorder",
    objective: `Prepare or update books/${input.bookId}/reader-experiments.yaml for ${input.scope}.`,
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, `Reader-test scope or action: ${input.scope}`, `Existing artifact:\n${input.existingArtifact}`],
    must: ["Every response must use source: human.", "De-identify readers with stable IDs and preserve useful verbatim language.", "For a new experiment, predeclare the exact target-reader segment, sample path or generated reader kit, variant, blind protocol, minimum_reader_count, and delayed session.", "Collect immediate continuation, purchase intent, confusion, trust breaks, and lines that worked.", "Collect delayed recall 24–72 hours later without reopening the sample.", "Calculate aggregate rates directly from recorded human rows.", "A validated verdict must meet the predeclared minimum in both immediate and delayed sessions.", "Keep the verdict blocked or insufficient-signal when sample size or delayed evidence is missing.", "Segment results instead of averaging target and wrong-reader reactions.", "Create revision tickets only for concrete, repeated, evidence-backed failures."],
    avoid: ["Never simulate readers.", "This workflow must never import public-review observations.", "Never convert model or persona reactions into human evidence.", "Never mark validation complete without actual responses.", "Do not rewrite manuscript prose in this event."],
    outputs: [`books/${input.bookId}/reader-experiments.yaml`, "reader-kit files when preparing a kit", "only evidence-backed revision tickets"],
    validation: ["All responses have source: human.", "Validated verdicts meet both immediate and delayed minimums.", "Target and wrong-reader segments remain separate.", "No public-review or simulated evidence is present."],
    toolRules: eventToolRules({ eventType: "reader-test", expectedStage: input.expectedStage, projectHash: input.projectHash, extra: `Pass scope: ${input.scope}.` }),
  };
}

export interface RevisionStageInput {
  root: string;
  bookId: string;
  ticketDetails: readonly string[];
  projectHash: string;
}

export function revisionStageSpec(input: RevisionStageInput): StageSpec {
  return {
    id: "revision",
    role: "a controlled manuscript reviser",
    objective: "Apply the smallest revision that satisfies the selected tickets while preserving unaffected work.",
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, ...input.ticketDetails],
    must: ["Preserve canon, reveal order, voice, remarkability intent, accepted tradeoffs, and unaffected work.", "Satisfy every ticket acceptance and regression condition."],
    avoid: ["Do not broaden the revision beyond the selected tickets.", "Do not rewrite protected constraints.", "Do not introduce unrelated cleanup."],
    outputs: ["the smallest complete manuscript and evidence changes required by the selected tickets"],
    validation: ["Every selected ticket is satisfied.", "Every protected constraint remains intact.", "Regression checks pass for unaffected work."],
    toolRules: eventToolRules({ eventType: "revise", expectedStage: "revision", projectHash: input.projectHash }),
  };
}

export interface CanonLockStageInput {
  root: string;
  bookId: string;
  projectHash: string;
}

export function canonLockStageSpec(input: CanonLockStageInput): StageSpec {
  return {
    id: "canon-lock",
    role: "a canon custodian",
    objective: "Lock only facts evidenced by the approved manuscript and continuity delta.",
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, "approved manuscript", "continuity delta"],
    must: ["Prepare updates to series/canon.yaml, story-threads.yaml, and series-arc.yaml."],
    avoid: ["Do not lock provisional future plans."],
    outputs: ["series/canon.yaml", "series/story-threads.yaml", "series/series-arc.yaml"],
    validation: ["Every locked fact has approved-manuscript or continuity-delta evidence.", "No provisional future plan becomes canon."],
    toolRules: eventToolRules({ eventType: "canon-lock", expectedStage: "canon-lock", projectHash: input.projectHash }),
  };
}

export interface PackageStageInput {
  root: string;
  bookId: string;
  existingPackage: string;
  projectHash: string;
}

export function packageStageSpec(input: PackageStageInput): StageSpec {
  return {
    id: "package",
    role: "a publication-package planner",
    objective: `Prepare books/${input.bookId}/package.md from the compiled manuscript and verified evidence.`,
    inputs: [`Project root: ${input.root}`, `Active book: ${input.bookId}`, "delivery/manuscript.md", `Existing package:\n${input.existingPackage}`],
    must: ["Include title options, series line, hook, blurb, category notes, cover concept, first-page promise, next-book read-through hook, achieved remarkability evidence, and open release risks.", "Use reader-experiments.yaml to control any reader-evidence claim.", "Use public-review observations only for market positioning hypotheses."],
    avoid: ["Do not claim validation or external review that did not happen.", "Do not convert public-review observations into manuscript reader evidence."],
    outputs: [`books/${input.bookId}/package.md`],
    validation: ["Every validation or reader claim has matching recorded evidence.", "Open release risks remain explicit.", "Market hypotheses are labeled as hypotheses."],
    toolRules: eventToolRules({ eventType: "package", expectedStage: "packaging", projectHash: input.projectHash }),
  };
}
