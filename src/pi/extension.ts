import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ProfileId, ProjectType, Stage } from "../domain/schemas.js";
import { listProfiles } from "../profiles/index.js";
import { initializeProject, requireProjectRoot, readProject } from "../project/store.js";
import { addBook } from "../project/add-book.js";
import { refreshStatus } from "../application/status.js";
import { bookPlanPrompt, packagePrompt, readerTestPrompt, reviewPrompt, seriesPlanPrompt, voicePlanPrompt } from "../application/prompts.js";
import { decideNextRun, directDraftDecision, directRevisionDecision, type RunDecision } from "../application/run.js";
import { compileActiveBook } from "../application/package.js";
import { migrateGenesisProject } from "../migration/genesis-v0.4.js";
import { assertOperationAllowed, assertReviewAllowed } from "../application/authorization.js";
import { applyNovelEvent, type NovelEventType } from "../application/events.js";
import { flagValue, parseRunOptions, tokens } from "./arguments.js";

function sendDecision(pi: ExtensionAPI, context: ExtensionCommandContext, decision: RunDecision): void {
  if (!decision.prompt) { context.ui.notify(decision.message, decision.action === "blocked" ? "warning" : "info"); return; }
  if (!context.isIdle()) { pi.sendUserMessage(decision.prompt, { deliverAs: "followUp" }); context.ui.notify(decision.message, "info"); return; }
  pi.sendUserMessage(decision.prompt);
}
function planPromptFor(root: string, requested: string): string {
  const project = readProject(root); const scope = requested || (project.current_stage === "voice-intake" ? "voice" : project.current_stage === "series-planning" ? "series" : "book");
  if (scope === "voice") { assertOperationAllowed(project, "plan-voice"); return voicePlanPrompt(root); }
  if (scope === "series") { assertOperationAllowed(project, "plan-series"); return seriesPlanPrompt(root); }
  if (scope === "book") { assertOperationAllowed(project, "plan-book"); return bookPlanPrompt(root); }
  throw new Error(`Unknown planning scope: ${scope}. Use voice, series, or book.`);
}

