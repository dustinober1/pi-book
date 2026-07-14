import { join } from "node:path";
import type { ChapterContext } from "../context/context-builder.js";
import type { RevisionTicket, Stage } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { regressionChecklist } from "../review/review.js";
import { projectStateHash, type NovelEventType } from "./events.js";

function eventRule(root: string, eventType: NovelEventType, stage: Stage, extra = ""): string {
  return `Do not write project files directly. When the content is ready, call the \`novel_apply_event\` tool with event_type \`${eventType}\`, expected_stage \`${stage}\`, expected_project_hash \`${projectStateHash(root)}\`, and only the allowed changed files. ${extra} The tool validates schemas, references, state transitions, file allowlists, stale writes, and commits the complete workflow event.`;
}

export function voicePlanPrompt(root: string): string {
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\nBuild series/voice-profile.md from the writer's own samples, accepted chapters, stated preferences, and not-this-author examples. Do not imitate a living author's exact style; translate references into high-level craft traits. Preserve productive roughness and never invent lived experience.\n\n${eventRule(root, "voice-profile", "voice-intake")}`;
}

export function seriesPlanPrompt(root: string): string {
  const project = readProject(root); const profile = getProfile(project.default_profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\nPlan the series at promise, escalation, cast-pressure, canon-boundary, and story-thread level. Do not over-plan future books scene by scene. Future books remain provisional.\n\nProfile questions:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nPrepare only series/series-bible.md, series/series-arc.yaml, series/canon.yaml, and series/story-threads.yaml.\n\n${eventRule(root, "series-plan", "series-planning")}`;
}

export function bookPlanPrompt(root: string): string {
  const book = readBook(root); const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nBuild the active-book architecture: book promise, POV rules, conflicts, opposition, ending contract, research dependencies, acts, chapter causality, setup/payoff IDs, and profile obligations.\n\nBuild books/${book.book_id}/remarkability.yaml as the compact ambition contract. Answer:\n- What is the safe, obvious version of this book that must be avoided?\n- What can only this author or project credibly deliver?\n- What productive discomfort should the correct reader carry?\n- What is the retellable hook a reader could repeat to a friend?\n- Which 2–5 signature moments should survive in delayed memory?\n- What should thoughtful target readers disagree about?\n- Which motifs earn recurrence, and what restraint prevents over-insistence?\n- What question should remain alive after the ending?\n- Why would a reader press this book into another person's hands?\n- What intentional reader costs are accepted in exchange for the payoff?\n\nProfile planning questions:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nPrepare only books/${book.book_id}/book-bible.md, genre.yaml, plot-grid.yaml, chapter-queue.yaml, continuity-delta.yaml, remarkability.yaml, and series/story-threads.yaml.\n\n${eventRule(root, "book-plan", "book-planning")}`;
}

export function queuePrompt(root: string): string {
  const book = readBook(root); const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nCreate a bounded draft window of no more than six ready chapter packets from the approved plot grid. Every packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook. Use remarkability.yaml to protect the retellable hook and planned signature moments without forcing every chapter to perform them.\n\nRequired ${profile.label} profile fields:\n${profile.chapterPacketRequirements.map((item) => `- ${item}`).join("\n")}\n\n${eventRule(root, "chapter-queue", "chapter-queue")}`;
}

export function draftPrompt(context: ChapterContext): string {
  const book = readBook(context.root);
  return `Use the novel-forge-for-pi skill.\n\nDraft exactly Chapter ${context.packet.chapter} for ${book.book_id}. Do not chase AI-detector patterns. Make the prose specific to the approved voice, characters, pressure, omissions, scene, and compact remarkability contract. Do not mechanically restate the hook, manufacture quotable lines, or pad to target length.\n\n${context.text}\n\n${eventRule(context.root, "draft-chapter", "drafting", `Pass chapter: ${context.packet.chapter}. Include the complete chapter Markdown plus any justified continuity, story-thread, or ticket deltas. Do not submit PROJECT.yaml, BOOK.yaml, or STATUS.md; the tool derives them.`)}\n\nContext report: estimated ${context.report.estimatedTokens} tokens; excluded ${context.report.excluded.join(", ")}.`;
}

export function automationDraftPrompt(root: string, maxChapters: number, until?: string): string {
  const book = readBook(root); const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nRun a bounded drafting loop of no more than ${Math.max(1, Math.min(maxChapters, 10))} chapter workflow events, stopping earlier at ${until ?? "the next milestone gate"}, any human gate, blocker/high ticket, continuity conflict, reveal-order conflict, missing research, invalid packet, or context-budget problem.\n\nFor each chapter, reload state and call novel_apply_event once. Use the project_hash returned by the previous tool result as the expected_project_hash for the next chapter.\n\nProfile drafting rules:\n${profile.draftingRules.map((rule) => `- ${rule}`).join("\n")}\n\nDo not bypass approval. Do not run heavyweight review after each chapter. Do not create extra control files.\n\nInitial ${eventRule(root, "draft-chapter", "drafting", "Pass the selected chapter number and one coherent event at a time.")}`;
}

