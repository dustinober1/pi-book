import { Type, type Static } from "@sinclair/typebox";

export const StoryThreadStatusV2Schema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("open"),
  Type.Literal("advanced"),
  Type.Literal("paid-off"),
  Type.Literal("abandoned"),
]);
export type StoryThreadStatusV2 = Static<typeof StoryThreadStatusV2Schema>;

export const StoryThreadPrioritySchema = Type.Union([
  Type.Literal("critical"),
  Type.Literal("high"),
  Type.Literal("normal"),
  Type.Literal("low"),
]);
export type StoryThreadPriority = Static<typeof StoryThreadPrioritySchema>;

export const StoryThreadPayoffWindowSchema = Type.Object({
  earliest_chapter: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  latest_chapter: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
}, { additionalProperties: false });
export type StoryThreadPayoffWindow = Static<typeof StoryThreadPayoffWindowSchema>;

export const StoryThreadV2Schema = Type.Object({
  id: Type.String({ minLength: 1 }),
  type: Type.String({ minLength: 1 }),
  setup: Type.String(),
  reader_knows: Type.String(),
  characters_know: Type.Record(Type.String(), Type.String()),
  status: StoryThreadStatusV2Schema,
  intended_payoff: Type.Union([Type.String(), Type.Null()]),
  last_advanced_in: Type.Union([Type.String(), Type.Null()]),
  priority: StoryThreadPrioritySchema,
  opened_in: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  last_touched_in: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  next_required_touch: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  payoff_window: StoryThreadPayoffWindowSchema,
  dependent_thread_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  participating_entity_ids: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  reader_knowledge_state: Type.String(),
  character_knowledge_refs: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
}, { additionalProperties: false });
export type StoryThreadV2 = Static<typeof StoryThreadV2Schema>;

export const StoryThreadsV2Schema = Type.Object({
  schema_version: Type.Literal("2.0.0"),
  threads: Type.Array(StoryThreadV2Schema),
}, { additionalProperties: false });
export type StoryThreadsV2State = Static<typeof StoryThreadsV2Schema>;

export interface LegacyStoryThread {
  id: string;
  type: string;
  setup: string;
  reader_knows: string;
  characters_know: Record<string, string>;
  status: StoryThreadStatusV2;
  intended_payoff: string | null;
  last_advanced_in: string | null;
}

export interface LegacyStoryThreadsState {
  schema_version: "1.0.0";
  threads: LegacyStoryThread[];
}

export type CompatibleStoryThreadsState = LegacyStoryThreadsState | StoryThreadsV2State;

function legacyChapter(value: string | null): number | null {
  if (value === null) return null;
  const match = value.match(/(\d+)(?!.*\d)/);
  if (!match?.[1]) return null;
  const chapter = Number.parseInt(match[1], 10);
  return Number.isInteger(chapter) && chapter > 0 ? chapter : null;
}

export function normalizeStoryThreads(state: CompatibleStoryThreadsState): StoryThreadsV2State {
  if (state.schema_version === "2.0.0") return structuredClone(state);
  return {
    schema_version: "2.0.0",
    threads: state.threads.map((thread): StoryThreadV2 => ({
      ...structuredClone(thread),
      priority: "normal",
      opened_in: null,
      last_touched_in: legacyChapter(thread.last_advanced_in),
      next_required_touch: null,
      payoff_window: { earliest_chapter: null, latest_chapter: null },
      dependent_thread_ids: [],
      participating_entity_ids: Object.keys(thread.characters_know).sort(),
      reader_knowledge_state: thread.reader_knows,
      character_knowledge_refs: [],
    })),
  };
}