export function registerNovelForge(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "novel_apply_event",
    label: "Novel Forge Apply Event",
    description: "Apply one allowlisted Novel Forge workflow event transactionally with schema, reference, stage, and stale-write validation.",
    promptSnippet: "Apply the prepared Novel Forge files as one guarded workflow event.",
    promptGuidelines: ["Use novel_apply_event for Novel Forge planning, drafting, review, reader evidence, revision, canon lock, and packaging changes. Never write Novel Forge state files directly."],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String()),
      event_type: Type.Union([
        Type.Literal("voice-profile"), Type.Literal("series-plan"), Type.Literal("book-plan"),
        Type.Literal("chapter-queue"), Type.Literal("draft-chapter"), Type.Literal("review"),
        Type.Literal("reader-test"), Type.Literal("revise"), Type.Literal("canon-lock"), Type.Literal("package"),
      ]),
      expected_stage: Type.String(), expected_project_hash: Type.String(), chapter: Type.Optional(Type.Number()),
      scope: Type.Optional(Type.String()), files: Type.Array(Type.Object({ path: Type.String(), content: Type.String() })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const root = requireProjectRoot(params.project_root || ctx.cwd);
        const files = params.files.map((file) => ({ path: file.path, content: file.content }));
        const result = applyNovelEvent(root, {
          eventType: params.event_type as NovelEventType,
          expectedStage: params.expected_stage as Stage,
          expectedProjectHash: params.expected_project_hash,
          files,
          ...(params.chapter !== undefined ? { chapter: params.chapter } : {}),
          ...(params.scope ? { scope: params.scope } : {}),
        });
        const text = `Applied ${params.event_type}.\nStage: ${result.stage}\nChanged: ${result.changed.join(", ")}\nProject hash: ${result.projectHash}\nGit: ${result.gitMessage}`;
        return { content: [{ type: "text", text }], details: result };
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Novel Forge event rejected: ${text}` }], details: { error: text } };
      }
    },
  });
  pi.registerCommand("novel-start", { description: "Create a compact standalone or series-capable thriller or romantasy project", handler: async (args, context) => { const supplied = tokens(args); const projectName = supplied.filter((item) => !item.startsWith("--") && !["thriller", "romantasy", "standalone", "planned-series", "open-ended-series"].includes(item)).join(" ") || await context.ui.input("Project name:", "my-novel"); if (!projectName) return; const profileInput = (flagValue(supplied, "--profile") || supplied.find((item) => ["thriller", "romantasy"].includes(item)) || await context.ui.select("Novel profile:", listProfiles().map((profile) => profile.id))) as ProfileId | undefined; if (!profileInput || !["thriller", "romantasy"].includes(profileInput)) return; const typeInput = (flagValue(supplied, "--type") || supplied.find((item) => ["standalone", "planned-series", "open-ended-series"].includes(item)) || await context.ui.select("Project type:", ["standalone", "planned-series", "open-ended-series"])) as ProjectType | undefined; if (!typeInput) return; const targetInput = flagValue(supplied, "--target-words") || await context.ui.input("Book 1 target words:", profileInput === "romantasy" ? "110000" : "100000"); const targetWords = Number.parseInt(targetInput ?? "100000", 10) || 100000; const root = initializeProject(context.cwd, { projectName, projectType: typeInput, profile: profileInput, targetWords }); refreshStatus(root); context.ui.notify(`Novel Forge project created at ${root}. Start with /novel-plan voice.`, "info"); } });
  pi.registerCommand("novel-status", { description: "Show Novel Forge stage, gates, blockers, word count, and next action", handler: async (_args, context) => { try { const root = requireProjectRoot(context.cwd); context.ui.notify(refreshStatus(root).markdown, "info"); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-plan", { description: "Build or repair voice, series, or active-book architecture", getArgumentCompletions: (prefix) => { const filtered = ["voice", "series", "book"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const items = tokens(args); if (items.includes("--add-book")) { const target = Number.parseInt(flagValue(items, "--target-words") ?? "100000", 10) || 100000; const bookId = addBook(root, target, { force: items.includes("--force") }); refreshStatus(root); context.ui.notify(`Created ${bookId} and made it active. Run /novel-plan book.`, "info"); return; } const prompt = planPromptFor(root, items[0] ?? ""); if (!context.isIdle()) pi.sendUserMessage(prompt, { deliverAs: "followUp" }); else pi.sendUserMessage(prompt); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-run", { description: "Advance safe work until a gate, blocker, or requested limit", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); sendDecision(pi, context, decideNextRun(root, parseRunOptions(args))); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-draft", { description: "Draft the next approved chapter packet with bounded context", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const chapter = Number.parseInt(tokens(args)[0] ?? "", 10); sendDecision(pi, context, directDraftDecision(root, Number.isFinite(chapter) ? chapter : undefined)); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-review", { description: "Review a chapter, act, manuscript, or series through profile-specific lanes", getArgumentCompletions: (prefix) => { const filtered = ["chapter", "act", "manuscript", "series"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const scope = tokens(args)[0] ?? "act"; assertReviewAllowed(readProject(root), scope); sendDecision(pi, context, { action: "review", prompt: reviewPrompt(root, scope), message: `Queued ${scope} review.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-readers", { description: "Prepare or record immediate and delayed real-reader evidence without rewriting prose", getArgumentCompletions: (prefix) => { const filtered = ["first-page", "first-chapter", "sample", "act", "manuscript", "record"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const project = readProject(root); assertOperationAllowed(project, "reader-test"); const scope = tokens(args)[0] ?? "sample"; sendDecision(pi, context, { action: "review", prompt: readerTestPrompt(root, scope), message: `Queued ${scope} reader-evidence workflow.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-revise", { description: "Apply open revision tickets with acceptance and regression checks", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); sendDecision(pi, context, directRevisionDecision(root, tokens(args).filter((item) => /^B\d+-T\d+$/i.test(item)))); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-package", { description: "Compile the active manuscript and prepare its editorial package", handler: async (_args, context) => { try { const root = requireProjectRoot(context.cwd); assertOperationAllowed(readProject(root), "package"); const compiled = compileActiveBook(root); sendDecision(pi, context, { action: "package", prompt: packagePrompt(root), message: `Compiled ${compiled.chapters} chapters and queued packaging.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-migrate", { description: "Administrative: migrate a Genesis v0.4 project into Novel Forge without deleting manuscript files", handler: async (args, context) => { try { const items = tokens(args); const profile = (items.find((item) => ["thriller", "romantasy"].includes(item)) || await context.ui.select("Profile for migrated project:", ["thriller", "romantasy"])) as ProfileId | undefined; if (!profile) return; const result = migrateGenesisProject(context.cwd, profile, { dryRun: items.includes("--dry-run"), force: items.includes("--force") }); if (result.dryRun) context.ui.notify(result.report, "info"); else { refreshStatus(result.root); context.ui.notify(`Migration complete. Review ${result.reportPath}.`, "info"); } } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
}
