import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";

type Blocker = {
  file: string;
  label: string;
  evidence: string;
  suggestion: string;
  severity: "blocker" | "warning";
};

const PHASES = [
  "Phase 0: Intake",
  "Phase 1: Foundation",
  "Phase 2: Architecture",
  "Phase 3: Drafting",
  "Phase 4: Adversarial Audit",
  "Phase 5: Final Score",
  "Phase 6: Editorial Package",
];

const REQUIRED_FILES = [
  "PROJECT_STATE.yaml",
  "ASSUMPTIONS.md",
  "artifacts/00-brief.md",
  "artifacts/01-market-map.md",
  "artifacts/02-story-engine.md",
  "artifacts/author-intent.md",
  "artifacts/taste-profile.md",
  "artifacts/risk-budget.md",
  "artifacts/discarded-choices.md",
  "artifacts/review-personas.md",
  "artifacts/03-characters.md",
  "artifacts/04-theme.md",
  "artifacts/voice-bible.md",
  "artifacts/author-voice-fingerprint.md",
  "artifacts/human-source-bank.md",
  "artifacts/name-collision-audit.md",
  "artifacts/name-entity-filter.md",
  "artifacts/06-emotional-curve.md",
  "artifacts/05-outline.md",
  "artifacts/causality-chain.md",
  "artifacts/scene-embodiment-map.md",
  "artifacts/05-subplot-map.md",
  "artifacts/continuity-ledger.md",
  "artifacts/reader-promise-tracker.md",
  "artifacts/drift-loop-alarm.md",
  "artifacts/07-opening-strategy.md",
  "artifacts/human-specificity-ledger.md",
  "artifacts/subtext-audit.md",
  "artifacts/ear-pass.md",
  "artifacts/over-polish-audit.md",
  "evaluations/chapter-scorecards.md",
  "artifacts/08-adversarial-audit.md",
  "artifacts/narrative-fingerprint-audit.md",
  "artifacts/ai-tell-mitigation-audit.md",
  "artifacts/negative-capability-audit.md",
  "artifacts/revision-philosophy.md",
  "artifacts/revision-tickets.md",
  "artifacts/09-genesis-score.md",
  "artifacts/10-editorial-package.md",
  "artifacts/reader-response-plan.md",
  "artifacts/beta-feedback-log.md",
  "artifacts/positioning-strategy.md",
];

const BLOCKER_CHECKS: Array<{
  file: string;
  label: string;
  pattern: RegExp;
  suggestion: string;
  severity?: "blocker" | "warning";
}> = [
  {
    file: "artifacts/drift-loop-alarm.md",
    label: "Active drift-loop hard stop",
    pattern: /active hard stop|hard stop\s*:\s*active|status\s*:\s*active/i,
    suggestion: "Resolve the repeated-shape or no-state-change evidence before advancing.",
  },
  {
    file: "artifacts/revision-tickets.md",
    label: "Open blocker/high revision tickets",
    pattern: /severity\s*:\s*(blocker|high)|\b(blocker|high)\b[\s\S]{0,160}\bstatus\s*:\s*open/i,
    suggestion: "Close, defer with rationale, or repair blocker/high tickets before moving forward.",
  },
  {
    file: "artifacts/ai-tell-mitigation-audit.md",
    label: "Unresolved AI-tell risk",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair the underlying prose habit, not just punctuation or banned words.",
  },
  {
    file: "artifacts/author-voice-fingerprint.md",
    label: "Author-voice blocker",
    pattern: /missing|not-me violation|blocker|unresolved/i,
    suggestion: "Update the fingerprint and revise prose so it sounds like the actual author, not generic competence.",
  },
  {
    file: "artifacts/name-collision-audit.md",
    label: "Name-collision blocker",
    pattern: /blocker|web_blocked|high-risk|unresolved/i,
    suggestion: "Replace or verify risky names with web-backed evidence before finalizing them.",
  },
  {
    file: "artifacts/subtext-audit.md",
    label: "Subtext blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair scenes that explain themselves too directly.",
  },
  {
    file: "artifacts/ear-pass.md",
    label: "Read-aloud rhythm blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Repair repeated sentence shapes, assistant-like exposition, and dead segues.",
  },
  {
    file: "artifacts/over-polish-audit.md",
    label: "Over-polish blocker",
    pattern: /blocker|unresolved/i,
    suggestion: "Restore controlled roughness, implication, and character-shaped edges.",
  },
  {
    file: "artifacts/risk-budget.md",
    label: "Accidental-risk blocker",
    pattern: /blocker|unresolved|accidental risk/i,
    suggestion: "Separate intentional risk from accidental weakness before continuing.",
    severity: "warning",
  },
  {
    file: "artifacts/negative-capability-audit.md",
    label: "Negative-capability blocker",
    pattern: /blocker|unresolved|false opacity/i,
    suggestion: "Protect earned ambiguity while removing empty vagueness.",
  },
  {
    file: "artifacts/scene-embodiment-map.md",
    label: "Disembodied-scene blocker",
    pattern: /blocker|disembodied|unresolved/i,
    suggestion: "Add physical action, object pressure, interruption, or practical stakes.",
  },
];

