import { Type, type Static } from "@sinclair/typebox";
import { StoryRecordStatusSchema } from "../domain/story-record-status.js";

export const StoryRecordKindSchema = Type.Union([
  Type.Literal("entity"),
  Type.Literal("canon-fact"),
  Type.Literal("relationship"),
  Type.Literal("story-thread"),
  Type.Literal("state"),
  Type.Literal("knowledge"),
  Type.Literal("research"),
  Type.Literal("plot-chapter"),
  Type.Literal("chapter-contract"),
  Type.Literal("chapter-delta"),
]);
export type StoryRecordKind = Static<typeof StoryRecordKindSchema>;

export const StoryRecordIndexRecordSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  kind: StoryRecordKindSchema,
  status: StoryRecordStatusSchema,
  source_path: Type.String({ minLength: 1 }),
  source_hash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  version: Type.Integer({ minimum: 1 }),
  dependencies: Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true }),
  chapter_scope: Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true }),
  payload: Type.Unknown(),
}, { additionalProperties: false });
export type StoryRecordIndexRecord = Static<typeof StoryRecordIndexRecordSchema>;

export const StoryRecordIndexSourceSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  hash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
}, { additionalProperties: false });
export type StoryRecordIndexSource = Static<typeof StoryRecordIndexSourceSchema>;

export const StoryRecordIndexManifestSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  sources: Type.Array(StoryRecordIndexSourceSchema),
  record_count: Type.Integer({ minimum: 0 }),
  index_hash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
}, { additionalProperties: false });
export type StoryRecordIndexManifest = Static<typeof StoryRecordIndexManifestSchema>;

export interface StoryRecordIndex {
  manifest: StoryRecordIndexManifest;
  records: StoryRecordIndexRecord[];
}

export function renderStoryRecordIndex(records: readonly StoryRecordIndexRecord[]): string {
  const sorted = [...records].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id) || left.source_path.localeCompare(right.source_path));
  return sorted.map((record) => JSON.stringify(record)).join("\n") + (sorted.length ? "\n" : "");
}
