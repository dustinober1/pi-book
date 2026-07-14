import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ProfileId, ProjectType, Stage } from "../domain/schemas.js";
import { listProfiles } from "../profiles/index.js";
import { initializeProject, requireProjectRoot, readProject } from "../project/store.js";
import { addBook } from "../project/add-book.js";
import { bookPlanPrompt, packagePrompt, readerTestPrompt, reviewPrompt, seriesPlanPrompt, voicePlanPrompt } from "../application/prompts.js";
import { approveProjectGate, decideNextRun, directDraftDecision, directRevisionDecision, rejectProjectGate, type RunDecision } from "../application/run.js";
import { compileActiveBook } from "../application/package.js";
import { migrateGenesisProject } from "../migration/genesis-v0.4.js";
import { assertOperationAllowed, assertReviewAllowed } from "../application/authorization.js";
import { applyNovelEvent, type NovelEventType } from "../application/events.js";
import { flagValue, parseRunOptions, tokens } from "./arguments.js";
import { buildGuideScreen, type GuideActionId } from "../application/guide.js";
import { gateDetail } from "../application/gate-metadata.js";
import { refreshGuidance } from "../application/handoff.js";
import { adoptManuscript } from "../application/adoption.js";
import { prepareReaderKit, importReaderResponses, type ReaderKitScope } from "../application/reader-kit.js";
import { buildPackagingChecklist, nextBookProposal } from "../application/package-checklist.js";
import { explainFirstBlocker, inspectUndo, runIntegritySummary, undoLastNovelEvent } from "../application/recovery.js";
import { upgradeProjectVersion } from "../application/version.js";

function sendDecision(pi: ExtensionAPI, context: ExtensionCommandContext, decision: RunDecision): void {
  if (!decision.prompt) {
    context.ui.notify(decision.message, decision.action === "blocked" ? "warning" : "info");
    return;
  }
  if (!context.isIdle()) {
    pi.sendUserMessage(decision.prompt, { deliverAs: "followUp" });
    context.ui.notify(decision.message, "info");
    return;
  }
  pi.sendUserMessage(decision.prompt);
}

function sendPrompt(pi: ExtensionAPI, context: ExtensionCommandContext, prompt: string, message: string): void {
  sendDecision(pi, context, { action: "guided", prompt, message });
}

function planPromptFor(root: string, requested: string): string {
  const project = readProject(root);
  const scope = requested || (project.current_stage === "voice-intake" ? "voice" : project.current_stage === "series-planning" ? "series" : "book");
  if (scope === "voice") { assertOperationAllowed(project, "plan-voice"); return voicePlanPrompt(root); }
  if (scope === "series") { assertOperationAllowed(project, "plan-series"); return seriesPlanPrompt(root); }
  if (scope === "book") { assertOperationAllowed(project, "plan-book"); return bookPlanPrompt(root); }
  throw new Error(`Unknown planning scope: ${scope}. Use voice, series, or book.`);
}

function formatChecklist(root: string): string {
  const checklist = buildPackagingChecklist(root);
  return [
    "# Packaging Checklist",
    "",
    ...checklist.items.map((item) => `${item.complete ? "✓" : item.blocking ? "✗" : "○"} ${item.label}: ${item.detail}`),
    "",
    checklist.summary,
  ].join("\n");
}

async function prepareReaderKitFromUi(root: string, context: ExtensionCommandContext, initialScope?: string): Promise<void> {
  const allowed: ReaderKitScope[] = ["first-page", "first-chapter", "sample", "act", "manuscript"];
  const scope = (initialScope && allowed.includes(initialScope as ReaderKitScope)
    ? initialScope
    : await context.ui.select("Reader-kit scope:", allowed)) as ReaderKitScope | undefined;
  if (!scope) return;
  const targetReader = await context.ui.input("Exact target-reader segment:", "core target readers");
  if (!targetReader) return;
  const minimumRaw = await context.ui.input("Minimum reader count:", "3");
  if (!minimumRaw) return;
  const delayRaw = await context.ui.input("Delayed follow-up hours (24–168):", "48");
  if (!delayRaw) return;
  let samplePath: string | undefined;
  if (["sample", "act", "manuscript"].includes(scope)) {
    samplePath = await context.ui.input("Existing sample path:");
    if (!samplePath) return;
  }
  const result = prepareReaderKit(root, {
    scope,
    targetReader,
    minimumReaderCount: Number.parseInt(minimumRaw, 10),
    delayedAfterHours: Number.parseInt(delayRaw, 10),
    ...(samplePath ? { samplePath } : {}),
  });
  context.ui.notify(`Prepared ${result.experimentId} in books/${readProject(root).active_book}/reader-kit.`, "info");
}

