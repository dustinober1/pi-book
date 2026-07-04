import { Type } from "typebox";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(PACKAGE_ROOT, "references", "pipeline", "manifest.yaml");
const GENESIS_SCHEMA_VERSION = "0.2.0";

const DEFAULT_PHASE_DEFINITIONS = [
  {
    key: "phase_0_intake",
    label: "Phase 0: Intake",
    prompt: "references/prompts/intake.md",
    gate: "intake",
    outputs: [
      "ASSUMPTIONS.md",
      "artifacts/00-brief.md",
      "artifacts/01-market-map.md",
      "artifacts/02-story-engine.md",
      "artifacts/author-intent.md",
      "artifacts/taste-profile.md",
      "artifacts/risk-budget.md",
      "artifacts/discarded-choices.md",
      "artifacts/review-personas.md",
    ],
    next: "Phase 1: Foundation",
  },
  {
    key: "phase_1_foundation",
    label: "Phase 1: Foundation",
    prompt: "references/prompts/foundation.md",
    gate: "foundation",
    outputs: [
      "artifacts/03-characters.md",
      "artifacts/04-theme.md",
      "artifacts/voice-bible.md",
      "artifacts/author-voice-fingerprint.md",
      "artifacts/human-source-bank.md",
      "artifacts/name-collision-audit.md",
      "artifacts/name-entity-filter.md",
      "artifacts/06-emotional-curve.md",
    ],
    next: "Phase 2: Architecture",
  },
  {
    key: "phase_2_architecture",
    label: "Phase 2: Architecture",
    prompt: "references/prompts/architecture.md",
    gate: "architecture",
    outputs: [
      "artifacts/05-outline.md",
      "artifacts/causality-chain.md",
      "artifacts/scene-embodiment-map.md",
      "artifacts/05-subplot-map.md",
      "artifacts/continuity-ledger.md",
      "artifacts/reader-promise-tracker.md",
      "artifacts/drift-loop-alarm.md",
      "artifacts/expansion-integrity.md",
      "artifacts/07-opening-strategy.md",
    ],
    next: "Phase 3: Drafting",
  },
  {
    key: "phase_3_drafting",
    label: "Phase 3: Drafting",
    prompt: "references/prompts/drafting.md",
    gate: "drafting",
    outputs: [
      "manuscript/chapters",
      "artifacts/expansion-integrity.md",
      "artifacts/human-specificity-ledger.md",
      "artifacts/subtext-audit.md",
      "artifacts/ear-pass.md",
      "artifacts/over-polish-audit.md",
      "artifacts/scene-embodiment-map.md",
      "artifacts/discarded-choices.md",
      "evaluations/chapter-scorecards.md",
    ],
    next: "Phase 4: Adversarial Audit",
  },
  {
    key: "phase_4_adversarial_audit",
    label: "Phase 4: Adversarial Audit",
    prompt: "references/prompts/adversarial-audit.md",
    gate: "adversarial_audit",
    outputs: [
      "artifacts/08-adversarial-audit.md",
      "artifacts/narrative-fingerprint-audit.md",
      "artifacts/ai-tell-mitigation-audit.md",
      "artifacts/subtext-audit.md",
      "artifacts/ear-pass.md",
      "artifacts/over-polish-audit.md",
      "artifacts/negative-capability-audit.md",
      "artifacts/expansion-integrity.md",
      "artifacts/revision-philosophy.md",
      "artifacts/revision-tickets.md",
    ],
    next: "Phase 5: Final Score",
  },
  {
    key: "phase_5_final_score",
    label: "Phase 5: Final Score",
    prompt: "references/scoring/genesis-score-codex.md",
    gate: "final_score",
    outputs: ["artifacts/09-genesis-score.md"],
    next: "Phase 6: Editorial Package",
  },
  {
    key: "phase_6_editorial_package",
    label: "Phase 6: Editorial Package",
    prompt: "references/prompts/editorial-package.md",
    gate: "editorial_package",
    outputs: [
      "artifacts/10-editorial-package.md",
      "artifacts/reader-response-plan.md",
      "artifacts/beta-feedback-log.md",
      "artifacts/positioning-strategy.md",
    ],
    next: "",
  },
];

const WORKFLOW_MODES = [
  "novel",
  "memoir",
  "narrative nonfiction",
  "prescriptive nonfiction",
  "study guide",
  "certification prep",
  "series installment",
  "series repair",
  "other",
];

const CORE_PROJECT_FILES = ["PROJECT_STATE.yaml", "ASSUMPTIONS.md", "STATUS.md"];
const PROJECT_ROOT_DIRS = ["artifacts", "manuscript/chapters", "evaluations", "delivery", "research/notes", "research/sources"];

