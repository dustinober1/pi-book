from pathlib import Path

root = Path('.')

# Extension imports and command routing.
path = root / 'src/pi/extension.ts'
text = path.read_text(encoding='utf-8')
old = 'import { approveProjectGate, decideNextRun, directDraftDecision, directRevisionDecision, rejectProjectGate, type RunDecision } from "../application/run.js";'
new = 'import { approveProjectGate, beginPersistentRun, cancelPersistentRun, decideNextRun, directDraftDecision, directRevisionDecision, pausePersistentRun, rejectProjectGate, resumePersistentRun, type RunDecision } from "../application/run.js";'
if old not in text:
    raise RuntimeError('extension run import anchor missing')
text = text.replace(old, new, 1)
old = '  else if (id === "research") await openWizard(root, context, "research");\n'
new = old + '  else if (id === "resume-run") sendDecision(pi, context, resumePersistentRun(root));\n  else if (id === "pause-run") sendDecision(pi, context, pausePersistentRun(root));\n  else if (id === "cancel-run") sendDecision(pi, context, cancelPersistentRun(root));\n'
if 'id === "resume-run"' not in text:
    if old not in text:
        raise RuntimeError('guided action anchor missing')
    text = text.replace(old, new, 1)
old = '  pi.registerCommand("novel-run", { description: "Advance safe work until a gate, blocker, or requested limit", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); sendDecision(pi, context, decideNextRun(root, parseRunOptions(args))); } catch (error) { context.ui.notify(errorText(error), "warning"); } } });'
new = '  pi.registerCommand("novel-run", { description: "Start, resume, pause, or cancel persistent safe work until a gate, blocker, or requested limit", handler: async (args, context) => { try { const root = requireProjectRoot(context.cwd); const options = parseRunOptions(args); const decision = options.resume ? resumePersistentRun(root) : options.pause ? pausePersistentRun(root) : options.cancel ? cancelPersistentRun(root) : (options.until || options.maxChapters) ? beginPersistentRun(root, { target: options.until ?? "next-milestone", maxChapters: options.maxChapters ?? readProject(root).automation.max_chapters_per_run }) : decideNextRun(root, options); sendDecision(pi, context, decision); } catch (error) { context.ui.notify(errorText(error), "warning"); } } });'
if old not in text:
    raise RuntimeError('novel-run command anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Handoff run section.
path = root / 'src/application/handoff.ts'
text = path.read_text(encoding='utf-8')
anchor = 'import type { BookState, ProjectState } from "../domain/schemas.js";\n'
addition = 'import type { ProjectStateV14 } from "../domain/v1-4-project-schema.js";\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('handoff import anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
anchor = '''  const protectedFacts = [
    `${project.approvals.length} writer approval${project.approvals.length === 1 ? "" : "s"} recorded`,
    book.canon_locked ? `${book.book_id} canon is locked` : `${book.book_id} canon remains provisional`,
    `Current workflow stage is ${project.current_stage}`,
  ];
  const continuation = [
'''
replacement = '''  const protectedFacts = [
    `${project.approvals.length} writer approval${project.approvals.length === 1 ? "" : "s"} recorded`,
    book.canon_locked ? `${book.book_id} canon is locked` : `${book.book_id} canon remains provisional`,
    `Current workflow stage is ${project.current_stage}`,
  ];
  const run = (project as ProjectStateV14).automation.active_run;
  const runLines = run ? [
    `- Run: ${run.id}`,
    `- Status: ${run.status}`,
    `- Target: ${run.target}`,
    `- Current action: ${run.currentAction}`,
    `- Progress: ${run.completedEventKeys.length} completed event${run.completedEventKeys.length === 1 ? "" : "s"}`,
    `- Stop reason: ${run.stopReason ?? "none"}`,
    ...(run.status === "paused" ? ["- Exact resume command: `/novel-run --resume`"] : []),
    ...(run.status === "active" ? ["- Pause command: `/novel-run --pause`"] : []),
  ] : [];
  const continuation = [
'''
if anchor not in text:
    raise RuntimeError('handoff run anchor missing')
text = text.replace(anchor, replacement, 1)
anchor = '''    `- Manuscript words: ${book.actual_words}`,
    "",
    "## Locked and protected state",
'''
replacement = '''    `- Manuscript words: ${book.actual_words}`,
    ...(runLines.length ? ["", "## Automation run", "", ...runLines] : []),
    "",
    "## Locked and protected state",
'''
if anchor not in text:
    raise RuntimeError('handoff output anchor missing')
path.write_text(text.replace(anchor, replacement, 1), encoding='utf-8')

# Explicit null for newly initialized projects without changing the legacy ProjectState type.
path = root / 'src/project/templates.ts'
text = path.read_text(encoding='utf-8')
anchor = '  };\n  return {\n    "PROJECT.yaml": stringifyYaml(project),\n'
replacement = '  };\n  (project.automation as typeof project.automation & { active_run: null }).active_run = null;\n  return {\n    "PROJECT.yaml": stringifyYaml(project),\n'
if 'active_run: null }).active_run' not in text:
    if anchor not in text:
        raise RuntimeError('template project return anchor missing')
    text = text.replace(anchor, replacement, 1)
path.write_text(text, encoding='utf-8')

# Test typing and legacy expectations.
path = root / 'tests/automation-run.test.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('import { ProjectSchema, type ProjectState } from "../src/domain/schemas.js";', 'import { ProjectV14Schema, type ProjectStateV14 } from "../src/domain/v1-4-project-schema.js";')
text = text.replace('function project(): ProjectState {', 'function project(): ProjectStateV14 {')
text = text.replace('    return readProject(root);', '    return readProject(root) as ProjectStateV14;', 1)
text = text.replace('  const legacy = structuredClone(value) as ProjectState & { automation: Record<string, unknown> };', '  const legacy = structuredClone(value) as ProjectStateV14 & { automation: Record<string, unknown> };')
text = text.replace('parseYaml(stringifyYaml(legacy), ProjectSchema, "PROJECT.yaml")', 'parseYaml(stringifyYaml(legacy), ProjectV14Schema, "PROJECT.yaml")')
path.write_text(text, encoding='utf-8')

path = root / 'tests/e2e/automation-resume.test.ts'
text = path.read_text(encoding='utf-8')
anchor = 'import { initializeProject, readBook, readProject } from "../../src/project/store.js";\n'
addition = 'import type { ProjectStateV14 } from "../../src/domain/v1-4-project-schema.js";\n'
if addition not in text:
    text = text.replace(anchor, anchor + addition, 1)
if 'function activeRun(root: string)' not in text:
    marker = 'function setup() {\n'
    helper = 'function activeRun(root: string) { return (readProject(root) as ProjectStateV14).automation.active_run; }\n\n'
    text = text.replace(marker, helper + marker, 1)
text = text.replace('readProject(root).automation.active_run', 'activeRun(root)')
path.write_text(text, encoding='utf-8')

path = root / 'tests/run-options.test.ts'
text = path.read_text(encoding='utf-8')
old = '''    maxChapters: 3,
    until: "midpoint-review",
    noProse: true,
'''
new = '''    maxChapters: 3,
    until: "midpoint-review",
    resume: false,
    pause: false,
    cancel: false,
    noProse: true,
'''
if old not in text:
    raise RuntimeError('run-options expected object anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