async function importReaderCsvFromUi(root: string, context: ExtensionCommandContext, experimentArg?: string, pathArg?: string): Promise<void> {
  const experimentId = experimentArg || await context.ui.input("Experiment ID:", "RE-001");
  if (!experimentId) return;
  const csvPath = pathArg || await context.ui.input("CSV path (blank uses the active reader kit):");
  const result = importReaderResponses(root, experimentId, csvPath || undefined);
  context.ui.notify(`Imported human responses for ${experimentId}. Changed: ${result.changed.join(", ")}`, "info");
}

async function guidedReaders(root: string, context: ExtensionCommandContext): Promise<void> {
  const choice = await context.ui.select("Reader evidence:", ["Prepare reader kit", "Import response CSV", "Cancel"]);
  if (choice === "Prepare reader kit") await prepareReaderKitFromUi(root, context);
  else if (choice === "Import response CSV") await importReaderCsvFromUi(root, context);
}

async function guidedAddBook(root: string, context: ExtensionCommandContext, force = false): Promise<void> {
  let proposal;
  try { proposal = nextBookProposal(root); }
  catch (error) {
    if (!force) throw error;
    const project = readProject(root);
    proposal = { bookId: "next book", previousBook: project.active_book, profile: project.default_profile, targetWords: 100000 };
  }
  const targetRaw = await context.ui.input(`Target words for ${proposal.bookId}:`, String(proposal.targetWords));
  if (!targetRaw) return;
  const targetWords = Number.parseInt(targetRaw, 10);
  if (!Number.isInteger(targetWords) || targetWords < 1000) throw new Error("Target words must be an integer of at least 1000.");
  const confirmed = await context.ui.confirm("Create next book", `Create ${proposal.bookId} after ${proposal.previousBook} with profile ${proposal.profile} and target ${targetWords} words?`);
  if (!confirmed) return;
  const bookId = addBook(root, targetWords, { force });
  context.ui.notify(`Created ${bookId}. Run /novel to begin its guided book plan.`, "info");
}

async function guidedAdoption(root: string, context: ExtensionCommandContext, suppliedPath?: string): Promise<void> {
  const sourcePath = suppliedPath || await context.ui.input("Existing manuscript file or chapter-directory path:");
  if (!sourcePath) return;
  const confirmed = await context.ui.confirm("Adopt manuscript", "Adopt this manuscript non-destructively? The source will remain unchanged and the active book must have no chapter files.");
  if (!confirmed) return;
  const result = adoptManuscript(root, sourcePath);
  context.ui.notify(`Adopted ${result.chapters} chapters (${result.words} words). Review ${result.reportPath}.`, "info");
}

async function guidedAdvanced(root: string, context: ExtensionCommandContext): Promise<void> {
  const choice = await context.ui.select("Advanced Novel Forge tools:", [
    "Explain current blocker",
    "Rebuild status and handoff",
    "Run integrity check",
    "Upgrade project metadata",
    "Undo last Novel Forge event",
    "Adopt an existing manuscript",
    "Force-add another book",
    "Cancel",
  ]);
  if (choice === "Explain current blocker") context.ui.notify(explainFirstBlocker(root), "info");
  else if (choice === "Rebuild status and handoff") context.ui.notify(refreshGuidance(root, { lastAction: "Rebuilt derived guidance" }).markdown, "info");
  else if (choice === "Run integrity check") context.ui.notify(runIntegritySummary(root), "info");
  else if (choice === "Upgrade project metadata") context.ui.notify(`Project metadata upgraded to Novel Forge ${upgradeProjectVersion(root)}.`, "info");
  else if (choice === "Adopt an existing manuscript") await guidedAdoption(root, context);
  else if (choice === "Force-add another book") {
    const confirmed = await context.ui.confirm("Force-add book", "Force-adding a book may preserve an unlocked previous book as superseded-by-force. Continue?");
    if (confirmed) await guidedAddBook(root, context, true);
  } else if (choice === "Undo last Novel Forge event") {
    const inspection = inspectUndo(root);
    if (!inspection.allowed) { context.ui.notify(inspection.reason, "warning"); return; }
    const confirmed = await context.ui.confirm("Undo Novel Forge event", `Create a revert commit for ${inspection.subject}?`);
    if (!confirmed) return;
    let allowApproval = false;
    if (inspection.approvalCheckpoint) {
      allowApproval = await context.ui.confirm("Reverse writer approval", "This reverses a recorded writer approval. Confirm approval reversal?");
      if (!allowApproval) return;
    }
    const result = undoLastNovelEvent(root, allowApproval);
    context.ui.notify(`Reverted ${result.originalSubject}.`, "info");
  }
}

