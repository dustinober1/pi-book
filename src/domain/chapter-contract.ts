import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const WordRangeSchema = Type.Object({
  minimum: Type.Integer({ minimum: 300 }),
  maximum: Type.Integer({ minimum: 300 }),
}, { additionalProperties: false });

export const StateMutationSchema = Type.Object({
  record_id: Type.String({ minLength: 1 }),
  field: Type.String({ minLength: 1 }),
  operation: Type.Union([Type.Literal("set"), Type.Literal("add"), Type.Literal("remove")]),
  value: Type.Unknown(),
}, { additionalProperties: false });
export type StateMutation = Static<typeof StateMutationSchema>;

/**
 * One scene of a chapter, as an ordered decision rather than a derivation.
 *
 * A chapter contract's `required_beats` are five *descriptions of the whole
 * chapter* on five different axes — purpose, scene engine, pressure movement,
 * character movement, relationship movement — carried over from the legacy
 * packet. They are not a scene sequence, and no arithmetic over them produces
 * one. Dealing them into N piles produced scenes whose objective, conflict,
 * turn and ending requirement were frequently the same string, and a genre
 * label ("interrogation") standing where an objective belongs.
 *
 * Scene structure is therefore authored, in the same way and for the same
 * reason as `required_end_state` and `forbidden_changes`: it is a decision
 * about the story that no query over the graph produces. The three fields must
 * be three different things — what the viewpoint is trying to do, what stops
 * it, and what has changed by the end — because a scene brief in which they
 * coincide tells a small model nothing it can execute.
 */
export const SceneBeatSchema = Type.Object({
  /** What the viewpoint character is trying to accomplish in this scene. */
  objective: Type.String({ minLength: 1 }),
  /** What stands in the way of completing that objective here. */
  conflict: Type.String({ minLength: 1 }),
  /** What has changed by the end of this scene that was not true at its start. */
  turn: Type.String({ minLength: 1 }),
  /**
   * The chapter threads this scene moves. Omitted means every chapter thread is
   * live in this scene, which is the honest default: narrowing is a claim that
   * the other threads do not move here, and only the author can make it.
   */
  thread_ids: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
}, { additionalProperties: false });
export type SceneBeat = Static<typeof SceneBeatSchema>;

/** A chapter compiles to at most this many scenes; `SceneContract.sequence` shares the bound. */
export const MAXIMUM_SCENES_PER_CHAPTER = 5;

export const ChapterContractSchema = Type.Object({
  schema_version: Type.Literal("2.0.0"),
  contract_id: Type.String({ pattern: "^CH-[0-9]{3}$" }),
  version: Type.Integer({ minimum: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  title: Type.String(),
  source_kind: Type.Union([Type.Literal("legacy-packet"), Type.Literal("approved-contract")]),
  source_packet_hash: HashSchema,
  pov: Type.String({ minLength: 1 }),
  purpose: Type.String({ minLength: 1 }),
  required_beats: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
  /**
   * The chapter's ordered scene structure. Optional so contracts written before
   * scene structure was authored still parse; a chapter that needs more than
   * one scene is not executable without it.
   */
  scene_beats: Type.Optional(Type.Array(SceneBeatSchema, { minItems: 1, maxItems: MAXIMUM_SCENES_PER_CHAPTER })),
  active_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  required_record_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  start_state_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  required_end_state: Type.Array(StateMutationSchema),
  forbidden_changes: Type.Array(Type.String({ minLength: 1 })),
  knowledge_boundary_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  target_words: WordRangeSchema,
  ending_hook: Type.String({ minLength: 1 }),
  small_model_ready: Type.Boolean(),
  missing_small_model_fields: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type ChapterContract = Static<typeof ChapterContractSchema>;

export function chapterContractPath(bookId: string, chapter: number): string {
  return `books/${bookId}/contracts/chapters/CH-${String(chapter).padStart(3, "0")}.yaml`;
}
