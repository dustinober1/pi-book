import type { ProfileId, ProjectType } from "../domain/schemas.js";
import { listProfiles } from "../profiles/index.js";
import { initializeProject, requireProjectRoot, readProject } from "../project/store.js";
import { addBook } from "../project/add-book.js";
import { refreshStatus } from "../application/status.js";
import { bookPlanPrompt, packagePrompt, reviewPrompt, seriesPlanPrompt, voicePlanPrompt } from "../application/prompts.js";
import { decideNextRun, directDraftDecision, directRevisionDecision, type RunDecision, type RunOptions } from "../application/run.js";
import { compileActiveBook } from "../application/package.js";
import { migrateGenesisProject } from "../migration/genesis-v0.4.js";
import type { PiCommandContext, PiExtensionApi } from "./types.js";

function sendDecision(pi: PiExtensionApi, context: PiCommandContext, decision: RunDecision): void {
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

function tokens(args: string): string[] {
  return args.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^['"]|['"]$/g, "")) ?? [];
}

function flagValue(items: string[], flag: string): string | undefined {
  const index = items.indexOf(flag);
  return index >= 0 ? items[index + 1] : undefined;
}

function parseRunOptions(args: string): RunOptions {
  const items = tokens(args);
  const approve = flagValue(items, "--approve");
  const until = flagValue(items, "--until");
  const max = Number.parseInt(flagValue(items, "--max-chapters") ?? "", 10);
  return {
    ...(approve ? { approve } : {}),
    ...(until ? { until } : {}),
    ...(Number.isFinite(max) ? { maxChapters: max } : {}),
    noProse: items.includes("--no-prose"),
    reviewOnly: items.includes("--review-only"),
    stopOnWarning: items.includes("--stop-on-warning"),
  };
}

function planPromptFor(root: string, requested: string): string {
  const project = readProject(root);
  const scope = requested || (project.current_stage === "voice-intake" ? "voice" : project.current_stage === "series-planning" ? "series" : "book");
  if (scope === "voice") return voicePlanPrompt(root);
  if (scope === "series") return seriesPlanPrompt(root);
  if (scope === "book") return bookPlanPrompt(root);
  throw new Error(`Unknown planning scope: ${scope}. Use voice, series, or book.`);
}

export function registerNovelForge(pi: PiExtensionApi): void {
  pi.registerCommand("novel-start", {
    description: "Create a compact standalone or series-capable thriller or romantasy project",
    handler: async (args, context) => {
      const supplied = tokens(args);
      const projectName = supplied.filter((item) => !item.startsWith("--") && !["thriller", "romantasy", "standalone", "planned-series", "open-ended-series"].includes(item)).join(" ")
        || await context.ui.input("Project name:", "my-novel");
      if (!projectName) return;
      const profileInput = (flagValue(supplied, "--profile") || supplied.find((item) => ["thriller", "romantasy"].includes(item))
        || await context.ui.select("Novel profile:", listProfiles().map((profile) => profile.id))) as ProfileId | undefined;
      if (!profileInput || !["thriller", "romantasy"].includes(profileInput)) return;
      const typeInput = (flagValue(supplied, "--type") || supplied.find((item) => ["standalone", "planned-series", "open-ended-series"].includes(item))
        || await context.ui.select("Project type:", ["standalone", "planned-series", "open-ended-series"])) as ProjectType | undefined;
      if (!typeInput) return;
      const targetInput = flagValue(supplied, "--target-words") || await context.ui.input("Book 1 target words:", profileInput === "romantasy" ? "110000" : "100000");
      const targetWords = Number.parseInt(targetInput ?? "100000", 10) || 100000;
      const root = initializeProject(context.cwd, { projectName, projectType: typeInput, profile: profileInput, targetWords });
      refreshStatus(root);
      context.ui.notify(`Novel Forge project created at ${root}. Start with /novel-plan voice.`, "info");
    },
  });

  pi.registerCommand("novel-status", {
    description: "Show Novel Forge stage, gates, blockers, word count, and next action",
    handler: async (_args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        context.ui.notify(refreshStatus(root).markdown, "info");
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-plan", {
    description: "Build or repair voice, series, or active-book architecture",
    getArgumentCompletions: (prefix) => ["voice", "series", "book"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })) || null,
    handler: async (args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        const items = tokens(args);
        if (items.includes("--add-book")) {
          const target = Number.parseInt(flagValue(items, "--target-words") ?? "100000", 10) || 100000;
          const bookId = addBook(root, target);
          refreshStatus(root);
          context.ui.notify(`Created ${bookId} and made it active. Run /novel-plan book.`, "info");
          return;
        }
        const prompt = planPromptFor(root, items[0] ?? "");
        if (!context.isIdle()) pi.sendUserMessage(prompt, { deliverAs: "followUp" }); else pi.sendUserMessage(prompt);
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-run", {
    description: "Advance safe work until a gate, blocker, or requested limit",
    handler: async (args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        sendDecision(pi, context, decideNextRun(root, parseRunOptions(args)));
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-draft", {
    description: "Draft the next approved chapter packet with bounded context",
    handler: async (args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        const chapter = Number.parseInt(tokens(args)[0] ?? "", 10);
        sendDecision(pi, context, directDraftDecision(root, Number.isFinite(chapter) ? chapter : undefined));
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-review", {
    description: "Review a chapter, act, manuscript, or series through profile-specific lanes",
    getArgumentCompletions: (prefix) => ["chapter", "act", "manuscript", "series"].filter((item) => item.startsWith(prefix)).map((value) => ({ value, label: value })) || null,
    handler: async (args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        const scope = tokens(args)[0] ?? "current milestone";
        const decision: RunDecision = { action: "review", prompt: reviewPrompt(root, scope), message: `Queued ${scope} review.` };
        sendDecision(pi, context, decision);
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-revise", {
    description: "Apply open revision tickets with acceptance and regression checks",
    handler: async (args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        sendDecision(pi, context, directRevisionDecision(root, tokens(args).filter((item) => /^B\d+-T\d+$/i.test(item))));
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-package", {
    description: "Compile the active manuscript and prepare its editorial package",
    handler: async (_args, context) => {
      try {
        const root = requireProjectRoot(context.cwd);
        const compiled = compileActiveBook(root);
        const decision: RunDecision = { action: "package", prompt: packagePrompt(root), message: `Compiled ${compiled.chapters} chapters and queued packaging.` };
        sendDecision(pi, context, decision);
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });

  pi.registerCommand("novel-migrate", {
    description: "Administrative: migrate a Genesis v0.4 project into Novel Forge without deleting manuscript files",
    handler: async (args, context) => {
      try {
        const profile = (tokens(args)[0] || await context.ui.select("Profile for migrated project:", ["thriller", "romantasy"])) as ProfileId | undefined;
        if (!profile || !["thriller", "romantasy"].includes(profile)) return;
        const result = migrateGenesisProject(context.cwd, profile);
        refreshStatus(result.root);
        context.ui.notify(`Migration complete. Review ${result.reportPath}.`, "info");
      } catch (error) {
        context.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      }
    },
  });
}
