import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { completeChapterContract } from "../application/contracts/complete-chapter-contract.js";
import { applyNovelEvent, projectStateHash } from "../application/events.js";
import { readProject, requireProjectRoot } from "../project/store.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The typed replacement for hand-authoring a chapter contract.
 *
 * A chapter contract is the gate to guarded scene execution, and completing one
 * previously meant a small model writing schema-exact YAML by hand — where one
 * unquoted `: ` rejects the file and burns the single permitted retry. Here the
 * model supplies only the decisions that are actually its own, as typed values,
 * and the tool serialises and applies them through the same guarded
 * `chapter-queue` event as before.
 *
 * Scene structure is one of those decisions. It used to be derived, by dealing
 * the chapter's five unlike axes round-robin into piles and calling each pile a
 * scene — which produced briefs whose objective, conflict and turn were one
 * repeated string. Deriving it was inventing it, so it moved here.
 */
export function registerCompleteContractCommand(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "novel_complete_chapter_contract",
    label: "Novel Forge Complete Chapter Contract",
    description: "Complete a compiled chapter contract from typed values and apply it through one guarded chapter-queue event. Start states and knowledge boundaries are derived from the story ledgers; you supply what this chapter must change, must not change, and how it divides into scenes.",
    promptSnippet: "Complete the chapter contract by naming its scenes and what the chapter must change and must not change.",
    promptGuidelines: [
      "Use this instead of hand-authoring a chapter contract YAML file: the tool serialises the contract, so a malformed scalar is impossible.",
      "required_end_state names the state records this chapter must have changed by its end, with the field, the operation, and the resulting value.",
      "forbidden_changes names, in plain language, what this chapter must not touch.",
      "scene_beats says how the chapter divides into scenes, in the order they happen. Give one entry per scene, at most five.",
      "In each scene beat the three fields must be three different things: objective is what the viewpoint is trying to do, conflict is what stops it, turn is what has changed by the end. A beat that repeats one fact is rejected, because it tells a drafting model nothing to execute.",
      "A chapter longer than 1000 words is not executable without scene_beats. A shorter one may omit them and compiles to a single scene.",
      "Leave thread_ids unset on a scene unless you mean that the chapter's other threads genuinely do not move in it.",
      "Leave start_state_ids and knowledge_boundary_ids unset unless you are deliberately overriding what the ledgers already determine.",
      "Every record ID must already exist in series/state-ledger.yaml or series/knowledge-ledger.yaml. The tool rejects unknown IDs rather than inventing records.",
    ],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String()),
      chapter: Type.Integer({ minimum: 1 }),
      required_end_state: Type.Array(Type.Object({
        record_id: Type.String({ minLength: 1 }),
        field: Type.String({ minLength: 1 }),
        operation: Type.Union([Type.Literal("set"), Type.Literal("add"), Type.Literal("remove")]),
        value: Type.Unknown(),
      }, { additionalProperties: false }), { minItems: 1 }),
      forbidden_changes: Type.Array(Type.String({ minLength: 1 })),
      scene_beats: Type.Optional(Type.Array(Type.Object({
        objective: Type.String({ minLength: 1 }),
        conflict: Type.String({ minLength: 1 }),
        turn: Type.String({ minLength: 1 }),
        thread_ids: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
      }, { additionalProperties: false }), { minItems: 1, maxItems: 5 })),
      start_state_ids: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
      knowledge_boundary_ids: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const root = requireProjectRoot(params.project_root || ctx.cwd);
        const completed = completeChapterContract(root, {
          chapter: params.chapter,
          requiredEndState: params.required_end_state,
          forbiddenChanges: params.forbidden_changes,
          ...(params.scene_beats ? { sceneBeats: params.scene_beats } : {}),
          ...(params.start_state_ids ? { startStateIds: params.start_state_ids } : {}),
          ...(params.knowledge_boundary_ids ? { knowledgeBoundaryIds: params.knowledge_boundary_ids } : {}),
        });
        const applied = applyNovelEvent(root, {
          eventType: "chapter-queue",
          expectedStage: readProject(root).current_stage,
          expectedProjectHash: projectStateHash(root),
          files: completed.files,
        });
        const derived = completed.derivedFields.length
          ? `Derived from the story ledgers, not asked of you: ${completed.derivedFields.join(", ")}.`
          : "No field could be derived from the story ledgers; every value came from this call.";
        const ready = completed.contract.small_model_ready
          ? `Chapter ${params.chapter} is now executable: novel_advance_chapter_step can run scene planning, critics, repair and ordered acceptance for it.`
          : `Chapter ${params.chapter} is still not executable; missing ${completed.stillMissing.join(", ")}.`;
        const structure = completed.sceneStructure.authored
          ? `Scenes: ${completed.sceneStructure.sceneCount}, from the scene structure you supplied.`
          : "Scenes: 1, derived from the chapter's named fields because no scene structure was supplied.";
        return {
          content: [{ type: "text", text: `${ready}\n${structure}\n${derived}\nChanged: ${applied.changed.join(", ")}\nProject hash: ${applied.projectHash}` }],
          details: {
            chapter: params.chapter,
            path: completed.path,
            scene_count: completed.sceneStructure.sceneCount,
            scene_structure_authored: completed.sceneStructure.authored,
            small_model_ready: completed.contract.small_model_ready,
            still_missing: completed.stillMissing,
            derived_fields: completed.derivedFields,
            changed: applied.changed,
            project_hash: applied.projectHash,
          },
        };
      } catch (error) {
        const message = errorText(error);
        return {
          content: [{ type: "text", text: `Novel Forge chapter contract completion blocked: ${message}` }],
          details: { error: message },
        };
      }
    },
  });
}