const MODE_ARTIFACTS = {
  novel: ["artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md"],
  memoir: ["artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md"],
  "series installment": ["artifacts/series-bible.md", "artifacts/reader-promise-tracker.md"],
  "series repair": [
    "artifacts/series-bible.md",
    "artifacts/canon-lock.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-verification-matrix.md",
    "artifacts/reader-promise-tracker.md",
  ],
  "narrative nonfiction": ["artifacts/argument-spine.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "prescriptive nonfiction": ["artifacts/argument-spine.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "study guide": ["artifacts/study-guide-objectives.md", "research/reference-inventory.md", "artifacts/reader-promise-tracker.md"],
  "certification prep": [
    "artifacts/certification-blueprint-map.md",
    "artifacts/study-guide-objectives.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
  ],
  other: ["artifacts/reader-promise-tracker.md"],
};

const MODE_SCAFFOLD_BUNDLES = {
  novel: [
    "artifacts/voice-bible.md",
    "artifacts/review-personas.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
    "artifacts/continuity-ledger.md",
  ],
  memoir: [
    "artifacts/voice-bible.md",
    "artifacts/review-personas.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
    "artifacts/human-source-bank.md",
  ],
  "narrative nonfiction": [
    "artifacts/argument-spine.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/review-personas.md",
  ],
  "prescriptive nonfiction": [
    "artifacts/argument-spine.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/review-personas.md",
  ],
  "study guide": [
    "artifacts/study-guide-objectives.md",
    "research/reference-inventory.md",
    "artifacts/evidence-map.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "certification prep": [
    "artifacts/certification-blueprint-map.md",
    "artifacts/study-guide-objectives.md",
    "artifacts/evidence-map.md",
    "research/reference-inventory.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "series installment": [
    "artifacts/series-bible.md",
    "artifacts/continuity-ledger.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  "series repair": [
    "artifacts/series-bible.md",
    "artifacts/canon-lock.md",
    "artifacts/installment-promise-tracker.md",
    "artifacts/series-verification-matrix.md",
    "artifacts/continuity-ledger.md",
    "artifacts/reader-promise-tracker.md",
    "artifacts/drift-loop-alarm.md",
  ],
  other: ["artifacts/review-personas.md", "artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md"],
};

const TEMPLATE_SCAFFOLDS = [
  { label: "voice-bible.md", template: "references/templates/voice-bible.md", destination: "artifacts/voice-bible.md" },
  { label: "continuity-ledger.md", template: "references/templates/continuity-ledger.md", destination: "artifacts/continuity-ledger.md" },
  { label: "revision-tickets.md", template: "references/templates/revision-tickets.md", destination: "artifacts/revision-tickets.md" },
  { label: "expansion-integrity.md", template: "references/templates/expansion-integrity.md", destination: "artifacts/expansion-integrity.md" },
  { label: "series-bible.md", template: "references/templates/series-bible.md", destination: "artifacts/series-bible.md" },
  { label: "canon-lock.md", template: "references/templates/canon-lock.md", destination: "artifacts/canon-lock.md" },
  { label: "installment-promise-tracker.md", template: "references/templates/installment-promise-tracker.md", destination: "artifacts/installment-promise-tracker.md" },
  { label: "series-verification-matrix.md", template: "references/templates/series-verification-matrix.md", destination: "artifacts/series-verification-matrix.md" },
  { label: "argument-spine.md", template: "references/templates/argument-spine.md", destination: "artifacts/argument-spine.md" },
  { label: "certification-blueprint-map.md", template: "references/templates/certification-blueprint-map.md", destination: "artifacts/certification-blueprint-map.md" },
  { label: "reference-inventory.md", template: "references/templates/reference-inventory.md", destination: "research/reference-inventory.md" },
  { label: "evidence-map.md", template: "references/templates/evidence-map.md", destination: "artifacts/evidence-map.md" },
  { label: "study-guide-objectives.md", template: "references/templates/study-guide-objectives.md", destination: "artifacts/study-guide-objectives.md" },
  { label: "author-intent.md", template: "references/templates/author-intent.md", destination: "artifacts/author-intent.md" },
  { label: "taste-profile.md", template: "references/templates/taste-profile.md", destination: "artifacts/taste-profile.md" },
  { label: "risk-budget.md", template: "references/templates/risk-budget.md", destination: "artifacts/risk-budget.md" },
  { label: "review-personas.md", template: "references/templates/review-personas.md", destination: "artifacts/review-personas.md" },
  { label: "reader-promise-tracker.md", template: "references/templates/reader-promise-tracker.md", destination: "artifacts/reader-promise-tracker.md" },
  { label: "drift-loop-alarm.md", template: "references/templates/drift-loop-alarm.md", destination: "artifacts/drift-loop-alarm.md" },
];

const BLOCKER_CHECKS = [
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
    file: "artifacts/expansion-integrity.md",
    label: "Expansion-integrity blocker",
    pattern: /blocker|unresolved|padding|filler|ornamental subplot|no-state-change/i,
    suggestion: "Replace filler growth with real subplot pressure, consequence, aftermath, or meaningful scene work.",
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

const PLACEHOLDER_PATTERNS = [
  { label: "placeholder unknown", pattern: /\bunknown\b/i },
  { label: "placeholder TODO", pattern: /\bTODO\b|\bTBD\b/i },
  { label: "starter prompt text", pattern: /Add the writer's seed idea here|Describe the book idea|Track rejected openings/i },
  { label: "empty bullet scaffold", pattern: /^-\s*$/m },
  { label: "waiting scaffold", pattern: /to be filled|fill this in later|not provided yet/i },
];

function unquote(value) {
  return String(value || "").replace(/^['"]|['"]$/g, "");
}

function parseSimpleYaml(text) {
  const result = {};
  if (!text) return result;
  const lines = text.split(/\r?\n/);
  let currentListKey = null;

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const listItem = rawLine.match(/^\s{2}-\s*(.*)$/);
    if (listItem && currentListKey) {
      if (!Array.isArray(result[currentListKey])) result[currentListKey] = [];
      result[currentListKey].push(unquote(listItem[1].trim()));
      continue;
    }

    currentListKey = null;
    const pair = rawLine.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    const value = rawValue.trim();

    if (!value) {
      currentListKey = key;
      result[key] = [];
      continue;
    }

    if (value === "[]") {
      result[key] = [];
      continue;
    }

    result[key] = unquote(value);
  }

  return result;
}

function stringifyScalar(value) {
  return JSON.stringify(String(value));
}

function parseManifest(text) {
  const phases = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  let inOutputs = false;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const topLevelMatch = line.match(/^([a-z0-9_]+):\s*$/i);
    if (topLevelMatch) {
      current = { key: topLevelMatch[1], label: "", prompt: "", gate: "", outputs: [], next: "" };
      phases.push(current);
      inOutputs = false;
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^\s{2}([a-z_]+):\s*(.*)$/i);
    if (fieldMatch) {
      const [, key, rawValue] = fieldMatch;
      const value = unquote(rawValue.trim());
      inOutputs = key === "outputs";
      if (key === "label" || key === "prompt" || key === "gate" || key === "next") current[key] = value;
      continue;
    }

    const outputMatch = line.match(/^\s{4}-\s*(.*)$/);
    if (outputMatch && inOutputs) current.outputs.push(unquote(outputMatch[1].trim()));
  }

  return phases.filter((phase) => phase.label);
}

function loadPhaseDefinitions() {
  try {
    const text = readFileSync(MANIFEST_PATH, "utf8");
    const parsed = parseManifest(text);
    if (parsed.length) return parsed;
  } catch {
    // fall through
  }
  return DEFAULT_PHASE_DEFINITIONS;
}

const PHASE_DEFINITIONS = loadPhaseDefinitions();
const PHASES = PHASE_DEFINITIONS.map((phase) => phase.label);
const PHASE_OUTPUTS = Object.fromEntries(PHASE_DEFINITIONS.map((phase) => [phase.label, phase.outputs]));

function readIfExists(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function normalizePhaseLabel(value) {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  return PHASES.find((phase) => phase.toLowerCase() === normalized) || "";
}

function parseProjectState(state) {
  return parseSimpleYaml(state || "");
}

function detectPhase(state) {
  if (!state) return "unknown: PROJECT_STATE.yaml not found";
  const parsed = parseProjectState(state);
  const direct = normalizePhaseLabel(parsed.current_phase || parsed.phase || parsed.label);
  if (direct) return direct;
  for (const phase of PHASES) if (state.includes(phase)) return phase;
  return "unknown: could not detect phase from PROJECT_STATE.yaml";
}

function pathExists(root, relativePath) {
  return existsSync(join(root, relativePath));
}

function findProjectRoot(cwd) {
  let dir = cwd;
  let fallback = null;

  while (true) {
    if (existsSync(join(dir, "PROJECT_STATE.yaml"))) return dir;
    if (!fallback && existsSync(join(dir, "artifacts")) && existsSync(join(dir, "ASSUMPTIONS.md"))) fallback = dir;
    const parent = dirname(dir);
    if (parent === dir) return fallback || cwd;
    dir = parent;
  }
}

function detectWorkflowMode(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml")) || "";
  const assumptions = readIfExists(join(root, "ASSUMPTIONS.md")) || "";
  const parsed = parseProjectState(state);
  if (parsed.workflow_mode) return String(parsed.workflow_mode).trim().toLowerCase();
  const match = `${state}\n${assumptions}`.match(/workflow mode\s*:\s*([^\n]+)/i);
  return (match?.[1] || "unknown").trim().toLowerCase();
}

function setYamlScalar(text, key, value) {
  const next = text || "";
  if (new RegExp(`^${key}\\s*:`, "im").test(next)) {
    return next.replace(new RegExp(`^${key}\\s*:.*$`, "im"), `${key}: ${stringifyScalar(value)}`);
  }
  return `${next.trimEnd()}\n${key}: ${stringifyScalar(value)}\n`;
}

function setWorkflowModeInState(state, mode) {
  return setYamlScalar(state, "workflow_mode", mode);
}

function setWorkflowModeInAssumptions(assumptions, mode) {
  const next = assumptions || "# Assumptions\n";
  if (/^- Workflow mode:/im.test(next)) return next.replace(/^- Workflow mode:.*$/im, `- Workflow mode: ${mode}`);
  const marker = "## Inferred assumptions";
  if (next.includes(marker)) return next.replace(marker, `${marker}\n\n- Workflow mode: ${mode}`);
  return `${next.trimEnd()}\n\n- Workflow mode: ${mode}\n`;
}

function updateBriefWorkflowMode(brief, mode) {
  if (!brief) return brief;
  return /- Workflow mode:/i.test(brief)
    ? brief.replace(/- Workflow mode:.*$/im, `- Workflow mode: ${mode}`)
    : `${brief.trimEnd()}\n- Workflow mode: ${mode}\n`;
}

function getPhaseIndex(phase) {
  return PHASES.indexOf(phase);
}

function getExpectedFilesForPhase(phase) {
  const index = getPhaseIndex(phase);
  const expected = [...CORE_PROJECT_FILES];
  if (index < 0) return expected;
  for (let i = 0; i <= index; i += 1) expected.push(...(PHASE_DEFINITIONS[i]?.outputs || []));
  return [...new Set(expected)];
}

function missingExpectedForPhase(root, phase) {
  return getExpectedFilesForPhase(phase).filter((file) => !pathExists(root, file));
}

function missingPhaseOutputs(root, phase) {
  const outputs = PHASE_OUTPUTS[phase] || [];
  return outputs.filter((file) => !pathExists(root, file));
}

function missingModeArtifacts(root, workflowMode) {
  const modeArtifacts = MODE_ARTIFACTS[workflowMode] || [];
  return modeArtifacts.filter((file) => !pathExists(root, file));
}

function extractEvidence(text, pattern) {
  const match = text.match(pattern);
  if (!match || match.index == null) return "pattern matched but no snippet available";
  const start = Math.max(0, match.index - 80);
  const end = Math.min(text.length, match.index + (match[0]?.length ?? 0) + 160);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function getGitState(root) {
  try {
    const inside = execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (inside !== "true") return { initialized: false, dirty: 0, branch: "" };
    const dirty = execSync("git status --porcelain", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().split(/\r?\n/).filter(Boolean).length;
    const branch = execSync("git branch --show-current", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return { initialized: true, dirty, branch };
  } catch {
    return { initialized: false, dirty: 0, branch: "" };
  }
}

function formatRelativeTime(ms) {
  const seconds = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function listRecentProjectFiles(root, limit = 5) {
  const files = [];
  function walk(dir, depth) {
    if (depth > 4) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else {
        const relative = full.startsWith(root) ? full.slice(root.length + 1) : full;
        files.push({ path: relative, mtimeMs: statSync(full).mtimeMs });
      }
    }
  }
  try {
    walk(root, 0);
  } catch {
    return [];
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}

function listMarkdownFiles(dir, root = dir, depth = 0) {
  if (!existsSync(dir) || depth > 4) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(full, root, depth + 1));
    else if (/\.md$/i.test(entry.name)) files.push(full.slice(root.length + 1));
  }
  return files.sort(new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare);
}

function stripMarkdownForWordCount(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[>*_~|#\-]/g, " ");
}

function countWords(text) {
  const words = stripMarkdownForWordCount(text).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return words ? words.length : 0;
}

function chapterTitleFromPath(relativePath, text) {
  const heading = String(text || "").match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return basename(relativePath, ".md").replace(/^\d+[-_\s]*/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || relativePath;
}

function collectManuscriptChapters(root) {
  const chaptersRoot = join(root, "manuscript", "chapters");
  return listMarkdownFiles(chaptersRoot, chaptersRoot).map((relativePath) => {
    const fullPath = join(chaptersRoot, relativePath);
    const text = readIfExists(fullPath) || "";
    return {
      path: `manuscript/chapters/${relativePath}`,
      title: chapterTitleFromPath(relativePath, text),
      text,
      words: countWords(text),
    };
  });
}

function manuscriptStats(root) {
  const chapters = collectManuscriptChapters(root);
  return {
    chapters: chapters.length,
    words: chapters.reduce((total, chapter) => total + chapter.words, 0),
    files: chapters.map((chapter) => chapter.path),
  };
}

function compileManuscript(root) {
  ensureDir(join(root, "delivery"));
  const state = parseProjectState(readIfExists(join(root, "PROJECT_STATE.yaml")) || "");
  const title = state.project_name || basename(root);
  const chapters = collectManuscriptChapters(root);
  const generatedAt = new Date().toISOString();
  const manuscriptPath = join(root, "delivery", "manuscript-full.md");
  const reportPath = join(root, "delivery", "manuscript-compile-report.md");
  const body = chapters.length
    ? chapters.map((chapter) => {
      const trimmed = chapter.text.trim();
      return /^#\s+/m.test(trimmed) ? trimmed : `# ${chapter.title}\n\n${trimmed}`;
    }).join("\n\n---\n\n")
    : "_No chapter Markdown files were found under `manuscript/chapters/`._";
  const compiled = [`# ${title}`, "", `_Compiled by Genesis for Pi on ${generatedAt}._`, "", body, ""].join("\n");
  writeFileSync(manuscriptPath, compiled, "utf8");
  const totalWords = chapters.reduce((total, chapter) => total + chapter.words, 0);
  const report = [
    "# Manuscript Compile Report",
    "",
    `- Project root: ${root}`,
    `- Output: delivery/manuscript-full.md`,
    `- Generated: ${generatedAt}`,
    `- Chapter files: ${chapters.length}`,
    `- Estimated manuscript words: ${totalWords}`,
    "",
    "## Included chapters",
    "",
    ...(chapters.length ? chapters.map((chapter, index) => `${index + 1}. ${chapter.path} — ${chapter.words} words`) : ["- none"]),
    "",
  ].join("\n");
  writeFileSync(reportPath, report, "utf8");
  return { manuscriptPath, reportPath, chapters: chapters.length, words: totalWords };
}

function progressBar(currentIndex, total, width = 12) {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(0, Math.min(width, Math.round(((currentIndex + 1) / safeTotal) * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function renderDashboard(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const phaseIndex = Math.max(0, getPhaseIndex(phase));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const hardBlockers = blockers.filter((blocker) => blocker.severity === "blocker");
  const warnings = blockers.filter((blocker) => blocker.severity === "warning");
  const lintFindings = collectLintFindings(root, phase);
  const missing = missingExpectedForPhase(root, phase);
  const git = getGitState(root);
  const stats = manuscriptStats(root);
  const recent = listRecentProjectFiles(root, 6);
  return [
    "# Genesis Dashboard",
    "",
    `Project: ${root}`,
    `Mode: ${workflowMode}`,
    `Phase: ${phase}`,
    `Progress: ${progressBar(phaseIndex, PHASE_DEFINITIONS.length)} ${phaseIndex + 1}/${PHASE_DEFINITIONS.length}`,
    "",
    "## Signals",
    "",
    `- Hard blockers: ${hardBlockers.length}`,
    `- Warnings: ${warnings.length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Missing expected files: ${missing.length}`,
    `- Manuscript: ${stats.chapters} chapter file(s), ${stats.words} estimated words`,
    `- Git: ${git.initialized ? `${git.dirty} uncommitted change(s)${git.branch ? ` on ${git.branch}` : ""}` : "not initialized"}`,
    `- Next best action: ${nextRecommendedAction(root)}`,
    "",
    "## Top issues",
    "",
    ...(blockers.length ? blockers.slice(0, 8).map((blocker) => `- [${blocker.severity}] ${blocker.label} — ${blocker.file}`) : ["- none"]),
    "",
    "## Recent files",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- none"]),
    "",
  ].join("\n");
}

function isGenesisProjectPath(relativePath) {
  return /^(PROJECT_STATE\.yaml|ASSUMPTIONS\.md|STATUS\.md)$/.test(relativePath)
    || /^(artifacts|manuscript|evaluations|delivery|research)\//.test(relativePath);
}

function parseGitStatus(root) {
  try {
    return execFileSync("git", ["status", "--porcelain", "-uall"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2);
        let path = line.slice(3).trim();
        if (path.includes(" -> ")) path = path.split(" -> ").pop().trim();
        return { status, path: path.replace(/^\"|\"$/g, "") };
      });
  } catch {
    return [];
  }
}

function checkpointGenesisFiles(root, args = "") {
  if (!getGitState(root).initialized) execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  const requested = args.trim();
  const explicitPaths = requested && requested.toLowerCase() !== "all"
    ? new Set(requested.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))
    : null;
  const changes = parseGitStatus(root).filter((change) => isGenesisProjectPath(change.path));
  const selected = explicitPaths
    ? [...explicitPaths].filter((path) => isGenesisProjectPath(path)).map((path) => changes.find((change) => change.path === path) || { status: existsSync(join(root, path)) ? "??" : " D", path })
    : changes;
  const results = [];
  for (const change of selected) {
    const action = change.status.includes("D") ? "remove" : change.status.includes("?") ? "add" : "update";
    const message = `Genesis: ${action} ${change.path}`;
    try {
      execFileSync("git", ["add", "--", change.path], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      execFileSync("git", ["commit", "-m", message, "--", change.path], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      results.push({ file: change.path, status: "committed", message });
    } catch (error) {
      results.push({ file: change.path, status: "failed", message: error?.stderr?.toString?.().trim() || error?.message || "git commit failed" });
    }
  }
  return { root, requested: explicitPaths ? [...explicitPaths] : null, changed: changes.length, attempted: selected.length, results };
}

function createEditorialExport(root) {
  ensureDir(join(root, "delivery"));
  const compile = compileManuscript(root);
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const stats = manuscriptStats(root);
  const revisionTickets = readIfExists(join(root, "artifacts", "revision-tickets.md")) || "No revision-tickets.md file exists yet.";
  const readerPromises = readIfExists(join(root, "artifacts", "reader-promise-tracker.md")) || "No reader-promise-tracker.md file exists yet.";
  const handoffPath = join(root, "delivery", "editorial-handoff.md");
  const boardPath = join(root, "delivery", "revision-board.md");
  const betaPath = join(root, "delivery", "beta-reader-packet.md");
  const manifestPath = join(root, "delivery", "genesis-export-manifest.md");
  writeFileSync(handoffPath, [
    "# Editorial Handoff",
    "",
    `- Project root: ${root}`,
    `- Phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Manuscript: ${stats.chapters} chapter file(s), ${stats.words} estimated words`,
    `- Compiled manuscript: delivery/manuscript-full.md`,
    `- Open blockers/warnings: ${blockers.length}`,
    "",
    "## Current risks",
    "",
    ...(blockers.length ? blockers.map((blocker) => `- [${blocker.severity}] ${blocker.label} — ${blocker.file}`) : ["- none detected"]),
    "",
    "## High-value project files",
    "",
    "- PROJECT_STATE.yaml",
    "- STATUS.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/revision-tickets.md",
    "- evaluations/chapter-scorecards.md",
    "",
  ].join("\n"), "utf8");
  writeFileSync(boardPath, `# Revision Board\n\nSource: artifacts/revision-tickets.md\n\n${revisionTickets.trim()}\n`, "utf8");
  writeFileSync(betaPath, [
    "# Beta Reader Packet",
    "",
    "Use this packet with the compiled manuscript when asking for outside reader response.",
    "",
    "## Reader promises to watch",
    "",
    readerPromises.trim(),
    "",
    "## Feedback prompts",
    "",
    "- Where did attention drop? Name the chapter or scene.",
    "- Which promise felt underpaid, over-explained, or abandoned?",
    "- Which character, argument, or system rule felt false?",
    "- Where did the prose sound too smooth, generic, or unlike the author?",
    "- What residue stayed with you after the ending?",
    "",
  ].join("\n"), "utf8");
  const files = ["delivery/manuscript-full.md", "delivery/manuscript-compile-report.md", "delivery/editorial-handoff.md", "delivery/revision-board.md", "delivery/beta-reader-packet.md"];
  writeFileSync(manifestPath, ["# Genesis Export Manifest", "", `Generated: ${new Date().toISOString()}`, "", ...files.map((file) => `- ${file}`), ""].join("\n"), "utf8");
  return { ...compile, files: [...files, "delivery/genesis-export-manifest.md"] };
}

function lintArtifactFile(relativePath, text) {
  const findings = [];
  if (!text?.trim()) {
    findings.push({ file: relativePath, label: "empty file", evidence: `${relativePath} is empty.` });
    return findings;
  }

  for (const item of PLACEHOLDER_PATTERNS) {
    if (item.pattern.test(text)) findings.push({ file: relativePath, label: item.label, evidence: extractEvidence(text, item.pattern) });
  }

  const headings = [...text.matchAll(/^(#{1,3}\s.+)$/gm)];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index + headings[i][0].length;
    const end = headings[i + 1]?.index ?? text.length;
    const body = text.slice(start, end).replace(/^\s+|\s+$/g, "");
    if (!body || /^[-*]\s*$/.test(body)) findings.push({ file: relativePath, label: "empty section", evidence: headings[i][0] });
  }

  const tableOnlySkeleton = text.match(/\|.*\|\n\|\s*---[\s|:-]*\n?$/m);
  if (tableOnlySkeleton) findings.push({ file: relativePath, label: "empty table scaffold", evidence: tableOnlySkeleton[0].trim() });
  return findings;
}

function collectLintFindings(root, phase) {
  const expected = [...new Set([...getExpectedFilesForPhase(phase), ...(MODE_ARTIFACTS[detectWorkflowMode(root)] || [])])];
  const findings = [];
  for (const relativePath of expected) {
    const full = join(root, relativePath);
    if (!existsSync(full) || statSync(full).isDirectory()) continue;
    findings.push(...lintArtifactFile(relativePath, readIfExists(full) || ""));
  }
  return findings;
}

function collectBlockers(root, includeMissing = true) {
  const blockers = [];
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);

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
    for (const file of missingExpectedForPhase(root, phase).slice(0, 12)) {
      blockers.push({
        file,
        label: "Missing expected output for current phase",
        evidence: `${file} does not exist yet, but it is expected by ${phase}.`,
        suggestion: "Create the missing file or correct PROJECT_STATE.yaml if the phase is ahead of the actual project artifacts.",
        severity: file === "PROJECT_STATE.yaml" || file === "ASSUMPTIONS.md" ? "blocker" : "warning",
      });
    }
    for (const file of missingModeArtifacts(root, workflowMode)) {
      blockers.push({
        file,
        label: "Missing workflow-mode artifact",
        evidence: `${file} does not exist, but workflow mode is ${workflowMode}.`,
        suggestion: "Scaffold or create the missing mode-specific artifact before relying on this workflow mode.",
        severity: "warning",
      });
    }
  }

  const git = getGitState(root);
  if (!git.initialized) {
    blockers.push({
      file: ".git",
      label: "Git repository not initialized",
      evidence: `${root} is not inside a Git work tree.`,
      suggestion: "Run git init in the project root before writing more Genesis artifacts.",
      severity: "blocker",
    });
  } else if (git.dirty > 0) {
    blockers.push({
      file: ".git",
      label: "Uncommitted Genesis changes",
      evidence: `${git.dirty} file(s) currently have uncommitted changes.`,
      suggestion: "Commit each changed Genesis file separately to preserve rollback points.",
      severity: "warning",
    });
  }

  return blockers;
}

function blockerSummary(root) {
  return collectBlockers(root, false).map((blocker) => blocker.file);
}

function renderBlockers(root, includeMissing = true) {
  const blockers = collectBlockers(root, includeMissing);
  if (!blockers.length) return "No blockers detected by Genesis triage.";
  return blockers.map((blocker, index) => `${index + 1}. [${blocker.severity}] ${blocker.label}\n   file: ${blocker.file}\n   evidence: ${blocker.evidence}\n   suggested action: ${blocker.suggestion}`).join("\n\n");
}

function nextMissingOutput(root, phase) {
  return missingExpectedForPhase(root, phase)[0] || null;
}

function nextRecommendedAction(root) {
  const blockers = collectBlockers(root, true);
  const hard = blockers.find((blocker) => blocker.severity === "blocker");
  if (hard) return `Clear ${hard.file}: ${hard.suggestion}`;
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const missing = nextMissingOutput(root, phase);
  if (missing) return `Create ${missing} for ${phase}.`;
  return `Advance the next required ${phase} output with /genesis-next.`;
}

function renderValidationReport(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const expectedMissing = missingExpectedForPhase(root, phase);
  const phaseMissing = missingPhaseOutputs(root, phase);
  const modeMissing = missingModeArtifacts(root, workflowMode);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const phaseKnown = Boolean(PHASE_OUTPUTS[phase]);
  const phaseMismatch = phaseKnown && phaseMissing.length > 0;

  return [
    "# Genesis Validation",
    "",
    `- Project root: ${root}`,
    `- Detected phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Uncommitted changes: ${git.initialized ? git.dirty : "n/a"}`,
    `- Phase recognized: ${phaseKnown ? "yes" : "no"}`,
    `- Missing expected files through current phase: ${expectedMissing.length}`,
    `- Phase output mismatches: ${phaseMissing.length}`,
    `- Mode-specific missing artifacts: ${modeMissing.length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Blockers/warnings detected: ${blockers.length}`,
    "",
    "## Missing expected files through current phase",
    "",
    ...(expectedMissing.length ? expectedMissing.map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Lint findings",
    "",
    ...(lintFindings.length ? lintFindings.slice(0, 12).map((item) => `- ${item.file}: ${item.label}`) : ["- none"]),
    "",
    "## Verdict",
    "",
    phaseMismatch ? "- Phase contract mismatch detected. Repair missing outputs or correct PROJECT_STATE.yaml before advancing." : "- No phase-contract mismatch detected.",
    modeMissing.length ? "- Mode-specific artifacts are missing." : "- No mode-specific artifact gap detected.",
    lintFindings.length ? "- Artifact-quality lint findings exist; repair placeholder-heavy files before trusting them." : "- No placeholder-heavy artifact issues detected.",
    blockers.length ? "- Blockers or warnings exist. Review blocker files before advancing." : "- No blockers detected.",
    "",
  ].join("\n");
}

function renderStatusDashboard(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const missing = missingExpectedForPhase(root, phase);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const expansion = readIfExists(join(root, "artifacts", "expansion-integrity.md")) || "";
  const expansionRisk = /blocker|unresolved|padding|filler|ornamental subplot|no-state-change/i.test(expansion)
    ? "active risk"
    : existsSync(join(root, "artifacts", "expansion-integrity.md"))
      ? "no active risk detected"
      : "file not required yet or missing";
  const recent = listRecentProjectFiles(root, 5);

  return [
    "# Genesis Status",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Git branch: ${git.branch || "n/a"}`,
    `- Uncommitted changes: ${git.initialized ? git.dirty : "n/a"}`,
    `- Blockers: ${blockers.length || "none detected"}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Missing expected files through current phase: ${missing.length}`,
    `- Expansion integrity: ${expansionRisk}`,
    `- Next recommended action: ${nextRecommendedAction(root)}`,
    "",
    "## Top blockers",
    "",
    ...(blockers.length ? blockers.slice(0, 8).map((blocker, index) => `${index + 1}. ${blocker.label} — ${blocker.file}`) : ["- none"]),
    "",
    "## Recent project files",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- none"]),
    "",
    "## First missing expected files",
    "",
    ...(missing.length ? missing.slice(0, 12).map((file) => `- ${file}`) : ["- none"]),
    "",
    "## Notes",
    "",
    "- Regenerate this file with /genesis-status.",
    "- Use /genesis-resume for a smart resume summary.",
    "- Use /genesis-plan for a dry-run summary before /genesis-next.",
    "- Use /genesis-doctor for install, lint, and project-health checks.",
    "",
  ].join("\n");
}

function renderPlan(root) {
  const state = readIfExists(join(root, "PROJECT_STATE.yaml"));
  const phase = detectPhase(state);
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const missing = missingExpectedForPhase(root, phase);
  const nextFile = nextMissingOutput(root, phase);
  const nextPhase = PHASE_DEFINITIONS[getPhaseIndex(phase)]?.next || "unknown";

  return [
    "# Genesis Plan",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Hard blockers: ${blockers.filter((blocker) => blocker.severity === "blocker").length}`,
    `- Warnings: ${blockers.filter((blocker) => blocker.severity === "warning").length}`,
    `- Lint findings: ${lintFindings.length}`,
    `- Next expected file: ${nextFile || "none missing in current phase"}`,
    `- Next pipeline phase after this one: ${nextPhase || "none"}`,
    "",
    "## What /genesis-next would do",
    "",
    ...(blockers.length
      ? ["- Clear hard blockers first when possible.", ...blockers.slice(0, 6).map((blocker) => `- ${blocker.label}: ${blocker.suggestion}`)]
      : nextFile
        ? [`- Create or repair ${nextFile}.`, "- Update PROJECT_STATE.yaml and STATUS.md to match reality."]
        : ["- Advance the next incomplete pipeline step.", "- Update PROJECT_STATE.yaml and STATUS.md to match reality."]),
    "",
    "## Missing expected files through current phase",
    "",
    ...(missing.length ? missing.map((file) => `- ${file}`) : ["- none"]),
    "",
  ].join("\n");
}

function renderResume(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const recent = listRecentProjectFiles(root, 8);
  const nextFile = nextMissingOutput(root, phase);

  return [
    "# Genesis Resume",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Next expected file: ${nextFile || "none"}`,
    `- Suggested command: ${blockers.length ? "/genesis-blockers or /genesis-plan" : "/genesis-next"}`,
    "",
    "## Where you left off",
    "",
    ...(recent.length ? recent.map((file) => `- ${file.path} (${formatRelativeTime(file.mtimeMs)})`) : ["- no recent project files found"]),
    "",
    "## Immediate risks",
    "",
    ...(blockers.length ? blockers.slice(0, 6).map((blocker) => `- ${blocker.label} — ${blocker.file}`) : ["- none detected"]),
    "",
  ].join("\n");
}

function renderDoctorReport(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const workflowMode = detectWorkflowMode(root);
  const blockers = collectBlockers(root, true);
  const lintFindings = collectLintFindings(root, phase);
  const git = getGitState(root);
  const packageChecks = [MANIFEST_PATH, join(PACKAGE_ROOT, "SKILL.md"), join(PACKAGE_ROOT, "README.md")];
  const installIssues = packageChecks.filter((path) => !existsSync(path));
  const missingCoreDirs = PROJECT_ROOT_DIRS.filter((dir) => !pathExists(root, dir));

  return [
    "# Genesis Doctor",
    "",
    `- Package root: ${PACKAGE_ROOT}`,
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Workflow mode: ${workflowMode}`,
    `- Package file issues: ${installIssues.length}`,
    `- Missing project directories: ${missingCoreDirs.length}`,
    `- Git initialized: ${git.initialized ? "yes" : "no"}`,
    `- Blockers/warnings: ${blockers.length}`,
    `- Lint findings: ${lintFindings.length}`,
    "",
    "## Install health",
    "",
    ...(installIssues.length ? installIssues.map((path) => `- missing package file: ${path}`) : ["- package looks structurally complete"]),
    "",
    "## Project directory health",
    "",
    ...(missingCoreDirs.length ? missingCoreDirs.map((dir) => `- missing directory: ${dir}`) : ["- core directories look present"]),
    "",
    "## Lint findings",
    "",
    ...(lintFindings.length ? lintFindings.slice(0, 12).map((item) => `- ${item.file}: ${item.label}`) : ["- none"]),
    "",
    "## Blockers",
    "",
    ...(blockers.length ? blockers.slice(0, 12).map((item) => `- [${item.severity}] ${item.label} — ${item.file}`) : ["- none"]),
    "",
  ].join("\n");
}

function renderLintReport(root) {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const findings = collectLintFindings(root, phase);
  return [
    "# Genesis Lint",
    "",
    `- Project root: ${root}`,
    `- Current phase: ${phase}`,
    `- Findings: ${findings.length}`,
    "",
    ...(findings.length ? findings.map((item, index) => `${index + 1}. ${item.file} — ${item.label}\n   evidence: ${item.evidence}`) : ["No artifact-quality lint findings detected."]),
    "",
  ].join("\n");
}

function findGenesisProjects(startDir, maxDepth = 3) {
  const found = new Set();
  function walk(dir, depth) {
    if (existsSync(join(dir, "PROJECT_STATE.yaml"))) found.add(dir);
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

function slugifyProjectName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "genesis-project";
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function scaffoldTemplate(projectRoot, templatePath, destinationPath, overwrite = false) {
  const source = resolve(PACKAGE_ROOT, templatePath);
  const destination = join(projectRoot, destinationPath);
  ensureDir(dirname(destination));
  if (!overwrite && existsSync(destination)) return "skipped";
  copyFileSync(source, destination);
  return "written";
}

function findTemplateEntryByDestination(destination) {
  return TEMPLATE_SCAFFOLDS.find((item) => item.destination === destination) || null;
}

function getModeTemplateEntries(mode) {
  const destinations = new Set(MODE_ARTIFACTS[mode] || []);
  return TEMPLATE_SCAFFOLDS.filter((item) => destinations.has(item.destination));
}

function getModeBundleEntries(mode) {
  const destinations = new Set(MODE_SCAFFOLD_BUNDLES[mode] || []);
  return TEMPLATE_SCAFFOLDS.filter((item) => destinations.has(item.destination));
}

function scaffoldModeArtifacts(projectRoot, mode, overwrite = false) {
  return getModeTemplateEntries(mode).map((item) => ({ label: item.label, destination: item.destination, status: scaffoldTemplate(projectRoot, item.template, item.destination, overwrite) }));
}

function scaffoldModeBundle(projectRoot, mode, overwrite = false) {
  return getModeBundleEntries(mode).map((item) => ({ label: item.label, destination: item.destination, status: scaffoldTemplate(projectRoot, item.template, item.destination, overwrite) }));
}

function writeIfMissing(path, content) {
  if (!existsSync(path)) writeFileSync(path, content, "utf8");
}

function initializeProject(root, projectName, idea) {
  ensureDir(root);
  for (const dir of PROJECT_ROOT_DIRS) ensureDir(join(root, dir));

  writeIfMissing(
    join(root, "PROJECT_STATE.yaml"),
    [
      `project_name: ${stringifyScalar(projectName)}`,
      `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
      `current_phase: ${stringifyScalar("Phase 0: Intake")}`,
      'phase_gate: "intake"',
      'status: "initialized"',
      'language: "unknown"',
      'workflow_mode: "unknown"',
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
    `# Assumptions\n\n## Explicit user input\n\n- Project: ${projectName}\n- Seed idea: ${idea || "Not provided yet."}\n\n## Inferred assumptions\n\n- Language: unknown\n- Genre: unknown\n- Audience: unknown\n- Target length: unknown\n- Narrative mode: unknown\n- Workflow mode: unknown (novel, memoir, narrative nonfiction, prescriptive nonfiction, study guide, certification prep, series installment, series repair, other)\n\nMark each assumption as confirmed, provisional, or rejected during Phase 0.\n`,
  );

  writeIfMissing(join(root, "artifacts", "00-brief.md"), `# Brief\n\n## Original idea\n\n${idea || "Add the writer's seed idea here."}\n\n## Intake scaffold\n\n- Language:\n- Genre:\n- Audience:\n- Target length:\n- Narrative mode:\n- Workflow mode:\n- Reader promise:\n`);
  writeIfMissing(join(root, "artifacts", "01-market-map.md"), "# Market Map\n\n- market signals\n- comp titles\n- recurring patterns\n- whitespace opportunity\n");
  writeIfMissing(join(root, "artifacts", "02-story-engine.md"), "# Story Engine\n\n- premise expansion\n- central conflict\n- escalation logic\n- differentiation strategy\n");
  writeIfMissing(join(root, "research", "reference-inventory.md"), "# Reference Inventory\n\n## Source index\n\n| id | source type | title | author / org | date | status | location | notes |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n");
  writeIfMissing(join(root, "research", "notes", "README.md"), "# Research Notes\n\nUse this folder for study notes, source summaries, interview notes, certification objective breakdowns, and working research memos.\n");
  writeIfMissing(join(root, "research", "sources", "README.md"), "# Research Sources\n\nStore downloaded PDFs, copied standards, exam blueprints, article captures, transcripts, and other raw reference material here when permitted.\n");

  for (const destination of ["artifacts/author-intent.md", "artifacts/taste-profile.md", "artifacts/risk-budget.md", "artifacts/review-personas.md", "artifacts/reader-promise-tracker.md", "artifacts/drift-loop-alarm.md", "artifacts/expansion-integrity.md"]) {
    const item = findTemplateEntryByDestination(destination);
    if (item) scaffoldTemplate(root, item.template, item.destination, false);
  }

  writeIfMissing(join(root, "artifacts", "discarded-choices.md"), "# Discarded Choices\n\nTrack rejected openings, names, tones, premises, and turns here.\n");
  writeIfMissing(join(root, "STATUS.md"), renderStatusDashboard(root));
}

function maybeInitGit(root) {
  if (existsSync(join(root, ".git"))) return false;
  execSync("git init", { cwd: root, stdio: "ignore" });
  return true;
}

function applyWorkflowModeToProject(root, mode) {
  const statePath = join(root, "PROJECT_STATE.yaml");
  const assumptionsPath = join(root, "ASSUMPTIONS.md");
  const briefPath = join(root, "artifacts", "00-brief.md");
  writeFileSync(statePath, setWorkflowModeInState(readIfExists(statePath), mode), "utf8");
  writeFileSync(assumptionsPath, setWorkflowModeInAssumptions(readIfExists(assumptionsPath), mode), "utf8");
  const brief = readIfExists(briefPath);
  if (brief) writeFileSync(briefPath, updateBriefWorkflowMode(brief, mode), "utf8");
}

function inferPhaseFromFiles(root) {
  let phase = "Phase 0: Intake";
  for (const item of PHASE_DEFINITIONS) {
    const total = item.outputs.length || 1;
    const present = item.outputs.filter((file) => pathExists(root, file)).length;
    if (present > 0 && present >= Math.ceil(total / 3)) phase = item.label;
  }
  return phase;
}

function migrateProject(root) {
  ensureDir(root);
  for (const dir of PROJECT_ROOT_DIRS) ensureDir(join(root, dir));
  if (!existsSync(join(root, "PROJECT_STATE.yaml"))) {
    const inferredPhase = inferPhaseFromFiles(root);
    const projectName = basename(root);
    writeFileSync(
      join(root, "PROJECT_STATE.yaml"),
      [
        `project_name: ${stringifyScalar(projectName)}`,
        `genesis_schema_version: ${stringifyScalar(GENESIS_SCHEMA_VERSION)}`,
        `current_phase: ${stringifyScalar(inferredPhase)}`,
        `workflow_mode: ${stringifyScalar("unknown")}`,
        `status: ${stringifyScalar("migrated")}`,
        `migration_note: ${stringifyScalar("PROJECT_STATE.yaml created by genesis-migrate")}`,
        "",
      ].join("\n"),
      "utf8",
    );
  } else {
    const statePath = join(root, "PROJECT_STATE.yaml");
    const state = readIfExists(statePath) || "";
    if (!/^genesis_schema_version\s*:/im.test(state)) writeFileSync(statePath, setYamlScalar(state, "genesis_schema_version", GENESIS_SCHEMA_VERSION), "utf8");
  }
  writeIfMissing(join(root, "ASSUMPTIONS.md"), "# Assumptions\n\n## Inferred assumptions\n\n- Workflow mode: unknown\n");
  writeIfMissing(join(root, "artifacts", "00-brief.md"), "# Brief\n\nRecovered by /genesis-migrate. Fill in the original idea and reader promise.\n");
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  for (const expected of getExpectedFilesForPhase(phase)) {
    const template = findTemplateEntryByDestination(expected);
    if (template) scaffoldTemplate(root, template.template, template.destination, false);
    else if (expected.endsWith("/") || expected === "manuscript/chapters") ensureDir(join(root, expected));
  }
  const mode = detectWorkflowMode(root);
  scaffoldModeArtifacts(root, mode, false);
  const gitInitialized = maybeInitGit(root);
  writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
  return { root, phase, mode, gitInitialized, missing: missingExpectedForPhase(root, phase) };
}

function buildNextPrompt(root, args, commandName = "genesis-next") {
  const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
  const missing = missingExpectedForPhase(root, phase).slice(0, 12);
  const blockers = blockerSummary(root);
  const nextFile = nextMissingOutput(root, phase);

  return `Use the \`genesis-for-pi\` skill and advance this Genesis for Pi project. The invoking command was \`/${commandName}\`.

Project root: ${root}
Detected current phase: ${phase}
User instructions: ${args.trim() || "none"}
Known blocker files from extension precheck: ${blockers.length ? blockers.join(", ") : "none detected by lightweight precheck"}
First missing expected files through the current phase: ${missing.length ? missing.join(", ") : "none"}
Next expected file by phase-aware precheck: ${nextFile || "none"}

Rules:
1. Load \`PROJECT_STATE.yaml\`, \`ASSUMPTIONS.md\`, and \`references/pipeline/manifest.yaml\` from the skill package before doing anything else.
2. Identify the current phase, the next incomplete required output, and any active blocker that prevents safe advancement.
3. Continue from the current state; do not restart unless state is missing or explicitly invalid.
4. Bypass optional writer approval gates for this turn unless the user explicitly asks for a check-in.
5. Do not bypass hard blockers: active drift-loop hard stops, open blocker/high revision tickets, unresolved name-collision blockers, unresolved AI-tell blockers, unresolved author-voice blockers, unresolved subtext/ear/over-polish blockers, unresolved expansion-integrity blockers, missing required phase outputs, or phase contract mismatches.
6. If blockers exist, clear them first when possible by updating the relevant blocker files, repair artifacts, revision tickets, and manuscript/project files with concrete evidence-based fixes.
7. Once blockers are cleared or none exist, produce only the next required pipeline step's outputs, update \`PROJECT_STATE.yaml\`, and commit each changed file separately.
8. Preserve the Human Voice Rule and the Expansion Integrity Rule.
9. Do not skip Phase 4. Do not run Final Score before Adversarial Audit is complete.

Proceed now.`;
}

function buildScoreToTicketsPrompt(root) {
  return [
    "Use the `genesis-for-pi` skill and convert current scoring/audit findings into actionable revision tickets.",
    "",
    `Project root: ${root}`,
    "",
    "Inspect these files first:",
    "- artifacts/09-genesis-score.md",
    "- artifacts/08-adversarial-audit.md",
    "- artifacts/revision-tickets.md",
    "- evaluations/chapter-scorecards.md",
    "",
    "Required outputs:",
    "- update artifacts/revision-tickets.md with issue, evidence, affected files, severity, repair type, owner phase, and status",
    "- if scoring evidence is weak, note that explicitly instead of inventing certainty",
  ].join("\n");
}

function buildAiThrillerReviewPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a publication-facing developmental review for an AI thriller, system thriller, or near-future governance/automation novel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- docs/ai-thriller-review-prompt.md",
    "- docs/ai-thriller-qa-checklist.md",
    "- manuscript/chapters/",
    "- artifacts/publication-shape.md",
    "- artifacts/system-rule-sheet.md",
    "- artifacts/authority-chain-map.md",
    "- artifacts/opposition-case.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/revision-tickets.md",
    "",
    "Focus the review on:",
    "- middle-act repetition or stall",
    "- protagonist withholding as a plot engine",
    "- reveal fatigue / too many hidden layers",
    "- embodied consequence versus screen-based diagnosis",
    "- system-rule clarity",
    "- authority-chain plausibility",
    "- governance / organizational clarity",
    "- character voice differentiation",
    "- agency-before-cost for harmed or beneficiary characters",
    "- opposition positive-case strength",
    "- prose over-concentration and repeated verdict lines",
    "- climax technical clarity",
    "- ending shape: standalone vs series, moral resolution vs publication-strength closure",
    "- continuity and domain plausibility risks",
    "",
    "Required outputs:",
    "- write the review to artifacts/ai-thriller-review.md",
    "- create or update artifacts/revision-tickets.md for any concrete high-leverage fixes",
    "- if the review finds publication-shape or authority/system clarity problems, reflect them in the matching artifacts instead of leaving them only in prose",
    "",
    "Use the structure and standards in docs/ai-thriller-review-prompt.md.",
  ].join("\n");
}

function buildAiThrillerFixPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a prioritized repair pass for an AI thriller, system thriller, or near-future governance/automation novel.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- artifacts/ai-thriller-review.md",
    "- docs/ai-thriller-review-prompt.md",
    "- docs/ai-thriller-qa-checklist.md",
    "- artifacts/revision-tickets.md",
    "- artifacts/publication-shape.md",
    "- artifacts/system-rule-sheet.md",
    "- artifacts/authority-chain-map.md",
    "- artifacts/opposition-case.md",
    "- artifacts/continuity-ledger.md",
    "- artifacts/expansion-integrity.md",
    "- manuscript/chapters/",
    "",
    "Repair priorities:",
    "1. middle-act repetition and withholding-stall",
    "2. reveal consolidation and embodied consequence",
    "3. system-rule and authority-chain clarity",
    "4. character voice differentiation and agency-before-cost",
    "5. opposition positive-case and ending publication shape",
    "6. continuity and domain plausibility fixes",
    "",
    "Rules:",
    "- make the highest-leverage fixes first; do not do cosmetic cleanup before structural repair",
    "- update artifacts/revision-tickets.md as tickets are fixed, deferred, or split",
    "- update matching artifacts when a repair changes system rules, authority logic, opposition framing, publication shape, or continuity",
    "- if the fix scope is too large for one pass, complete the most important repair cluster and leave the next cluster as explicit open tickets",
    "- preserve the morally difficult parts that make the book distinct; do not flatten the system into a generic evil AI",
    "",
    "Required outputs:",
    "- repair the manuscript and supporting artifacts where the fixes are clear and high-leverage",
    "- update artifacts/revision-tickets.md with current statuses",
    "- update PROJECT_STATE.yaml and STATUS.md to reflect the repair pass",
  ].join("\n");
}

function buildIngestPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and ingest existing manuscript, notes, research, or canon material into this Genesis project.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Material or instructions: ${args.trim()}` : "Material or instructions: ask the user what file, folder, or manuscript material should be ingested.",
    "",
    "Goals:",
    "- do not restart the project unless the user explicitly asks",
    "- identify source files before drawing conclusions",
    "- populate or update durable artifacts rather than leaving the ingestion only in chat",
    "- preserve uncertainty with evidence notes when source material is incomplete",
    "",
    "Possible outputs depending on source material:",
    "- artifacts/continuity-ledger.md",
    "- artifacts/voice-bible.md",
    "- artifacts/author-voice-fingerprint.md",
    "- artifacts/reader-promise-tracker.md",
    "- artifacts/revision-tickets.md",
    "- artifacts/canon-lock.md for series repair",
    "- PROJECT_STATE.yaml and STATUS.md updates",
  ].join("\n");
}

function buildVoiceIngestPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and ingest author voice samples for this project.",
    "",
    `Project root: ${root}`,
    args.trim() ? `Voice sample paths or instructions: ${args.trim()}` : "Voice sample paths or instructions: ask the user for sample files or pasted samples.",
    "",
    "Required outputs:",
    "- update artifacts/author-voice-fingerprint.md with sentence habits, rhythm, punctuation tolerance, humor, lyricism, emotional restraint, taboo phrasing, obsessions, and productive imperfections",
    "- update artifacts/voice-bible.md with voice rules and anti-voice constraints",
    "- update artifacts/over-polish-audit.md if sample evidence shows productive roughness that must be protected",
    "- update PROJECT_STATE.yaml and STATUS.md if the approval gate or voice state changes",
    "",
    "Do not make the voice cleaner than the samples. Preserve specificity, asymmetry, and controlled awkwardness where present.",
  ].join("\n");
}

function buildVoiceDriftPrompt(root, args = "") {
  return [
    "Use the `genesis-for-pi` skill and run a voice-drift audit against the current manuscript.",
    "",
    `Project root: ${root}`,
    args.trim() ? `User instructions: ${args.trim()}` : "User instructions: none",
    "",
    "Read these first when present:",
    "- artifacts/author-voice-fingerprint.md",
    "- artifacts/voice-bible.md",
    "- artifacts/over-polish-audit.md",
    "- artifacts/ear-pass.md",
    "- manuscript/chapters/",
    "",
    "Audit for:",
    "- generic competence replacing author rhythm",
    "- too-smooth revision polish",
    "- repeated assistant-like sentence shapes",
    "- dialogue that violates the voice bible",
    "- loss of productive imperfection, omission, humor, or restraint",
    "",
    "Required outputs:",
    "- update artifacts/ear-pass.md",
    "- update artifacts/over-polish-audit.md",
    "- create or update artifacts/revision-tickets.md for concrete voice-drift repairs",
  ].join("\n");
}

export default function (pi) {
  pi.registerTool({
    name: "genesis_blocker_triage",
    label: "Genesis Blocker Triage",
    description: "Inspect a Genesis for Pi project for blocker files, evidence snippets, and suggested repair actions.",
    promptSnippet: "Inspect Genesis blocker files and missing required outputs with evidence snippets.",
    promptGuidelines: ["Use genesis_blocker_triage before or during Genesis advancement when you need a fast blocker summary with evidence and suggested actions."],
    parameters: Type.Object({
      project_root: Type.Optional(Type.String({ description: "Optional project root. Defaults to current working directory." })),
      include_missing: Type.Optional(Type.Boolean({ description: "Include missing required outputs in the report for the current phase." })),
      focus_file: Type.Optional(Type.String({ description: "Optional blocker file to isolate in the response." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const root = findProjectRoot(params.project_root || ctx.cwd);
      const phase = detectPhase(readIfExists(join(root, "PROJECT_STATE.yaml")));
      let blockers = collectBlockers(root, params.include_missing ?? true);
      if (params.focus_file) blockers = blockers.filter((blocker) => blocker.file === params.focus_file);
      const text = blockers.length
        ? [`Genesis root: ${root}`, `Current phase: ${phase}`, "", ...blockers.map((blocker, index) => `${index + 1}. ${blocker.label} (${blocker.file})\nEvidence: ${blocker.evidence}\nSuggested action: ${blocker.suggestion}`)].join("\n")
        : `Genesis root: ${root}\nCurrent phase: ${phase}\n\nNo blockers detected by Genesis triage.`;
      return { content: [{ type: "text", text }], details: { root, phase, blockers } };
    },
  });

  const registerStatusCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderStatusDashboard(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerPlanCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderPlan(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerResumeCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderResume(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerValidateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    const report = renderValidationReport(root);
    ctx.ui.notify(`${report}\nSTATUS.md updated.`, /mismatch|blockers|lint findings: [1-9]/i.test(report) ? "warning" : "info");
  } });

  const registerDoctorCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`${renderDoctorReport(root)}\nSTATUS.md updated.`, "info");
  } });

  const registerLintCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    ctx.ui.notify(renderLintReport(root), /Findings: 0/.test(renderLintReport(root)) ? "info" : "warning");
  } });

  const registerDashboardCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const dashboard = renderDashboard(root);
    writeFileSync(join(root, "STATUS.md"), dashboard, "utf8");
    ctx.ui.notify(`${dashboard}\nSTATUS.md updated.`, "info");
  } });

  const registerCompileCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = compileManuscript(root);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Compiled manuscript.\n- delivery/manuscript-full.md\n- delivery/manuscript-compile-report.md\nChapters: ${result.chapters}\nWords: ${result.words}\nSTATUS.md updated.`, result.chapters ? "info" : "warning");
  } });

  const registerExportCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = createEditorialExport(root);
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Created Genesis delivery package files:\n${result.files.map((file) => `- ${file}`).join("\n")}\nChapters: ${result.chapters}\nWords: ${result.words}\nSTATUS.md updated.`, "info");
  } });

  const registerCheckpointCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = checkpointGenesisFiles(root, args);
    const lines = result.results.length ? result.results.map((item) => `- ${item.file}: ${item.status}${item.status === "committed" ? ` (${item.message})` : ` — ${item.message}`}`) : ["- no changed Genesis files matched the checkpoint request"];
    ctx.ui.notify(`Genesis checkpoint\nProject: ${root}\nChanged Genesis files: ${result.changed}\nAttempted commits: ${result.attempted}\n${lines.join("\n")}`, result.results.some((item) => item.status === "failed") ? "warning" : "info");
  } });

  const queuePromptCommand = (name, description, buildPrompt) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerSetModeCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const requested = args.trim().toLowerCase();
    const mode = WORKFLOW_MODES.includes(requested) ? requested : await ctx.ui.select("Choose a workflow mode:", [...WORKFLOW_MODES]);
    if (!mode) return;
    applyWorkflowModeToProject(root, mode);
    const bundleEntries = getModeBundleEntries(mode);
    let bundleResults = [];
    if (bundleEntries.length) {
      const shouldScaffold = await ctx.ui.confirm("Scaffold recommended mode bundle?", `Create starter files for ${mode}?\n\n${bundleEntries.map((item) => `- ${item.destination}`).join("\n")}`);
      if (shouldScaffold) bundleResults = scaffoldModeBundle(root, mode, false);
    }
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Workflow mode set to ${mode}. STATUS.md updated.${bundleResults.length ? `\nMode bundle:\n${bundleResults.map((item) => `- ${item.destination}: ${item.status}`).join("\n")}` : ""}`, "info");
  } });

  const registerNextCommand = (name, description) => pi.registerCommand(name, { description, getArgumentCompletions: (prefix) => {
    const items = ["main checkpoints only", "careful mode", "fast mode", "do not draft prose yet", "continue without optional approval gates", "clear blockers first"].map((value) => ({ value, label: value }));
    const filtered = items.filter((item) => item.value.startsWith(prefix));
    return filtered.length ? filtered : null;
  }, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    if (!ctx.isIdle()) {
      ctx.ui.notify(`Agent is busy. Queueing /${name} as a follow-up.`, "info");
      pi.sendUserMessage(buildNextPrompt(root, args, name), { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(buildNextPrompt(root, args, name));
  } });

  const registerTemplateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const labels = TEMPLATE_SCAFFOLDS.map((item) => item.label);
    const selected = await ctx.ui.multiSelect?.("Choose templates to scaffold:", labels);
    const chosen = selected?.length ? selected : [await ctx.ui.select("Choose a template to scaffold:", labels)].filter(Boolean);
    if (!chosen.length) return;
    const overwrite = await ctx.ui.confirm("Overwrite existing files?", "If yes, existing artifact files for the selected templates will be replaced.");
    const results = chosen.map((label) => {
      const item = TEMPLATE_SCAFFOLDS.find((entry) => entry.label === label);
      return `${label}: ${scaffoldTemplate(root, item.template, item.destination, overwrite)}`;
    });
    writeFileSync(join(root, "STATUS.md"), renderStatusDashboard(root), "utf8");
    ctx.ui.notify(`Scaffolded templates in ${root}\n${results.join("\n")}`, "info");
  } });

  const registerFluffAuditCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = [
      "Use the `genesis-for-pi` skill and run a focused fluff audit.",
      "",
      `Project root: ${root}`,
      "",
      "Audit for padding, ornamental subplots, duplicate beats, atmospheric drift, repeated introspection, duplicate exposition, low-stakes banter, and no-state-change scenes.",
      "Update artifacts/expansion-integrity.md, artifacts/revision-tickets.md, and artifacts/drift-loop-alarm.md as needed.",
    ].join("\n");
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerScoreToTicketsCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildScoreToTicketsPrompt(root);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerAiThrillerReviewCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildAiThrillerReviewPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerAiThrillerFixCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const message = buildAiThrillerFixPrompt(root, args);
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued /${name} as a follow-up.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerBlockerCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
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
    ctx.ui.notify([`${blocker.label}`, `file: ${blocker.file}`, `evidence: ${blocker.evidence}`, `suggested action: ${blocker.suggestion}`].join("\n"), blocker.severity === "blocker" ? "warning" : "info");
    const shouldQueueFix = await ctx.ui.confirm("Queue Genesis fix?", `Ask Genesis to clear this blocker now?\n\n${blocker.file}`);
    if (!shouldQueueFix) return;
    const message = `${buildNextPrompt(root, `Focus first on blocker file ${blocker.file}. Evidence: ${blocker.evidence}. Suggested action: ${blocker.suggestion}.`, name)}\n\nStart by clearing ${blocker.file}.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui.notify(`Queued blocker-fix follow-up for ${blocker.file}.`, "info");
      return;
    }
    pi.sendUserMessage(message);
  } });

  const registerInitCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const typedName = args.trim() || (await ctx.ui.input("Genesis project name:", "my-book"));
    if (!typedName) return;
    const projectRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(projectRoot) && existsSync(join(projectRoot, "PROJECT_STATE.yaml"))) {
      ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
      return;
    }
    const idea = (await ctx.ui.editor("Seed idea:", "Describe the book idea, tone, genre pressure, reader promise, and anything that must not be smoothed away.")) || "";
    initializeProject(projectRoot, typedName, idea);
    let gitInitialized = false;
    try { gitInitialized = maybeInitGit(projectRoot); } catch { ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning"); }
    writeFileSync(join(projectRoot, "STATUS.md"), renderStatusDashboard(projectRoot), "utf8");
    ctx.ui.notify(`Initialized Genesis project at ${projectRoot}${gitInitialized ? "\nGit repository initialized." : ""}`, "info");
    const shouldStart = await ctx.ui.confirm("Start intake now?", "Queue Genesis to begin Phase 0 intake in the new project?");
    if (!shouldStart) return;
    const kickoff = `${buildNextPrompt(projectRoot, `Project root: ${projectRoot}. Start with Phase 0 intake using this seed idea: ${idea || "No idea captured yet."}`, name)}\n\nThe project tree already exists. Fill in the Phase 0 outputs now.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });

  const registerStartCommand = (name, description) => pi.registerCommand(name, { description, handler: async (args, ctx) => {
    const typedName = args.trim() || (await ctx.ui.input("Genesis project name:", "my-book"));
    if (!typedName) return;
    const projectRoot = resolve(ctx.cwd, slugifyProjectName(typedName));
    if (existsSync(projectRoot) && existsSync(join(projectRoot, "PROJECT_STATE.yaml"))) {
      ctx.ui.notify(`Genesis project already exists: ${projectRoot}`, "warning");
      return;
    }
    const idea = (await ctx.ui.editor("Seed idea:", "Describe the book idea, tone, genre pressure, reader promise, and anything that must not be smoothed away.")) || "";
    const mode = await ctx.ui.select("Choose a workflow mode:", [...WORKFLOW_MODES]);
    if (!mode) return;
    initializeProject(projectRoot, typedName, idea);
    try { maybeInitGit(projectRoot); } catch { ctx.ui.notify("Project created, but git init failed. Initialize git manually if needed.", "warning"); }
    applyWorkflowModeToProject(projectRoot, mode);
    const bundleResults = scaffoldModeBundle(projectRoot, mode, false);
    writeFileSync(join(projectRoot, "STATUS.md"), renderStatusDashboard(projectRoot), "utf8");
    ctx.ui.notify(`Initialized Genesis project at ${projectRoot}\nWorkflow mode: ${mode}${bundleResults.length ? `\nMode bundle:\n${bundleResults.map((item) => `- ${item.destination}: ${item.status}`).join("\n")}` : ""}`, "info");
    const kickoff = `${buildNextPrompt(projectRoot, `Project root: ${projectRoot}. Workflow mode: ${mode}. Start with Phase 0 intake using this seed idea: ${idea || "No idea captured yet."}`, name)}\n\nThe project tree already exists. Fill in the Phase 0 outputs now.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });

  const registerMigrateCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const root = findProjectRoot(ctx.cwd);
    const result = migrateProject(root);
    ctx.ui.notify(`Migrated Genesis project at ${result.root}\nPhase: ${result.phase}\nWorkflow mode: ${result.mode}\nRemaining missing files: ${result.missing.length}`, result.missing.length ? "warning" : "info");
  } });

  const registerOpenCommand = (name, description) => pi.registerCommand(name, { description, handler: async (_args, ctx) => {
    const projects = findGenesisProjects(ctx.cwd, 3);
    if (!projects.length) {
      ctx.ui.notify("No Genesis projects found under the current working directory.", "warning");
      return;
    }
    const selectedProject = await ctx.ui.select("Choose a Genesis project:", projects);
    if (!selectedProject) return;
    const action = await ctx.ui.select("What should Genesis do with this project?", ["Show dashboard", "Show status", "Show plan", "Show resume", "Run doctor", "Inspect blockers", "Compile manuscript", "Export delivery package", "Migrate project", "Advance next step"]);
    if (!action) return;
    if (action === "Show dashboard") {
      const dashboard = renderDashboard(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), dashboard, "utf8");
      ctx.ui.notify(`${dashboard}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show status") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderStatusDashboard(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show plan") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderPlan(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Show resume") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderResume(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Run doctor") {
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`${renderDoctorReport(selectedProject)}\nSTATUS.md updated.`, "info");
      return;
    }
    if (action === "Inspect blockers") {
      ctx.ui.notify(`Genesis root: ${selectedProject}\n\n${renderBlockers(selectedProject, true)}`, "info");
      return;
    }
    if (action === "Compile manuscript") {
      const result = compileManuscript(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`Compiled delivery/manuscript-full.md (${result.chapters} chapter file(s), ${result.words} words).`, result.chapters ? "info" : "warning");
      return;
    }
    if (action === "Export delivery package") {
      const result = createEditorialExport(selectedProject);
      writeFileSync(join(selectedProject, "STATUS.md"), renderStatusDashboard(selectedProject), "utf8");
      ctx.ui.notify(`Exported delivery package files:\n${result.files.map((file) => `- ${file}`).join("\n")}`, "info");
      return;
    }
    if (action === "Migrate project") {
      const result = migrateProject(selectedProject);
      ctx.ui.notify(`Migrated Genesis project at ${result.root}\nRemaining missing files: ${result.missing.length}`, result.missing.length ? "warning" : "info");
      return;
    }
    const kickoff = `${buildNextPrompt(selectedProject, `Project root: ${selectedProject}. Continue this project from its current state.`, name)}\n\nUse ${selectedProject} as the active project root.`;
    if (!ctx.isIdle()) {
      pi.sendUserMessage(kickoff, { deliverAs: "followUp" });
      return;
    }
    pi.sendUserMessage(kickoff);
  } });

  registerStatusCommand("genesis-status", "Show Genesis for Pi project status from PROJECT_STATE and artifact files");
  registerStatusCommand("bg-status", "Legacy alias for /genesis-status");
  registerPlanCommand("genesis-plan", "Show a dry-run summary of what Genesis would do next");
  registerPlanCommand("bg-plan", "Legacy alias for /genesis-plan");
  registerResumeCommand("genesis-resume", "Summarize where a Genesis project left off and what should happen next");
  registerResumeCommand("bg-resume", "Legacy alias for /genesis-resume");
  registerDoctorCommand("genesis-doctor", "Check install health, project health, blockers, and lint findings");
  registerDoctorCommand("bg-doctor", "Legacy alias for /genesis-doctor");
  registerLintCommand("genesis-lint", "Lint Genesis artifacts for placeholders, empty sections, and weak scaffolds");
  registerLintCommand("bg-lint", "Legacy alias for /genesis-lint");
  registerDashboardCommand("genesis-dashboard", "Show a richer Genesis project dashboard and write it to STATUS.md");
  registerDashboardCommand("bg-dashboard", "Legacy alias for /genesis-dashboard");
  registerCompileCommand("genesis-compile", "Compile manuscript chapters into delivery/manuscript-full.md");
  registerCompileCommand("bg-compile", "Legacy alias for /genesis-compile");
  registerExportCommand("genesis-export", "Create editorial handoff, beta packet, revision board, and export manifest files");
  registerExportCommand("bg-export", "Legacy alias for /genesis-export");
  registerCheckpointCommand("genesis-checkpoint", "Commit changed Genesis project files one file at a time");
  registerCheckpointCommand("bg-checkpoint", "Legacy alias for /genesis-checkpoint");
  queuePromptCommand("genesis-ingest", "Ingest an existing manuscript, notes folder, research, or canon material into Genesis artifacts", buildIngestPrompt);
  queuePromptCommand("bg-ingest", "Legacy alias for /genesis-ingest", buildIngestPrompt);
  queuePromptCommand("genesis-voice-ingest", "Ingest author voice samples into the voice fingerprint and voice bible", buildVoiceIngestPrompt);
  queuePromptCommand("bg-voice-ingest", "Legacy alias for /genesis-voice-ingest", buildVoiceIngestPrompt);
  queuePromptCommand("genesis-voice-drift", "Audit manuscript chapters against the author voice fingerprint and voice bible", buildVoiceDriftPrompt);
  queuePromptCommand("bg-voice-drift", "Legacy alias for /genesis-voice-drift", buildVoiceDriftPrompt);
  registerInitCommand("genesis-init", "Create a fresh Genesis for Pi project tree and optionally start intake");
  registerInitCommand("bg-init", "Legacy alias for /genesis-init");
  registerStartCommand("genesis-start", "Bootstrap a new Genesis project with mode selection, scaffolds, and intake kickoff");
  registerStartCommand("bg-start", "Legacy alias for /genesis-start");
  registerOpenCommand("genesis-open", "Pick an existing Genesis project, then inspect or continue it");
  registerOpenCommand("bg-open", "Legacy alias for /genesis-open");
  registerNextCommand("genesis-next", "Clear blockers when possible, then advance Genesis for Pi to the next incomplete pipeline step");
  registerNextCommand("bg-next", "Legacy alias for /genesis-next");
  registerValidateCommand("genesis-validate", "Validate the current Genesis phase contract, missing outputs, and blocker state");
  registerValidateCommand("bg-validate", "Legacy alias for /genesis-validate");
  registerMigrateCommand("genesis-migrate", "Repair or upgrade an older Genesis project tree to the current layout");
  registerMigrateCommand("bg-migrate", "Legacy alias for /genesis-migrate");
  registerSetModeCommand("genesis-set-mode", "Set the active Genesis workflow mode and update project files");
  registerSetModeCommand("bg-set-mode", "Legacy alias for /genesis-set-mode");
  registerBlockerCommand("genesis-blockers", "Interactively inspect Genesis blockers and optionally queue a blocker-fix turn");
  registerBlockerCommand("bg-blockers", "Legacy alias for /genesis-blockers");
  registerTemplateCommand("genesis-scaffold-templates", "Scaffold core Genesis artifact templates into the current project");
  registerTemplateCommand("bg-scaffold-templates", "Legacy alias for /genesis-scaffold-templates");
  registerScoreToTicketsCommand("genesis-score-to-tickets", "Convert Genesis score and audit findings into revision tickets");
  registerScoreToTicketsCommand("bg-score-to-tickets", "Legacy alias for /genesis-score-to-tickets");
  registerAiThrillerReviewCommand("genesis-ai-thriller-review", "Run a publication-facing developmental review for an AI thriller or system-driven novel");
  registerAiThrillerReviewCommand("bg-ai-thriller-review", "Legacy alias for /genesis-ai-thriller-review");
  registerAiThrillerFixCommand("genesis-ai-thriller-fix", "Run a prioritized repair pass for an AI thriller or system-driven novel");
  registerAiThrillerFixCommand("bg-ai-thriller-fix", "Legacy alias for /genesis-ai-thriller-fix");
  registerFluffAuditCommand("genesis-audit-fluff", "Run a focused anti-padding audit for fluff, filler scenes, and ornamental subplots");
  registerFluffAuditCommand("bg-audit-fluff", "Legacy alias for /genesis-audit-fluff");
}