export function reviewPrompt(root: string, scope: string): string {
  const book = readBook(root); const profile = getProfile(book.profile); const stage = readProject(root).current_stage;
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nReview scope: ${scope}\nActive book: ${book.book_id}\n\nRun independent review lanes without anchoring each lane to another lane's score:\n${profile.milestoneReviewLanes.map((item) => `- ${item}`).join("\n")}\n\nCompare the manuscript to remarkability.yaml without confusing planned ambition with achieved reader impact. Consult reader-experiments.yaml only for real recorded responses. Missing, simulated, model-only, or persona-only responses are not outside-reader evidence.\n\nRequire evidence. Distinguish blockers from preferences and wrong-reader noise. Prepare review-report.md and revision-tickets.yaml.\n\n${eventRule(root, "review", stage, `Pass scope: ${scope}.`)}`;
}

export function readerTestPrompt(root: string, scope: string): string {
  const book = readBook(root); const project = readProject(root);
  const path = join(root, "books", book.book_id, "reader-experiments.yaml");
  const existing = readText(path) ?? "schema_version: \"1.0.0\"\nexperiments: []\n";
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\nReader-test scope or action: ${scope}\n\nPrepare or update books/${book.book_id}/reader-experiments.yaml. This workflow records real reader evidence; it must never simulate readers, convert model/persona reactions into human evidence, or mark validation complete without actual responses. Every response must use source: human. De-identify readers with stable IDs and preserve useful verbatim language.\n\nFor a new experiment:\n- choose scope: first-page, first-chapter, sample, act, or manuscript\n- identify the exact target-reader segment\n- identify the sample path and variant label\n- set a minimum_reader_count before collecting responses\n- keep the comparison blind when more than one variant exists\n- collect immediate continuation, purchase intent, confusion, trust breaks, and lines that worked\n- schedule a delayed session 24–72 hours later without reopening the sample\n\nFor the delayed session, record:\n- unprompted hook recall\n- remembered scenes, images, arguments, or character choices\n- how the reader would describe the book to a friend\n- what thoughtful readers might disagree about\n- the question that remains alive\n- who they would recommend it to and the specific reason\n- whether they told anyone about it\n\nCalculate aggregate rates directly from the recorded human responses. The event validator rejects rates that do not match those responses. A validated verdict must meet the predeclared minimum in both immediate and delayed sessions. Keep the verdict blocked or insufficient-signal when sample size or delayed evidence is missing. Segment results instead of averaging target and wrong-reader reactions into one false universal score. Create revision tickets only for concrete, repeated, evidence-backed failures; do not rewrite manuscript prose in this event.\n\nExisting artifact:\n\n${existing}\n\n${eventRule(root, "reader-test", project.current_stage, `Pass scope: ${scope}. Submit reader-experiments.yaml and, only when evidence justifies it, revision-tickets.yaml.`)}`;
}

export function revisionPrompt(root: string, tickets: RevisionTicket[]): string {
  const book = readBook(root);
  const details = tickets.map((ticket) => `## ${ticket.id}\nProblem: ${ticket.problem}\nRequired change: ${ticket.required_change}\nProtected: ${ticket.protected_constraints.join("; ") || "none"}\nAcceptance and regression:\n${regressionChecklist(ticket).map((item) => `- ${item}`).join("\n")}`).join("\n\n");
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nApply the smallest revision that satisfies these tickets while preserving canon, reveal order, voice, remarkability intent, and unaffected work.\n\n${details}\n\n${eventRule(root, "revise", "revision")}`;
}

export function canonLockPrompt(root: string): string {
  const book = readBook(root);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nLock only facts evidenced by the approved manuscript and continuity delta. Prepare updates to series/canon.yaml, story-threads.yaml, and series-arc.yaml. Do not lock provisional future plans.\n\n${eventRule(root, "canon-lock", "canon-lock")}`;
}

export function packagePrompt(root: string): string {
  const book = readBook(root); const packageText = readText(join(root, "books", book.book_id, "package.md")) ?? "";
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nThe manuscript is compiled to delivery/manuscript.md. Prepare books/${book.book_id}/package.md with title options, series line, hook, blurb, category notes, cover concept, first-page promise, next-book read-through hook, achieved remarkability evidence, and open release risks. Do not claim validation or external review that did not happen; reader-experiments.yaml controls any reader-evidence claim.\n\nExisting package:\n${packageText}\n\n${eventRule(root, "package", "packaging")}`;
}
