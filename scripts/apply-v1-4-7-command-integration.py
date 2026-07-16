from pathlib import Path

root = Path('.')

# Add new autopilot targets to run parsing.
path = root / 'src/pi/arguments.ts'
text = path.read_text(encoding='utf-8')
text = text.replace(
    '["first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-review", "next-milestone"]',
    '["voice-approval", "book-plan-approval", "first-chapter-approval", "act-1-review", "midpoint-review", "pre-final-act-review", "manuscript-review", "next-milestone"]',
)
path.write_text(text, encoding='utf-8')

# Extend the Pi entry point.
path = root / 'src/pi/extension.ts'
text = path.read_text(encoding='utf-8')
anchor = 'import { normalizeEventRejection, rejectionInstruction } from "../application/event-rejection.js";\n'
addition = 'import { bootstrapProjectFromBrief } from "../application/brief-bootstrap.js";\nimport { beginAutopilotRun } from "../application/autopilot.js";\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('extension import anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
start = text.index('  pi.registerCommand("novel-start",')
end = text.index('  pi.registerCommand("novel-status",', start)
replacement = '''  pi.registerCommand("novel-start", { description: "Create a project from an idea or authorized brief and optionally auto-advance to the next writer gate", handler: async (args, context) => {
    const supplied = tokens(args);
    const flagsWithValues = new Set(["--profile", "--type", "--target-words", "--brief", "--auto-to"]);
    const positional: string[] = [];
    for (let index = 0; index < supplied.length; index += 1) {
      const item = supplied[index]!;
      if (flagsWithValues.has(item)) { index += 1; continue; }
      if (!item.startsWith("--")) positional.push(item);
    }
    const projectName = positional.filter((item) => !["thriller", "romantasy", "standalone", "planned-series", "open-ended-series"].includes(item)).join(" ") || await context.ui.input("Project name:", "my-novel");
    if (!projectName) return;
    const profileInput = (flagValue(supplied, "--profile") || supplied.find((item) => ["thriller", "romantasy"].includes(item)) || await context.ui.select("Novel profile:", listProfiles().map((profile) => profile.id))) as ProfileId | undefined;
    if (!profileInput || !["thriller", "romantasy"].includes(profileInput)) return;
    const typeInput = (flagValue(supplied, "--type") || supplied.find((item) => ["standalone", "planned-series", "open-ended-series"].includes(item)) || await context.ui.select("Project type:", ["standalone", "planned-series", "open-ended-series"])) as ProjectType | undefined;
    if (!typeInput) return;
    const targetInput = flagValue(supplied, "--target-words") || await context.ui.input("Book 1 target words:", profileInput === "romantasy" ? "110000" : "100000");
    const targetWords = Number.parseInt(targetInput ?? "100000", 10) || 100000;
    const root = initializeProject(context.cwd, { projectName, projectType: typeInput, profile: profileInput, targetWords });
    const briefPath = flagValue(supplied, "--brief");
    if (briefPath) bootstrapProjectFromBrief(root, briefPath, { profile: profileInput, targetWords });
    refreshGuidance(root, { lastAction: briefPath ? "Initialized project from authorized brief" : "Initialized project" });
    const autoTo = flagValue(supplied, "--auto-to");
    if (autoTo) {
      sendDecision(pi, context, beginAutopilotRun(root, { target: autoTo, maxChapters: readProject(root).automation.max_chapters_per_run }));
      context.ui.notify(`Novel Forge project created at ${root}. Autopilot stops at ${autoTo} or the next required writer decision.`, "info");
    } else context.ui.notify(`Novel Forge project created at ${root}. Run /novel.`, "info");
  } });
'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')

# Make persistent resume respect premise-generation and selection boundaries.
path = root / 'src/application/run.ts'
text = path.read_text(encoding='utf-8')
text = text.replace(
    'import { automationDraftPrompt, bookPlanPrompt, canonLockPrompt, draftPrompt, packagePrompt, queuePrompt, reviewPrompt, revisionPrompt, seriesPlanPrompt, voicePlanPrompt } from "./prompts.js";',
    'import { automationDraftPrompt, bookPlanPrompt, canonLockPrompt, draftPrompt, packagePrompt, premisePlanPrompt, queuePrompt, reviewPrompt, revisionPrompt, seriesPlanPrompt, voicePlanPrompt } from "./prompts.js";',
)
anchor = 'import { cancelAutomationRun, pauseAutomationRun, resumeAutomationRun, startAutomationRun } from "./automation-run.js";\n'
addition = 'import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";\nimport { parseYaml } from "../infrastructure/yaml.js";\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('run import anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
old = '''  const run = updated.automation.active_run!;
  const decision = decideNextRun(root, { until: run.target, maxChapters: run.requestedMaxChapters });
  return { ...decision, message: `${decision.message} Resumed ${run.id}.` };
'''
new = '''  const run = updated.automation.active_run!;
  let decision: RunDecision;
  if (updated.current_stage === "book-planning") {
    const book = readBook(root);
    const path = join(root, "books", book.book_id, "premise-lab.yaml");
    const text = readText(path);
    const lab = text ? parseYaml<PremiseLab>(text, PremiseLabSchema, path) : null;
    if (lab && lab.variants.length === 0) decision = { action: "premise-plan", prompt: premisePlanPrompt(root), message: "Queued premise comparison before book architecture." };
    else if (lab && (!lab.selected_variant_id || !lab.selection_decision_id)) decision = { action: "premise-selection", prompt: null, message: "Automation stopped so the writer can select a premise variant." };
    else decision = decideNextRun(root, { until: run.target, maxChapters: run.requestedMaxChapters });
  } else decision = decideNextRun(root, { until: run.target, maxChapters: run.requestedMaxChapters });
  return { ...decision, message: `${decision.message} Resumed ${run.id}.` };
'''
if old not in text:
    raise RuntimeError('resume decision anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
