import { join } from "node:path";
import type { ChapterContext } from "../context/context-builder.js";
import type { RevisionTicket } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { regressionChecklist } from "../review/review.js";

const transactionRule = `Write only the approved Novel Forge files. Treat the manuscript and all state changes as one coherent workflow event. Validate YAML before finishing. Do not create new control artifacts.`;

export function voicePlanPrompt(root: string): string {
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\nBuild or repair series/voice-profile.md from the writer's own samples, accepted chapters, stated preferences, and not-this-author examples. Do not imitate a living author's exact style; translate references into high-level craft traits. Preserve productive roughness and never invent lived experience.\n\nWhen complete, set PROJECT.yaml gates.voice-approval to pending. Keep current_stage voice-intake until approval.\n\n${transactionRule}`;
}

export function seriesPlanPrompt(root: string): string {
  const project = readProject(root);
  const profile = getProfile(project.default_profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\nPlan the series at promise, escalation, cast-pressure, canon-boundary, and story-thread level. Do not over-plan future books scene by scene. Future books remain provisional.\n\nProfile questions:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nUpdate only series/series-bible.md, series/series-arc.yaml, series/canon.yaml, series/story-threads.yaml, PROJECT.yaml, and STATUS.md. Advance PROJECT.yaml current_stage to book-planning.\n\n${transactionRule}`;
}

export function bookPlanPrompt(root: string): string {
  const project = readProject(root);
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nBuild a complete active-book architecture: book promise, POV rules, external and internal conflicts, opposition, ending contract, research dependencies, acts, chapter-level causality, setup/payoff IDs, and profile obligations.\n\nProfile planning questions:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nUpdate only books/${book.book_id}/book-bible.md, genre.yaml, plot-grid.yaml, chapter-queue.yaml, continuity-delta.yaml, series/story-threads.yaml, PROJECT.yaml, BOOK.yaml, and STATUS.md. Set book-plan-approval to pending and keep current_stage book-planning until approval.\n\n${transactionRule}`;
}

export function queuePrompt(root: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nCreate a bounded draft window of no more than six chapter packets from the approved plot grid. Every packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook.\n\nRequired ${profile.label} profile fields:\n${profile.chapterPacketRequirements.map((item) => `- ${item}`).join("\n")}\n\nUpdate only chapter-queue.yaml, plot-grid.yaml, PROJECT.yaml, BOOK.yaml, and STATUS.md. Advance current_stage to drafting.\n\n${transactionRule}`;
}

export function draftPrompt(context: ChapterContext): string {
  const project = readProject(context.root);
  const book = readBook(context.root);
  const firstChapter = context.packet.chapter === 1;
  return `Use the novel-forge-for-pi skill.\n\nDraft exactly Chapter ${context.packet.chapter} for ${book.book_id}. Write the complete chapter to books/${book.book_id}/manuscript/chapters/${String(context.packet.chapter).padStart(2, "0")}-${context.packet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chapter"}.md.\n\nDo not chase AI-detector patterns. Make the prose specific to the approved voice, characters, pressure, omissions, and scene. Do not pad to target length.\n\n${context.text}\n\nAfter drafting, update only chapter-queue.yaml, continuity-delta.yaml, series/story-threads.yaml, revision-tickets.yaml, BOOK.yaml, PROJECT.yaml, and STATUS.md. Mark the packet drafted. Update current_chapter and actual_words. ${firstChapter && project.automation.require_first_chapter_approval ? "Set first-chapter-approval to pending and PROJECT.yaml next_gate to first-chapter-approval." : context.packet.milestone_gate ? `Set ${context.packet.milestone_gate} to pending, next_gate to ${context.packet.milestone_gate}, and current_stage to act-review.` : "Keep current_stage drafting and clear next_gate unless another approved milestone requires it."}\n\n${transactionRule}\n\nContext report: estimated ${context.report.estimatedTokens} tokens; excluded ${context.report.excluded.join(", ")}.`;
}

