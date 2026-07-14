import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const ProfileIdSchema = Type.Union([Type.Literal("thriller"), Type.Literal("romantasy")]);
export type ProfileId = Static<typeof ProfileIdSchema>;

export const ProjectTypeSchema = Type.Union([
  Type.Literal("standalone"), Type.Literal("planned-series"), Type.Literal("open-ended-series"),
]);
export type ProjectType = Static<typeof ProjectTypeSchema>;

export const StageSchema = Type.Union([
  Type.Literal("voice-intake"), Type.Literal("series-planning"), Type.Literal("book-planning"),
  Type.Literal("chapter-queue"), Type.Literal("drafting"), Type.Literal("act-review"),
  Type.Literal("revision"), Type.Literal("manuscript-review"), Type.Literal("canon-lock"),
  Type.Literal("packaging"), Type.Literal("complete"),
]);
export type Stage = Static<typeof StageSchema>;

export const GateStateSchema = Type.Union([
  Type.Literal("open"), Type.Literal("pending"), Type.Literal("approved"), Type.Literal("rejected"),
]);
export type GateState = Static<typeof GateStateSchema>;

export const ApprovalSchema = Type.Object({
  gate: Type.String({ minLength: 1 }),
  approved_at: Type.String({ minLength: 1 }),
  approved_by: Type.Literal("writer"),
  evidence_hash: Type.String({ minLength: 8 }),
  note: Type.String(),
}, { additionalProperties: false });
export type Approval = Static<typeof ApprovalSchema>;

export const ProjectSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  project_name: Type.String({ minLength: 1 }),
  project_type: ProjectTypeSchema,
  active_book: Type.String({ pattern: "^book-[0-9]{2}$" }),
  default_profile: ProfileIdSchema,
  current_stage: StageSchema,
  next_gate: Type.Union([Type.String(), Type.Null()]),
  gates: Type.Record(Type.String(), GateStateSchema),
  approvals: Type.Array(ApprovalSchema),
  automation: Type.Object({
    max_chapters_per_run: Type.Integer({ minimum: 1, maximum: 10 }),
    require_first_chapter_approval: Type.Boolean(),
    git_checkpoints: Type.Boolean(),
  }),
  migration_history: Type.Array(Type.String()),
}, { additionalProperties: false });
export type ProjectState = Static<typeof ProjectSchema>;

export const BookSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  book_id: Type.String({ pattern: "^book-[0-9]{2}$" }),
  title: Type.String(),
  profile: ProfileIdSchema,
  status: Type.Union([
    Type.Literal("planning"), Type.Literal("drafting"), Type.Literal("review"),
    Type.Literal("revision"), Type.Literal("locked"), Type.Literal("packaged"),
  ]),
  current_chapter: Type.Integer({ minimum: 0 }),
  target_words: Type.Integer({ minimum: 1000 }),
  actual_words: Type.Integer({ minimum: 0 }),
  act_checkpoint: Type.Union([Type.String(), Type.Null()]),
  canon_locked: Type.Boolean(),
}, { additionalProperties: false });
export type BookState = Static<typeof BookSchema>;

export const CanonFactSchema = Type.Object({
  id: Type.String({ minLength: 1 }), category: Type.String({ minLength: 1 }), subject: Type.String({ minLength: 1 }),
  fact: Type.String({ minLength: 1 }), source: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("locked"), Type.Literal("provisional")]),
  introduced_in: Type.Union([Type.String(), Type.Null()]),
});
export type CanonFact = Static<typeof CanonFactSchema>;

export const CanonSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  facts: Type.Array(CanonFactSchema),
  relationships: Type.Array(Type.Object({
    id: Type.String(), characters: Type.Array(Type.String(), { minItems: 2 }), state: Type.String(), trust: Type.String(),
    public_status: Type.String(), private_status: Type.String(), unresolved: Type.Array(Type.String()),
    status: Type.Union([Type.Literal("locked"), Type.Literal("provisional")]),
  })),
});
export type CanonState = Static<typeof CanonSchema>;

export const StoryThreadSchema = Type.Object({
  id: Type.String({ minLength: 1 }), type: Type.String({ minLength: 1 }), setup: Type.String(), reader_knows: Type.String(),
  characters_know: Type.Record(Type.String(), Type.String()),
  status: Type.Union([Type.Literal("planned"), Type.Literal("open"), Type.Literal("advanced"), Type.Literal("paid-off"), Type.Literal("abandoned")]),
  intended_payoff: Type.Union([Type.String(), Type.Null()]), last_advanced_in: Type.Union([Type.String(), Type.Null()]),
});
export type StoryThread = Static<typeof StoryThreadSchema>;
export const StoryThreadsSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), threads: Type.Array(StoryThreadSchema) });
export type StoryThreadsState = Static<typeof StoryThreadsSchema>;

export const ChapterPacketSchema = Type.Object({
  chapter: Type.Integer({ minimum: 1 }), title: Type.String(),
  status: Type.Union([Type.Literal("blocked"), Type.Literal("ready"), Type.Literal("drafted"), Type.Literal("reviewed"), Type.Literal("revised")]),
  pov: Type.String(), purpose: Type.String(), scene_engine: Type.String(), pressure_movement: Type.String(),
  character_movement: Type.String(), relationship_movement: Type.String(), story_thread_refs: Type.Array(Type.String()),
  continuity_refs: Type.Array(Type.String()), character_refs: Type.Array(Type.String()), required_research: Type.Array(Type.String()),
  profile_fields: Type.Record(Type.String(), Type.Unknown()), ending_hook: Type.String(),
  milestone_gate: Type.Union([Type.String(), Type.Null()]), target_words: Type.Integer({ minimum: 300 }),
});
export type ChapterPacket = Static<typeof ChapterPacketSchema>;
export const ChapterQueueSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), active_window: Type.String(), packets: Type.Array(ChapterPacketSchema) });
export type ChapterQueueState = Static<typeof ChapterQueueSchema>;

