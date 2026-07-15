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

const interviewRule = `Inspect existing evidence first. Conduct a short author interview only for unresolved decisions: ask one question at a time and no more than four normal questions. Ask one additional question only when a genuine blocker prevents a complete required workflow artifact. Derive the detailed structure internally, then present the complete result for writer approval.`;

export function voicePlanPrompt(root: string): string {
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\n${interviewRule}\n\nFor voice intake, resolve intended reader effect, positive evidence, unwanted tendencies, productive imperfections, and lived-material boundaries. Build series/voice-profile.md from the writer's own samples, accepted chapters, stated preferences, and not-this-author examples. Translate references into neutral high-level craft traits rather than imitating a named author's exact style. Preserve productive roughness and never invent lived experience.\n\nPrepare the complete atomic voice evidence bundle:\n- series/voice-profile.md — the readable voice compass;\n- series/taste-profile.yaml — precedence, influence roles, admired qualities, excluded qualities, and neutral derived traits;\n- series/voice-guardrails.yaml — operational must/prefer/avoid/monitor rules with no named-author imitation instructions;\n- series/voice-experiments/index.yaml — the typed experiment index, which may remain empty or not-started until a real comparison is accepted.\n\nProduce complete required artifacts, not a questionnaire transcript.\n\n${eventRule(root, "voice-profile", "voice-intake")}`;
}

export function seriesPlanPrompt(root: string): string {
  const project = readProject(root);
  const profile = getProfile(project.default_profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\n\n${interviewRule}\n\nFor series planning, resolve the recurring promise, escalation logic, recurring-cast pressure, and closure/carry rules. Do not over-plan future books scene by scene. Future books remain provisional. Produce the complete typed series state and required series bible rather than exposing schema fields to the writer.\n\nProfile questions to answer from evidence or the short interview:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nPrepare only series/series-bible.md, series/series-arc.yaml, series/canon.yaml, and series/story-threads.yaml.\n\n${eventRule(root, "series-plan", "series-planning")}`;
}

export function bookPlanPrompt(root: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\n${interviewRule}\n\nThe four primary author decisions are:\n1. What is the safe, predictable version of this book that must be avoided?\n2. What can this project uniquely deliver?\n3. What moment should readers retell to someone else?\n4. What should remain alive after the ending?\n\nUse those answers plus existing evidence to derive the complete typed genre, plot, queue, continuity, thread, remarkability, research, and reader-strategy artifacts. The finished plan must still define the book promise, POV rules, conflicts, opposition, ending contract, research dependencies, acts, chapter causality, setup/payoff IDs, profile obligations, productive discomfort, 2–5 signature moments, productive disagreements, restrained motifs, a hand-sell reason, and accepted reader costs. Do not make the writer fill out the schema field by field.\n\nProfile planning questions to answer from evidence or the short interview:\n${profile.planningQuestions.map((item) => `- ${item}`).join("\n")}\n\nPrepare only books/${book.book_id}/book-bible.md, books/${book.book_id}/genre.yaml, books/${book.book_id}/plot-grid.yaml, books/${book.book_id}/chapter-queue.yaml, books/${book.book_id}/continuity-delta.yaml, books/${book.book_id}/remarkability.yaml, books/${book.book_id}/research-ledger.yaml, books/${book.book_id}/book-strategy.yaml, and series/story-threads.yaml. The research ledger may contain planned or researching items, but do not mark unsupported claims ready. The book strategy may begin with empty public-review observations; never invent review evidence.\n\n${eventRule(root, "book-plan", "book-planning")}`;
}

export function queuePrompt(root: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nCreate a bounded draft window of no more than six ready chapter packets from the approved plot grid. Every packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook. Use remarkability.yaml to protect the retellable hook and planned signature moments without forcing every chapter to perform them.\n\nRequired ${profile.label} profile fields:\n${profile.chapterPacketRequirements.map((item) => `- ${item}`).join("\n")}\n\n${eventRule(root, "chapter-queue", "chapter-queue")}`;
}