export function automationDraftPrompt(root: string, maxChapters: number, until?: string): string {
  const project = readProject(root);
  const book = readBook(root);
  const profile = getProfile(book.profile);
  const target = until ?? "the next milestone gate";
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nRun a bounded drafting loop of no more than ${Math.max(1, Math.min(maxChapters, 10))} chapter workflow events, stopping earlier at ${target}, any human gate, blocker/high ticket, continuity conflict, reveal-order conflict, missing research, invalid packet, or context-budget problem.\n\nFor each chapter: reload PROJECT.yaml and the active queue; select only the next ready packet; assemble bounded context from referenced canon, story threads, characters, voice evidence, the book bible, genre settings, plot-grid entry, and prior chapter ending; draft one complete chapter; run light mechanics/spelling/reference checks; then update only the chapter, queue, continuity delta, story threads, revision tickets, BOOK.yaml, PROJECT.yaml, and STATUS.md. Treat each chapter as one coherent workflow event.\n\nProfile drafting rules:\n${profile.draftingRules.map((rule) => `- ${rule}`).join("\n")}\n\nDo not bypass first-chapter or milestone approval. Do not run heavyweight manuscript review after each chapter. Do not add filler to reach a word target. Do not create extra control files.\n\nAt the end, report chapters completed, stopping condition, gates opened, tickets created, and the next safe command.\n\n${transactionRule}`;
}

export function reviewPrompt(root: string, scope: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nReview scope: ${scope}\nActive book: ${book.book_id}\n\nRun independent review lanes without anchoring each lane to another lane's score:\n${profile.milestoneReviewLanes.map((item) => `- ${item}`).join("\n")}\n\nRequire textual or structural evidence. Distinguish blockers from preferences and wrong-reader noise. Add or merge concrete findings into revision-tickets.yaml. Write the synthesized review to review-report.md. If blocker/high tickets remain, set current_stage revision. If none remain and scope is manuscript, set manuscript-approval pending. Otherwise return to drafting.\n\nRun deterministic scanners appropriate to the scope, but treat their output as evidence rather than verdict.\n\n${transactionRule}`;
}

export function revisionPrompt(root: string, tickets: RevisionTicket[]): string {
  const book = readBook(root);
  const details = tickets.map((ticket) => `## ${ticket.id}\nProblem: ${ticket.problem}\nRequired change: ${ticket.required_change}\nProtected: ${ticket.protected_constraints.join("; ") || "none"}\nAcceptance and regression:\n${regressionChecklist(ticket).map((item) => `- ${item}`).join("\n")}`).join("\n\n");
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nApply the following ticket or coherent ticket group. Make the smallest revision that satisfies the acceptance tests while preserving canon, reveal order, voice, and unaffected chapter work.\n\n${details}\n\nUpdate revised chapter files, revision-tickets.yaml, continuity-delta.yaml, story-threads.yaml, BOOK.yaml, PROJECT.yaml, and STATUS.md. Close a ticket only after every acceptance and regression check passes. Return current_stage to drafting when blockers are cleared, or manuscript-review when the full manuscript is ready.\n\n${transactionRule}`;
}

export function canonLockPrompt(root: string): string {
  const book = readBook(root);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nLock only facts evidenced by the approved manuscript and continuity delta. Merge accepted facts and relationship states into series/canon.yaml, mark book-specific story-thread changes, update series-arc handoff obligations, set BOOK.yaml canon_locked true and status locked, then advance PROJECT.yaml current_stage to packaging. Do not lock provisional future plans as canon.\n\n${transactionRule}`;
}

export function packagePrompt(root: string): string {
  const book = readBook(root);
  const packageText = readText(join(root, "books", book.book_id, "package.md")) ?? "";
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nThe manuscript has been compiled to delivery/manuscript.md. Prepare books/${book.book_id}/package.md with title options, series line, short hook, full blurb, category/keyword notes, cover concept, first-page promise, next-book read-through hook, and open release risks. Do not claim reader testing, market validation, human-only authorship, or external review that did not happen.\n\nExisting package:\n${packageText}\n\nSet package-approval pending and keep current_stage packaging until approval.\n\n${transactionRule}`;
}
