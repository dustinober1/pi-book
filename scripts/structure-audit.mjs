import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Structure audit.
//
// Two cheap deterministic checks reviewers hit hard:
//   1. Assembly-draft detector: scan chapter headings for "2A / 2B / 3A / 3B"
//      scaffolding that signals the manuscript grew by insertion rather than
//      by final design.
//   2. Post-climax bloat detector: compute word counts per top-level chapter,
//      flag any chapter that is more than a configurable share of the total
//      manuscript (default 25%), and flag when the longest chapter sits after
//      the dramatic climax token.

function usage() {
  console.log(`Usage: node scripts/structure-audit.mjs [target] [options]

Target:
  file.md              Audit one compiled manuscript file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --max-chapter-share <pct>  Flag chapters above this share of total words (default: 25)
  --climax-token <phrase>    Scene/heading text that marks the dramatic climax (default: auto from headings)
  --json                     Output JSON instead of Markdown
  --write-audit              Write/update a bounded section in artifacts/structure-audit.md
  --help                     Show this help

Examples:
  npm run audit:structure -- examples/novel-project
  node scripts/structure-audit.mjs examples/novel-project --max-chapter-share 20
  node scripts/structure-audit.mjs examples/novel-project --write-audit
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), maxChapterShare: 25, climaxToken: "", json: false, writeAudit: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") { usage(); process.exit(0); }
    if (token === "--json") { args.json = true; continue; }
    if (token === "--write-audit") { args.writeAudit = true; continue; }
    if (token === "--max-chapter-share") { args.maxChapterShare = Number.parseFloat(argv[++i] || ""); continue; }
    if (token === "--climax-token") { args.climaxToken = argv[++i] || ""; continue; }
    if (token.startsWith("--")) throw new Error(`Unknown option: ${token}`);
    positional.push(token);
  }
  if (positional.length) args.target = positional[0];
  if (!Number.isFinite(args.maxChapterShare) || args.maxChapterShare <= 0 || args.maxChapterShare > 100) {
    throw new Error("--max-chapter-share must be a percentage between 0 and 100.");
  }
  if (args.writeAudit && args.json) throw new Error("--json cannot be combined with --write-audit.");
  return args;
}

function walkMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdownFiles(fullPath));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(fullPath);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function collectFiles(target) {
  const resolved = resolve(target);
  if (!existsSync(resolved)) throw new Error(`Target does not exist: ${resolved}`);
  const stats = statSync(resolved);
  if (stats.isFile()) {
    if (!/\.md$/i.test(resolved)) throw new Error(`Expected a Markdown file: ${resolved}`);
    return { targetType: "file", root: resolved, files: [resolved] };
  }
  if (!stats.isDirectory()) throw new Error(`Unsupported target: ${resolved}`);
  const isProjectRoot = existsSync(join(resolved, "PROJECT_STATE.yaml"));
  if (isProjectRoot) {
    const chaptersDir = join(resolved, "manuscript", "chapters");
    if (existsSync(chaptersDir)) {
      const files = walkMarkdownFiles(chaptersDir);
      if (files.length) return { targetType: "project", root: resolved, files };
    }
    const compiled = join(resolved, "delivery", "manuscript-full.md");
    if (existsSync(compiled)) return { targetType: "project", root: resolved, files: [compiled] };
    throw new Error(`No manuscript found under ${resolved}. Draft or compile first.`);
  }
  const files = walkMarkdownFiles(resolved);
  if (!files.length) throw new Error(`No Markdown files found under ${resolved}`);
  return { targetType: "directory", root: resolved, files };
}

function countWords(text) {
  const cleaned = String(text)
    .replace(/^---\n[\s\S]*?\n---\n?/m, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
  const matches = cleaned.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

// Split a single compiled file into chapters by top-level (# ) or second-level
// (## ) headings. For directories of one-file-per-chapter, each file is a chapter.
function splitIntoChapters(files) {
  const chapters = []; // { label, words, source, order }
  if (files.length === 1) {
    const text = readFileSync(files[0], "utf8");
    const headingRe = /^(#{1,2})\s+(.+)$/gm;
    let lastIndex = 0;
    let lastHeading = null;
    let order = 0;
    let m;
    while ((m = headingRe.exec(text)) !== null) {
      if (lastHeading !== null) {
        chapters.push({ label: lastHeading, words: countWords(text.slice(lastIndex, m.index)), source: files[0], order: order++ });
      }
      lastHeading = m[2].trim();
      lastIndex = m.index + m[0].length;
    }
    if (lastHeading !== null) chapters.push({ label: lastHeading, words: countWords(text.slice(lastIndex)), source: files[0], order: order++ });
    if (!chapters.length) chapters.push({ label: "(untitled)", words: countWords(text), source: files[0], order: 0 });
    return chapters;
  }
  let order = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const headingMatch = text.match(/^#{1,2}\s+(.+)$/m);
    const label = headingMatch ? headingMatch[1].trim() : relative(process.cwd(), file) || file;
    chapters.push({ label, words: countWords(text), source: file, order: order++ });
  }
  return chapters;
}

const SCAFFOLDING_RE = /\b(?:chapter\s*)?\d+[a-z]\b/i;

function detectScaffolding(chapters) {
  const flagged = [];
  for (const ch of chapters) {
    if (SCAFFOLDING_RE.test(ch.label)) flagged.push({ label: ch.label, source: ch.source });
  }
  return flagged;
}

function detectClimax(chapters, climaxToken) {
  if (climaxToken) {
    const lower = climaxToken.toLowerCase();
    const idx = chapters.findIndex((c) => c.label.toLowerCase().includes(lower));
    return idx >= 0 ? idx : null;
  }
  // Heuristic: the dramatic climax is usually the last chapter containing a
  // door / flood / storm / battle / seizure / collapse / fall keyword before
  // the longest tail. Use the LAST such match.
  const tokens = ["door", "flood", "storm", "rain", "deluge", "battle", "siege", "seizure", "collapse", "fall", "ramp", "collapse", "fire", "crash", "kill", "death"];
  let last = null;
  for (let i = 0; i < chapters.length; i += 1) {
    const label = chapters[i].label.toLowerCase();
    if (tokens.some((t) => label.includes(t))) last = i;
  }
  return last;
}

function analyze(targetInfo, options) {
  const chapters = splitIntoChapters(targetInfo.files);
  const total = chapters.reduce((sum, c) => sum + c.words, 0);
  const scaffolding = detectScaffolding(chapters);

  const bloated = chapters
    .map((c) => ({ ...c, share: total ? (c.words / total) * 100 : 0 }))
    .filter((c) => c.share > options.maxChapterShare)
    .sort((a, b) => b.share - a.share);

  const climaxIndex = detectClimax(chapters, options.climaxToken);
  let postClimaxWords = 0;
  let postClimaxShare = 0;
  let longestAfterClimax = null;
  if (climaxIndex !== null && climaxIndex >= 0) {
    const tail = chapters.slice(climaxIndex + 1);
    postClimaxWords = tail.reduce((sum, c) => sum + c.words, 0);
    postClimaxShare = total ? (postClimaxWords / total) * 100 : 0;
    if (tail.length) {
      const longest = tail.reduce((max, c) => (c.words > max.words ? c : max), tail[0]);
      longestAfterClimax = longest;
    }
  }

  const longestChapter = chapters.reduce((max, c) => (c.words > max.words ? c : max), chapters[0] || { label: "—", words: 0 });

  return {
    chapters,
    totalWords: total,
    scaffolding,
    bloated,
    climaxIndex,
    postClimaxWords,
    postClimaxShare,
    longestAfterClimax,
    longestChapter,
  };
}

function formatMarkdownReport(targetInfo, options, analysis) {
  const rel = targetInfo.files.map((f) => relative(process.cwd(), f) || f);
  const lines = [
    "# Genesis structure audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Chapters detected: ${analysis.chapters.length}`,
    `- Total words: ${analysis.totalWords.toLocaleString()}`,
    `- File selection: ${rel.slice(0, 8).join(", ")}${rel.length > 8 ? `, +${rel.length - 8} more` : ""}`,
    `- Chapter bloat threshold: ${options.maxChapterShare}%`,
    "",
    "## Verdict",
    "",
  ];

  const problems = [];
  if (analysis.scaffolding.length) problems.push(`assembly-draft scaffolding detected (${analysis.scaffolding.length} chapter(s) use A/B/C-style labels)`);
  if (analysis.bloated.length) problems.push(`${analysis.bloated.length} chapter(s) exceed ${options.maxChapterShare}% of total length`);
  if (analysis.postClimaxShare > 25) problems.push(`post-climax material is ${analysis.postClimaxShare.toFixed(1)}% of the manuscript — risks reading as a second novella after the novel has climaxed`);
  if (analysis.longestAfterClimax && analysis.longestAfterClimax.label === analysis.longestChapter.label) {
    problems.push(`the longest chapter ("${analysis.longestAfterClimax.label}") sits AFTER the climax — usually a structural warning`);
  }

  if (!problems.length) {
    lines.push("- **clean** — no structural red flags at this threshold.");
  } else {
    for (const p of problems) lines.push(`- ⚠ ${p}`);
  }

  lines.push("", "## Chapter length profile", "");
  if (!analysis.chapters.length) {
    lines.push("- _no chapters detected_");
  } else {
    lines.push("| # | chapter | words | % of total |", "| ---: | --- | ---: | ---: |");
    analysis.chapters.forEach((c, i) => {
      const share = analysis.totalWords ? ((c.words / analysis.totalWords) * 100).toFixed(1) : "0.0";
      const flag = c.share && c.share > options.maxChapterShare ? " ⚠" : "";
      lines.push(`| ${i + 1} | ${c.label}${flag && ""} | ${c.words.toLocaleString()} | ${share}%${flag} |`);
    });
  }

  if (analysis.climaxIndex !== null && analysis.climaxIndex >= 0) {
    lines.push("", "## Post-climax tail", "");
    lines.push(`- Climax chapter (heuristic): **${analysis.chapters[analysis.climaxIndex].label}** (chapter ${analysis.climaxIndex + 1} of ${analysis.chapters.length})`);
    lines.push(`- Words after climax: ${analysis.postClimaxWords.toLocaleString()} (${analysis.postClimaxShare.toFixed(1)}% of manuscript)`);
    if (analysis.longestAfterClimax) lines.push(`- Longest post-climax chapter: **${analysis.longestAfterClimax.label}** (${analysis.longestAfterClimax.words.toLocaleString()} words)`);
    lines.push("- Guideline: if the post-climax tail exceeds ~20–25% of the manuscript, either design it as a deliberate Act IV with its own dramatic question, or compress it into a denouement.");
  } else {
    lines.push("", "## Post-climax tail", "", "- Climax token not detected. Pass `--climax-token \"<heading text>\"` to target a specific scene.");
  }

  if (analysis.scaffolding.length) {
    lines.push("", "## Assembly-draft scaffolding", "");
    lines.push("These chapter labels look like drafting architecture (Chapter 2A / 2B / 3A…) rather than a final reader-facing structure. Convert to clean Parts or Chapters before publication:", "");
    for (const s of analysis.scaffolding) lines.push(`- **${s.label}** — ${relative(process.cwd(), s.source) || s.source}`);
  }

  lines.push("", "## Recommended structure", "");
  lines.push("- Replace A/B/C scaffolding with named Parts (e.g., Part I: The Commission; Part II: The Yard; Part III: The Door; Part IV: What Holds).");
  lines.push("- If one chapter dominates, split it into 2–3 paced chapters or move episodes into the rain-period sequence.");
  lines.push("- Order post-climax material as: first night afloat → society hardens → signs (raven/dove/olive) → covering off → list of the dead. Move chronologically displaced episodes (e.g., a birth or quarantine) into the rain-period block.");
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(targetInfo, options, analysis) {
  const lines = [
    "## Automated structure scan",
    "",
    `- Source: chapter-heading + word-count analysis on ${targetInfo.files.length} manuscript file(s)`,
    "- Purpose: supporting diagnostic. Structural choices belong to the author.",
    "",
    "| signal | value |",
    "| --- | --- |",
    `| chapters | ${analysis.chapters.length} |`,
    `| total words | ${analysis.totalWords.toLocaleString()} |`,
    `| scaffolding-flagged chapters | ${analysis.scaffolding.length} |`,
    `| chapters over ${options.maxChapterShare}% | ${analysis.bloated.length} |`,
  ];
  if (analysis.climaxIndex !== null && analysis.climaxIndex >= 0) {
    lines.push(`| climax chapter | ${analysis.chapters[analysis.climaxIndex].label} |`);
    lines.push(`| post-climax share | ${analysis.postClimaxShare.toFixed(1)}% |`);
  }
  lines.push("");
  return lines.join("\n");
}

function upsertSection(existingText, marker, body) {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const section = `${start}\n${body.trim()}\n${end}`;
  if (!existingText.trim()) return `${section}\n`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
  if (pattern.test(existingText)) return existingText.replace(pattern, section);
  return `${existingText.trimEnd()}\n\n${section}\n`;
}

const options = parseArgs(process.argv.slice(2));
const targetInfo = collectFiles(options.target);
const analysis = analyze(targetInfo, options);

if (options.json) {
  console.log(JSON.stringify({
    target: targetInfo.root,
    targetType: targetInfo.targetType,
    options: { maxChapterShare: options.maxChapterShare, climaxToken: options.climaxToken },
    ...analysis,
    chapters: analysis.chapters.map((c) => ({ ...c, source: relative(process.cwd(), c.source) || c.source })),
    scaffolding: analysis.scaffolding.map((s) => ({ ...s, source: relative(process.cwd(), s.source) || s.source })),
  }, null, 2));
} else {
  console.log(formatMarkdownReport(targetInfo, options, analysis));
  if (options.writeAudit) {
    if (targetInfo.targetType !== "project") throw new Error("--write-audit requires a Genesis project root target.");
    const artifactPath = join(targetInfo.root, "artifacts", "structure-audit.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(targetInfo.root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "structure-audit", formatArtifactSection(targetInfo, options, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