function findProjectRoot(cwd: string): string {
  let dir = cwd;
  while (true) {
    if (existsSync(join(dir, "PROJECT_STATE.yaml")) || existsSync(join(dir, "artifacts"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return cwd;
    dir = parent;
  }
}

function readIfExists(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function detectPhase(state: string | null): string {
  if (!state) return "unknown: PROJECT_STATE.yaml not found";
  for (const phase of PHASES) {
    if (state.includes(phase)) return phase;
  }
  const match = state.match(/(?:current_phase|phase|label)\s*:\s*["']?([^"'\n]+)["']?/i);
  return match?.[1]?.trim() || "unknown: could not detect phase from PROJECT_STATE.yaml";
}

function missingRequired(root: string): string[] {
  return REQUIRED_FILES.filter((file) => !existsSync(join(root, file)));
}

function extractEvidence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match || match.index == null) return "pattern matched but no snippet available";
  const start = Math.max(0, match.index - 80);
  const end = Math.min(text.length, match.index + (match[0]?.length ?? 0) + 160);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function collectBlockers(root: string, includeMissing = true): Blocker[] {
  const blockers: Blocker[] = [];

  for (const check of BLOCKER_CHECKS) {
    const text = readIfExists(join(root, check.file));
    if (!text || !check.pattern.test(text)) continue;
    blockers.push({
      file: check.file,
      label: check.label,
      evidence: extractEvidence(text, check.pattern),
      suggestion: check.suggestion,
      severity: check.severity ?? "blocker",
    });
  }

  if (includeMissing) {
    for (const file of missingRequired(root).slice(0, 12)) {
      blockers.push({
        file,
        label: "Missing required output",
        evidence: `${file} does not exist in the project root.`,
        suggestion: "Create the missing required file or document why the project state is intentionally paused.",
        severity: "warning",
      });
    }
  }

  return blockers;
}

function blockerSummary(root: string): string[] {
  return collectBlockers(root, false).map((blocker) => blocker.file);
}

function renderBlockers(root: string, includeMissing = true): string {
  const blockers = collectBlockers(root, includeMissing);
  if (!blockers.length) return "No blockers detected by Genesis triage.";

  return blockers
    .map(
      (blocker, index) =>
        `${index + 1}. [${blocker.severity}] ${blocker.label}\n   file: ${blocker.file}\n   evidence: ${blocker.evidence}\n   suggested action: ${blocker.suggestion}`,
    )
    .join("\n\n");
}

function findGenesisProjects(startDir: string, maxDepth = 3): string[] {
  const found = new Set<string>();

  function walk(dir: string, depth: number): void {
    if (existsSync(join(dir, "PROJECT_STATE.yaml")) || existsSync(join(dir, "artifacts"))) {
      found.add(dir);
    }
    if (depth >= maxDepth) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      walk(join(dir, entry.name), depth + 1);
    }
  }

  try {
    walk(startDir, 0);
  } catch {
    return [];
  }

  return [...found].sort();
}

function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "genesis-project";
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function writeIfMissing(path: string, content: string): void {
  if (!existsSync(path)) writeFileSync(path, content, "utf8");
}

function initializeProject(root: string, projectName: string, idea: string): void {
  ensureDir(root);
  ensureDir(join(root, "artifacts"));
  ensureDir(join(root, "manuscript", "chapters"));
  ensureDir(join(root, "evaluations"));
  ensureDir(join(root, "delivery"));

  writeIfMissing(
    join(root, "PROJECT_STATE.yaml"),
    [
      `project_name: ${JSON.stringify(projectName)}`,
      `current_phase: ${JSON.stringify("Phase 0: Intake")}`,
      'phase_gate: "intake"',
      'status: "initialized"',
      'language: "unknown"',
      'project_root_initialized_by: "genesis-init"',
      'next_required_outputs:',
      '  - "ASSUMPTIONS.md"',
      '  - "artifacts/00-brief.md"',
      '  - "artifacts/01-market-map.md"',
      '  - "artifacts/02-story-engine.md"',
      '  - "artifacts/author-intent.md"',
      '  - "artifacts/taste-profile.md"',
      '  - "artifacts/risk-budget.md"',
      '  - "artifacts/discarded-choices.md"',
      '  - "artifacts/review-personas.md"',
      'notes: []',
      '',
    ].join("\n"),
  );

  writeIfMissing(
    join(root, "ASSUMPTIONS.md"),
    `# Assumptions\n\n## Explicit user input\n\n- Project: ${projectName}\n- Seed idea: ${idea || "Not provided yet."}\n\n## Inferred assumptions\n\n- Language: unknown\n- Genre: unknown\n- Audience: unknown\n- Target length: unknown\n- Narrative mode: unknown\n\nMark each assumption as confirmed, provisional, or rejected during Phase 0.\n`,
  );

  writeIfMissing(
    join(root, "artifacts", "00-brief.md"),
    `# Brief\n\n## Original idea\n\n${idea || "Add the writer's seed idea here."}\n\n## Intake scaffold\n\n- Language:\n- Genre:\n- Audience:\n- Target length:\n- Narrative mode:\n- Reader promise:\n`,
  );

  writeIfMissing(join(root, "artifacts", "01-market-map.md"), "# Market Map\n\n- market signals\n- comp titles\n- recurring patterns\n- whitespace opportunity\n");
  writeIfMissing(join(root, "artifacts", "02-story-engine.md"), "# Story Engine\n\n- premise expansion\n- central conflict\n- escalation logic\n- differentiation strategy\n");
  writeIfMissing(join(root, "artifacts", "author-intent.md"), "# Author Intent\n\n- why this book matters\n- what must not be changed\n- reader experience goals\n- intentional risks\n");
  writeIfMissing(join(root, "artifacts", "taste-profile.md"), "# Taste Profile\n\n- what the writer loves\n- what the writer rejects\n- safe but wrong choices\n");
  writeIfMissing(join(root, "artifacts", "risk-budget.md"), "# Risk Budget\n\n| risk | intentional? | reader cost | payoff | verdict |\n| --- | --- | --- | --- | --- |\n");
  writeIfMissing(join(root, "artifacts", "discarded-choices.md"), "# Discarded Choices\n\nTrack rejected openings, names, tones, premises, and turns here.\n");
  writeIfMissing(join(root, "artifacts", "review-personas.md"), "# Review Personas\n\n- ideal reader\n- skeptical but persuadable reader\n- genre-native reviewer\n- voice-sensitive craft reader\n- optional hostile or misaligned reader\n");
}

function maybeInitGit(root: string): boolean {
  if (existsSync(join(root, ".git"))) return false;
  execSync("git init", { cwd: root, stdio: "ignore" });
  return true;
}

function buildNextPrompt(root: string, args: string, commandName = "genesis-next"): string {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const missing = missingRequired(root).slice(0, 12);
  const blockers = blockerSummary(root);

  return `Use the \`genesis-for-pi\` skill and advance this Genesis for Pi project. The invoking command was \`/${commandName}\`.

Project root: ${root}
Detected current phase: ${phase}
User instructions: ${args.trim() || "none"}
Known blocker files from extension precheck: ${blockers.length ? blockers.join(", ") : "none detected by lightweight precheck"}
First missing expected files from extension precheck: ${missing.length ? missing.join(", ") : "none from full package list"}

Rules:

1. Load \`PROJECT_STATE.yaml\`, \`ASSUMPTIONS.md\`, and \`references/pipeline/manifest.yaml\` from the skill package before doing anything else.
2. Identify the current phase, the next incomplete required output, and any active blocker that prevents safe advancement.
3. Continue from the current state; do not restart unless state is missing or explicitly invalid.
4. Bypass optional writer approval gates for this turn unless the user explicitly asks for a check-in.
5. Do not bypass hard blockers: active drift-loop hard stops, open blocker/high revision tickets, unresolved name-collision blockers, unresolved AI-tell blockers, unresolved author-voice blockers, unresolved subtext/ear/over-polish blockers, missing required phase outputs, or phase contract mismatches.
6. If blockers exist, clear them first when possible by updating the relevant blocker files, repair artifacts, revision tickets, and manuscript/project files with concrete evidence-based fixes. Do not merely report blockers if they can be actively resolved this turn.
7. If a blocker cannot be cleared safely in this turn, report the blocker, the exact file/evidence needed to unblock, and stop after updating any files that clarify the blockage.
8. Once blockers are cleared or none exist, produce only the next required pipeline step's outputs, update \`PROJECT_STATE.yaml\`, and commit each changed file separately.
9. Preserve the Human Voice Rule: optimize for reader trust, author fingerprint, subtext, rhythm, sensory authority, and controlled imperfection rather than AI-detector evasion.
10. Use \`artifacts/review-personas.md\`, \`artifacts/author-voice-fingerprint.md\`, \`artifacts/voice-bible.md\`, and \`artifacts/human-source-bank.md\` to protect voice when revising or unblocking.
11. Do not skip Phase 4. Do not run Final Score before Adversarial Audit is complete.

Proceed now.`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "genesis_blocker_triage",
    label: "Genesis Blocker Triage",
    description: "Inspect a Genesis for Pi project for blocker files, evidence snippets, and suggested repair actions.",
    promptSnippet: "Inspect Genesis blocker files and missing required outputs with evidence snippets.",
    promptGuidelines: [
      "Use genesis_blocker_triage before or during Genesis advancement when you need a fast blocker summary with evidence and suggested actions.",
    ],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String({ description: "Optional project root. Defaults to current working directory." })),
      include_missing: Type.Optional(Type.Boolean({ description: "Include missing required outputs in the triage report." })),
      focus_file: Type.Optional(Type.String({ description: "Optional blocker file to isolate in the response." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = findProjectRoot(params.project_root || ctx.cwd);
      const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
      let blockers = collectBlockers(root, params.include_missing ?? true);

      if (params.focus_file) blockers = blockers.filter((blocker) => blocker.file === params.focus_file);

      const text = blockers.length
        ? [
            `Genesis root: ${root}`,
            `Current phase: ${phase}`,
            "",
            ...blockers.map(
              (blocker, index) =>
                `${index + 1}. ${blocker.label} (${blocker.file})\nEvidence: ${blocker.evidence}\nSuggested action: ${blocker.suggestion}`,
            ),
          ].join("\n")
        : `Genesis root: ${root}\nCurrent phase: ${phase}\n\nNo blockers detected by Genesis triage.`;

      return {
        content: [{ type: "text", text }],
        details: { root, phase, blockers },
      };
    },
  });

  const registerStatusCommand = (name: string, description: string) => {
    pi.registerCommand(name, {
      description,
      handler: async (_args, ctx) => {
        const root = findProjectRoot(ctx.cwd);
        const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
        const phase = detectPhase(state);
        const missing = missingRequired(root);
        const blockers = blockerSummary(root);

        const lines = [
          `Genesis root: ${root}`,
          `Current phase: ${phase}`,
          `Potential blocker files: ${blockers.length ? blockers.join(", ") : "none detected"}`,
          `Missing expected files: ${missing.length ? missing.slice(0, 10).join(", ") + (missing.length > 10 ? `, +${missing.length - 10} more` : "") : "none"}`,
        ];

        ctx.ui.notify(lines.join("\n"), blockers.length ? "warning" : "info");
      },
    });
  };

  const registerNextCommand = (name: string, description: string) => {
    pi.registerCommand(name, {
      description,
      getArgumentCompletions: (prefix: string) => {
        const items = [
          "main checkpoints only",
          "careful mode",
          "fast mode",
          "do not draft prose yet",
          "continue without optional approval gates",
          "clear blockers first",
        ].map((value) => ({ value, label: value }));
        const filtered = items.filter((item) => item.value.startsWith(prefix));
        return filtered.length ? filtered : null;
      },
      handler: async (args, ctx) => {
        if (!ctx.isIdle()) {
          ctx.ui.notify(`Agent is busy. Queueing /${name} as a follow-up.`, "info");
          pi.sendUserMessage(buildNextPrompt(findProjectRoot(ctx.cwd), args, name), { deliverAs: "followUp" });
          return;
        }

        pi.sendUserMessage(buildNextPrompt(findProjectRoot(ctx.cwd), args, name));
      },
    });
  };

  const registerBlockerCommand = (name: string, description: string) => {
    pi.registerCommand(name, {
      description,
      handler: async (_args, ctx) => {
        const root = findProjectRoot(ctx.cwd);
        const blockers = collectBlockers(root, true);

        if (!blockers.length) {
          ctx.ui.notify("No Genesis blockers detected.", "info");
          return;
        }

        const options = blockers.map((blocker) => `${blocker.label} — ${blocker.file}`);
        const selected = await ctx.ui.select("Choose a Genesis blocker to inspect:", options);
        if (!selected) return;

        const blocker = blockers[options.indexOf(selected)];
        if (!blocker) return;

        ctx.ui.notify(
          [`${blocker.label}`, `file: ${blocker.file}`, `evidence: ${blocker.evidence}`, `suggested action: ${blocker.suggestion}`].join("\n"),
          blocker.severity === "blocker" ? "warning" : "info",
        );

        const shouldQueueFix = await ctx.ui.confirm(
          "Queue Genesis fix?",
          `Ask Genesis to clear this blocker now?\n\n${blocker.file}`,
        );

        if (!shouldQueueFix) return;

        const message = `${buildNextPrompt(root, `Focus first on blocker file ${blocker.file}. Evidence: ${blocker.evidence}. Suggested action: ${blocker.suggestion}.`, name)}\n\nStart by clearing ${blocker.file}.`;

        if (!ctx.isIdle()) {
          pi.sendUserMessage(message, { deliverAs: "followUp" });
          ctx.ui.notify(`Queued blocker-fix follow-up for ${blocker.file}.`, "info");
          return;
        }

        pi.sendUserMessage(message);
      },
    });
  };

  const registerInitCommand = (name: string, description: string) => {
    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        const typedName = args.trim() || (await ctx.ui.input("Genesis project name:", "my-book"));
        if (!typedName) return;

        const projectDirName = slugifyProjectName(typedName);
        const baseDir = ctx.cwd;
        const projectRoot = resolve(baseDir, projectDirName);

        if (existsSync(projectRoot) && (existsSync(join(projectRoot, "PROJECT_STATE.yaml")) || existsSync(join(projectRoot, "artifacts")))) {
          ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
          return;
        }

        const idea =
          (await ctx.ui.editor(
            "Seed idea:",
            "Describe the book idea, tone, genre pressure, reader promise, and anything that must not be smoothed away.",
          )) || "";

        initializeProject(projectRoot, typedName, idea);

        let gitInitialized = false;
        try {
          gitInitialized = maybeInitGit(projectRoot);
        } catch {
          ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning");
        }

        ctx.ui.notify(
          `Initialized Genesis project at ${projectRoot}${gitInitialized ? "\nGit repository initialized." : ""}`,
          "info",
        );

        const shouldStart = await ctx.ui.confirm(
          "Start intake now?",
          "Queue Genesis to begin Phase 0 intake in the new project?",
        );

        if (!shouldStart) return;

        const kickoff = `${buildNextPrompt(projectRoot, `Project root: ${projectRoot}. Start with Phase 0 intake using this seed idea: ${idea || "No idea captured yet."}`, name)}\n\nThe project tree already exists. Fill in the Phase 0 outputs now.`;

        if (!ctx.isIdle()) {
          pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
          return;
        }

        pi.sendUserMessage(kickoff);
      },
    });
  };

  const registerOpenCommand = (name: string, description: string) => {
    pi.registerCommand(name, {
      description,
      handler: async (_args, ctx) => {
        const projects = findGenesisProjects(ctx.cwd, 3);
        if (!projects.length) {
          ctx.ui.notify("No Genesis projects found under the current working directory.", "warning");
          return;
        }

        const selectedProject = await ctx.ui.select("Choose a Genesis project:", projects);
        if (!selectedProject) return;

        const action = await ctx.ui.select("What should Genesis do with this project?", [
          "Show status",
          "Inspect blockers",
          "Advance next step",
        ]);
        if (!action) return;

        if (action === "Show status") {
          const phase = detectPhase(readIfExists(join(selectedProject, "PROJECT_STATE.yaml")));
          const blockers = renderBlockers(selectedProject, true);
          ctx.ui.notify(`Genesis root: ${selectedProject}\nCurrent phase: ${phase}\n\n${blockers}`, "info");
          return;
        }

        if (action === "Inspect blockers") {
          const blockerReport = renderBlockers(selectedProject, true);
          ctx.ui.notify(`Genesis root: ${selectedProject}\n\n${blockerReport}`, "info");
          return;
        }

        const kickoff = `${buildNextPrompt(selectedProject, `Project root: ${selectedProject}. Continue this project from its current state.`, name)}\n\nUse ${selectedProject} as the active project root.`;
        if (!ctx.isIdle()) {
          pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
          return;
        }
        pi.sendUserMessage(kickoff);
      },
    });
  };

  registerStatusCommand("genesis-status", "Show Genesis for Pi project status from PROJECT_STATE and artifact files");
  registerStatusCommand("bg-status", "Legacy alias for /genesis-status");

  registerInitCommand("genesis-init", "Create a fresh Genesis for Pi project tree and optionally start intake");
  registerInitCommand("bg-init", "Legacy alias for /genesis-init");

  registerOpenCommand("genesis-open", "Pick an existing Genesis project, then inspect or continue it");
  registerOpenCommand("bg-open", "Legacy alias for /genesis-open");

  registerNextCommand("genesis-next", "Clear blockers when possible, then advance Genesis for Pi to the next incomplete pipeline step");
  registerNextCommand("bg-next", "Legacy alias for /genesis-next");

  registerBlockerCommand("genesis-blockers", "Interactively inspect Genesis blockers and optionally queue a blocker-fix turn");
  registerBlockerCommand("bg-blockers", "Legacy alias for /genesis-blockers");
}