export function draftPrompt(context: ChapterContext): string {
  const book = readBook(context.root);
  return `Use the novel-forge-for-pi skill.\n\nDraft exactly Chapter ${context.packet.chapter} for ${book.book_id}. Do not chase AI-detector patterns. Make the prose specific to the approved voice, characters, pressure, omissions, scene, and compact remarkability contract. Do not mechanically restate the hook, manufacture quotable lines, or pad to target length.\n\n${context.text}\n\n${eventRule(context.root, "draft-chapter", "drafting", `Pass chapter: ${context.packet.chapter}. Include the complete chapter Markdown plus any justified continuity, story-thread, or ticket deltas. Do not submit PROJECT.yaml, BOOK.yaml, STATUS.md, or HANDOFF.md; the tool derives them.`)}\n\nContext report: estimated ${context.report.estimatedTokens} tokens; excluded ${context.report.excluded.join(", ")}.`;
}

export function automationDraftPrompt(root: string, maxChapters: number, until?: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nRun a bounded drafting loop of no more than ${Math.max(1, Math.min(maxChapters, 10))} chapter workflow events, stopping earlier at ${until ?? "the next milestone gate"}, any human gate, blocker/high ticket, continuity conflict, reveal-order conflict, missing research, invalid packet, or context-budget problem.\n\nFor each chapter, reload state and call novel_apply_event once. Use the project_hash returned by the previous tool result as the expected_project_hash for the next chapter.\n\nProfile drafting rules:\n${profile.draftingRules.map((rule) => `- ${rule}`).join("\n")}\n\nDo not bypass approval. Do not run heavyweight review after each chapter. Do not create extra control files.\n\nInitial ${eventRule(root, "draft-chapter", "drafting", "Pass the selected chapter number and one coherent event at a time.")}`;
}

export function reviewPrompt(root: string, scope: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  const stage = readProject(root).current_stage;
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nReview scope: ${scope}\nActive book: ${book.book_id}\n\nRun independent review lanes without anchoring each lane to another lane's score:\n${profile.milestoneReviewLanes.map((item) => `- ${item}`).join("\n")}\n\nCompare the manuscript to remarkability.yaml without confusing planned ambition with achieved reader impact. Consult reader-experiments.yaml only for real recorded responses. Missing, simulated, model-only, or persona-only responses are not outside-reader evidence.\n\nRequire evidence. Distinguish blockers from preferences and wrong-reader noise. Prepare review-report.md and revision-tickets.yaml.\n\n${eventRule(root, "review", stage, `Pass scope: ${scope}.`)}`;
}

export function readerTestPrompt(root: string, scope: string): string {
  const book = readBook(root);
  const project = readProject(root);
  const path = join(root, "books", book.book_id, "reader-experiments.yaml");
  const existing = readText(path) ?? 'schema_version: "1.0.0"\nexperiments: []\n';
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\nReader-test scope or action: ${scope}\n\nPrepare or update books/${book.book_id}/reader-experiments.yaml. This workflow records real reader evidence; it must never simulate readers, convert model/persona reactions into human evidence, or mark validation complete without actual responses. Every response must use source: human. De-identify readers with stable IDs and preserve useful verbatim language.\n\nFor a new experiment, predeclare the exact target-reader segment, sample path or generated reader kit, variant, blind protocol, minimum_reader_count, and delayed session. Collect immediate continuation, purchase intent, confusion, trust breaks, and lines that worked. Collect delayed recall 24–72 hours later without reopening the sample.\n\nCalculate aggregate rates directly from recorded human rows. A validated verdict must meet the predeclared minimum in both immediate and delayed sessions. Keep the verdict blocked or insufficient-signal when sample size or delayed evidence is missing. Segment results instead of averaging target and wrong-reader reactions. Create revision tickets only for concrete, repeated, evidence-backed failures; do not rewrite manuscript prose in this event.\n\nExisting artifact:\n\n${existing}\n\n${eventRule(root, "reader-test", project.current_stage, `Pass scope: ${scope}. Submit reader-experiments.yaml, reader-kit files when preparing a kit, and only evidence-backed revision tickets.`)}`;
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
  const book = readBook(root);
  const packageText = readText(join(root, "books", book.book_id, "package.md")) ?? "";
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nThe manuscript is compiled to delivery/manuscript.md. Prepare books/${book.book_id}/package.md with title options, series line, hook, blurb, category notes, cover concept, first-page promise, next-book read-through hook, achieved remarkability evidence, and open release risks. Do not claim validation or external review that did not happen; reader-experiments.yaml controls any reader-evidence claim.\n\nExisting package:\n${packageText}\n\n${eventRule(root, "package", "packaging")}`;
}