export const PlotGridSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  acts: Type.Array(Type.Object({ id: Type.String(), purpose: Type.String(), start_chapter: Type.Integer({ minimum: 1 }), end_chapter: Type.Integer({ minimum: 1 }), gate: Type.Union([Type.String(), Type.Null()]) })),
  chapters: Type.Array(Type.Object({ chapter: Type.Integer({ minimum: 1 }), act: Type.String(), causality: Type.String(), state_change: Type.String(), setup_ids: Type.Array(Type.String()), payoff_ids: Type.Array(Type.String()), profile_obligations: Type.Array(Type.String()) })),
});
export type PlotGridState = Static<typeof PlotGridSchema>;

export const RevisionTicketSchema = Type.Object({
  id: Type.String(), severity: Type.Union([Type.Literal("blocker"), Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
  category: Type.String(), chapter: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]), evidence: Type.String(),
  problem: Type.String(), required_change: Type.String(), protected_constraints: Type.Array(Type.String()),
  acceptance_tests: Type.Array(Type.String()),
  status: Type.Union([Type.Literal("open"), Type.Literal("in-progress"), Type.Literal("closed"), Type.Literal("deferred"), Type.Literal("accepted-risk")]),
});
export type RevisionTicket = Static<typeof RevisionTicketSchema>;
export const RevisionTicketsSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), tickets: Type.Array(RevisionTicketSchema) });
export type RevisionTicketsState = Static<typeof RevisionTicketsSchema>;

export const ContinuityDeltaSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"), proposed_facts: Type.Array(CanonFactSchema),
  conflicts: Type.Array(Type.Object({ id: Type.String(), description: Type.String(), canon_refs: Type.Array(Type.String()), status: Type.Union([Type.Literal("open"), Type.Literal("resolved")]) })),
});
export type ContinuityDeltaState = Static<typeof ContinuityDeltaSchema>;

export const GenreConfigSchema = Type.Object({ schema_version: Type.Literal("1.0.0"), profile: ProfileIdSchema, settings: Type.Record(Type.String(), Type.Unknown()), requirements: Type.Record(Type.String(), Type.Unknown()) });
export type GenreConfig = Static<typeof GenreConfigSchema>;

export const SeriesArcSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  books: Type.Array(Type.Object({ id: Type.String({ pattern: "^book-[0-9]{2}$" }), status: Type.String(), role: Type.String(), closes: Type.Array(Type.String()), carries: Type.Array(Type.String()) })),
  long_arcs: Type.Array(Type.Unknown()),
});
export type SeriesArcState = Static<typeof SeriesArcSchema>;

export const SourceRegisterSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  sources: Type.Array(Type.Object({ id: Type.String(), type: Type.String(), title: Type.String(), location: Type.String(), verified_on: Type.Union([Type.String(), Type.Null()]), supports: Type.Array(Type.String()), notes: Type.String() })),
});
export type SourceRegisterState = Static<typeof SourceRegisterSchema>;

export const WorkflowSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"), product: Type.Literal("novel-forge-for-pi"),
  stages: Type.Array(Type.Object({ id: StageSchema, gate: Type.Union([Type.String(), Type.Null()]), next: Type.Union([StageSchema, Type.Null()]) })),
  gate_transitions: Type.Record(Type.String(), StageSchema),
  gate_owners: Type.Record(Type.String(), StageSchema),
});
export type WorkflowDefinition = Static<typeof WorkflowSchema>;

const schemaByPath: Array<[RegExp, TSchema]> = [
  [/(^|\/)PROJECT\.yaml$/, ProjectSchema], [/(^|\/)BOOK\.yaml$/, BookSchema], [/(^|\/)canon\.yaml$/, CanonSchema],
  [/(^|\/)story-threads\.yaml$/, StoryThreadsSchema], [/(^|\/)plot-grid\.yaml$/, PlotGridSchema],
  [/(^|\/)chapter-queue\.yaml$/, ChapterQueueSchema], [/(^|\/)continuity-delta\.yaml$/, ContinuityDeltaSchema],
  [/(^|\/)revision-tickets\.yaml$/, RevisionTicketsSchema], [/(^|\/)genre\.yaml$/, GenreConfigSchema],
  [/(^|\/)series-arc\.yaml$/, SeriesArcSchema], [/(^|\/)source-register\.yaml$/, SourceRegisterSchema],
];
export function schemaForPath(path: string): TSchema | null { return schemaByPath.find(([pattern]) => pattern.test(path))?.[1] ?? null; }
export function assertSchema<T>(schema: TSchema, value: unknown, label: string): asserts value is T {
  if (Value.Check(schema, value)) return;
  const errors = [...Value.Errors(schema, value)].slice(0, 8).map((error) => `${error.path || "/"}: ${error.message}`);
  throw new Error(`${label} failed schema validation:\n${errors.join("\n")}`);
}