function repairPrompt(root: string): string {
  const project = readProject(root);
  const gate = project.next_gate;
  if (!gate) throw new Error("No active gate requires repair.");
  const detail = gateDetail(gate);
  if (detail.repairScope === "voice") return voicePlanPrompt(root);
  if (detail.repairScope === "book") return bookPlanPrompt(root);
  if (detail.repairScope === "chapter") return reviewPrompt(root, "chapter");
  if (detail.repairScope === "act") return reviewPrompt(root, "act");
  if (detail.repairScope === "manuscript") return reviewPrompt(root, "manuscript");
  return packagePrompt(root);
}

async function guidedNovel(pi: ExtensionAPI, context: ExtensionCommandContext): Promise<void> {
  let root: string;
  try { root = requireProjectRoot(context.cwd); }
  catch { context.ui.notify("No Novel Forge project found. Run /novel-start first.", "warning"); return; }
  const screen = buildGuideScreen(root);
  const labels = screen.actions.map((action) => action.label);
  const selected = await context.ui.select(`${screen.title}\n${screen.summary}`, labels);
  if (!selected) return;
  const action = screen.actions.find((item) => item.label === selected);
  if (!action) return;
  const id: GuideActionId = action.id;
  if (id === "status") context.ui.notify(refreshGuidance(root).markdown, "info");
  else if (id === "view-evidence") context.ui.notify(["Evidence files:", ...screen.evidencePaths.map((path) => `- ${path}`)].join("\n"), "info");
  else if (id === "advanced") await guidedAdvanced(root, context);
  else if (id === "readers") await guidedReaders(root, context);
  else if (id === "add-book") await guidedAddBook(root, context);
  else if (id === "approve") {
    const gate = readProject(root).next_gate;
    if (!gate) throw new Error("No active gate is available for approval.");
    const confirmed = await context.ui.confirm("Approve gate", `Approve ${gateDetail(gate).title}? This records writer approval with an evidence hash.`);
    if (!confirmed) return;
    const note = await context.ui.input("Optional approval note:");
    sendDecision(pi, context, approveProjectGate(root, gate, note ?? ""));
  } else if (id === "request-changes") {
    const gate = readProject(root).next_gate;
    if (!gate) throw new Error("No active gate is available for rejection.");
    const note = await context.ui.input("What specifically must change?");
    if (!note) return;
    sendDecision(pi, context, rejectProjectGate(root, gate, note));
  } else if (id === "repair") sendPrompt(pi, context, repairPrompt(root), "Queued the active gate repair workflow.");
  else if (id === "continue") {
    if (readProject(root).current_stage === "packaging") {
      const checklist = buildPackagingChecklist(root);
      context.ui.notify(formatChecklist(root), checklist.ready ? "info" : "warning");
      if (!checklist.ready) return;
      const confirmed = await context.ui.confirm("Package active book", "Packaging prerequisites are complete. Compile and queue the editorial package?");
      if (!confirmed) return;
    }
    sendDecision(pi, context, decideNextRun(root));
  }
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
      expected_stage: Type.String(),
      expected_project_hash: Type.String(),
      chapter: Type.Optional(Type.Number()),
      scope: Type.Optional(Type.String()),
      files: Type.Array(Type.Object({ path: Type.String(), content: Type.String() })),
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

  pi.registerCommand("novel", { description: "Show the one recommended Novel Forge action and guided choices", handler: async (_args, context) => { try { await guidedNovel(pi, context); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-start", { description: "Create a compact standalone or series-capable thriller or romantasy project", handler: async (args, context) => {
    const supplied = tokens(args);
    const projectName = supplied.filter((item) => !item.startsWith("--") && !["thriller", "romantasy", "standalone", "planned-series", "open-ended-series"].includes(item)).join(" ") || await context.ui.input("Project name:", "my-novel");
    if (!projectName) return;
    const profileInput = (flagValue(supplied, "--profile") || supplied.find((item) => ["thriller", "romantasy"].includes(item)) || await context.ui.select("Novel profile:", listProfiles().map((profile) => profile.id))) as ProfileId | undefined;
    if (!profileInput || !["thriller", "romantasy"].includes(profileInput)) return;
    const typeInput = (flagValue(supplied, "--type") || supplied.find((item) => ["standalone", "planned-series", "open-ended-series"].includes(item)) || await context.ui.select("Project type:", ["standalone", "planned-series", "open-ended-series"])) as ProjectType | undefined;
    if (!typeInput) return;
    const targetInput = flagValue(supplied, "--target-words") || await context.ui.input("Book 1 target words:", profileInput === "romantasy" ? "110000" : "100000");
    const targetWords = Number.parseInt(targetInput ?? "100000", 10) || 100000;
    const root = initializeProject(context.cwd, { projectName, projectType: typeInput, profile: profileInput, targetWords });
    refreshGuidance(root, { lastAction: "Initialized project" });
    context.ui.notify(`Novel Forge project created at ${root}. Run /novel.`, "info");
  } });
  pi.registerCommand("novel-status", { description: "Show Novel Forge decisions, blockers, warnings, progress, and next action", handler: async (_args, context) => { try { const root = requireProjectRoot(context.cwd); context.ui.notify(refreshGuidance(root).markdown, "info"); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-plan", { description: "Build or repair voice, series, or active-book architecture", getArgumentCompletions: (prefix) => { const filtered = ["voice", "series", "book"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const items = tokens(args); if (items.includes("--add-book")) { const target = Number.parseInt(flagValue(items, "--target-words") ?? "100000", 10) || 100000; const bookId = addBook(root, target, { force: items.includes("--force") }); context.ui.notify(`Created ${bookId} and made it active. Run /novel.`, "info"); return; } const prompt = planPromptFor(root, items[0] ?? ""); if (!context.isIdle()) pi.sendUserMessage(prompt, { deliverAs: "followUp" }); else pi.sendUserMessage(prompt); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-run", { description: "Advance safe work until a gate, blocker, or requested limit", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); sendDecision(pi, context, decideNextRun(root, parseRunOptions(args))); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-draft", { description: "Draft the next approved chapter packet with bounded context", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const chapter = Number.parseInt(tokens(args)[0] ?? "", 10); sendDecision(pi, context, directDraftDecision(root, Number.isFinite(chapter) ? chapter : undefined)); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-review", { description: "Review a chapter, act, manuscript, or series through profile-specific lanes", getArgumentCompletions: (prefix) => { const filtered = ["chapter", "act", "manuscript", "series"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const scope = tokens(args)[0] ?? "act"; assertReviewAllowed(readProject(root), scope); sendDecision(pi, context, { action: "review", prompt: reviewPrompt(root, scope), message: `Queued ${scope} review.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-readers", { description: "Prepare reader kits, import human response CSVs, or run the reader-evidence prompt", getArgumentCompletions: (prefix) => { const filtered = ["kit", "import", "first-page", "first-chapter", "sample", "act", "manuscript", "record"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })); return filtered.length ? filtered : null; }, handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const items = tokens(args); if (items[0] === "kit") { await prepareReaderKitFromUi(root, context, items[1]); return; } if (items[0] === "import") { await importReaderCsvFromUi(root, context, items[1], items.slice(2).join(" ") || undefined); return; } const project = readProject(root); assertOperationAllowed(project, "reader-test"); const scope = items[0] ?? "sample"; sendDecision(pi, context, { action: "review", prompt: readerTestPrompt(root, scope), message: `Queued ${scope} reader-evidence workflow.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-revise", { description: "Apply open revision tickets with acceptance and regression checks", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); sendDecision(pi, context, directRevisionDecision(root, tokens(args).filter((item) => /^B\d+-T\d+$/i.test(item)))); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-package", { description: "Compile the active manuscript and prepare its editorial package", handler: async (_args, context) => { try { const root = requireProjectRoot(context.cwd); assertOperationAllowed(readProject(root), "package"); const checklist = buildPackagingChecklist(root); context.ui.notify(formatChecklist(root), checklist.ready ? "info" : "warning"); if (!checklist.ready) return; const compiled = compileActiveBook(root); sendDecision(pi, context, { action: "package", prompt: packagePrompt(root), message: `Compiled ${compiled.chapters} chapters and queued packaging.` }); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-adopt", { description: "Administratively adopt an existing Markdown or text manuscript without changing the source", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); await guidedAdoption(root, context, tokens(args).join(" ") || undefined); } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
  pi.registerCommand("novel-migrate", { description: "Administrative: migrate a Genesis v0.4 project into Novel Forge without deleting manuscript files", handler: async (args, context) => { try { const items = tokens(args); const profile = (items.find((item) => ["thriller", "romantasy"].includes(item)) || await context.ui.select("Profile for migrated project:", ["thriller", "romantasy"])) as ProfileId | undefined; if (!profile) return; const result = migrateGenesisProject(context.cwd, profile, { dryRun: items.includes("--dry-run"), force: items.includes("--force") }); if (result.dryRun) context.ui.notify(result.report, "info"); else { refreshGuidance(result.root, { lastAction: "Migrated Genesis project" }); context.ui.notify(`Migration complete. Review ${result.reportPath} and run /novel.`, "info"); } } catch (error) { context.ui.notify(error instanceof Error ? error.message : String(error), "warning"); } } });
}