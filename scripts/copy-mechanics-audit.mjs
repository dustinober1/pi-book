import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Copy-mechanics audit.
//
// Catches mechanical copy errors a careful reviewer notices at the galley
// stage: lowercase words starting a sentence ("animal water. private water."),
// accidental doubled words ("the the", "a a"), and space-before-punctuation.
// These are deterministic and cheap; they should never survive to a paid
// copyedit.

const DOUBLED_WORD_RE = /\b(\w{2,})\s+\1\b/gi;

function usage() {
  console.log(`Usage: node scripts/copy-mechanics-audit.mjs [target] [options]

Target:
  file.md              Audit one Markdown file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --json               Output JSON instead of Markdown
  --write-audit        Write/update a bounded section in artifacts/copy-mechanics-audit.md
  --help               Show this help

Examples:
  npm run audit:mechanics -- /path/to/project
  node scripts/copy-mechanics-audit.mjs /path/to/project --write-audit
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), json: false, writeAudit: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") { usage(); process.exit(0); }
    if (token === "--json") { args.json = true; continue; }
    if (token === "--write-audit") { args.writeAudit = true; continue; }
    if (token.startsWith("--")) throw new Error(`Unknown option: ${token}`);
    positional.push(token);
  }
  if (positional.length) args.target = positional[0];
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

// Lowercase sentence start: a lowercase letter beginning a sentence after a
// period/question/exclamation + whitespace, or at the very start of a body.
// Excludes markdown list items, ellipses (intentional fragment), and quoted
// dialogue openers that are part of a run-on by design.
const SENTENCE_BOUNDARY_RE = /([.!?]["')\]]?)\s+([a-z])/g;

function excerpt(text, idx, radius = 35) {
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

const LOWERCASE_OK = new Set([
  // Common intentional lowercase starts (don't flag)
  "etc",
]);

function analyze(files) {
  const lowercaseStarts = []; // { file, excerpt }
  const doubled = []; // { file, word, excerpt }
  const spacePunct = []; // { file, excerpt }

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    // Strip code fences and frontmatter so we don't flag inside them.
    const cleaned = raw
      .replace(/^---\n[\s\S]*?\n---\n?/m, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ");

    // Lowercase sentence starts. Work on a version with markdown headings/list
    // markers removed so we don't flag list items.
    const prose = cleaned
      .replace(/^#{1,6}\s+.*$/gm, " ")
      .replace(/^\s*[-*+]\s+/gm, " ")
      .replace(/^\s*\d+\.\s+/gm, " ");

    let m;
    const re1 = new RegExp(SENTENCE_BOUNDARY_RE.source, "g");
    while ((m = re1.exec(prose)) !== null) {
      const word = m[2];
      if (LOWERCASE_OK.has(word)) continue;
      // single-letter lowercase start is almost always a real error
      lowercaseStarts.push({ file, word, excerpt: excerpt(prose, m.index + m[1].length + 1) });
      if (m.index === re1.lastIndex) re1.lastIndex += 1;
    }
    // Very start of body, if lowercase (after stripping leading whitespace)
    const leadMatch = prose.match(/^\s*([a-z])/);
    if (leadMatch && !LOWERCASE_OK.has(leadMatch[1]) && prose.trim().length > 0) {
      lowercaseStarts.push({ file, word: leadMatch[1], excerpt: excerpt(prose, 0) });
    }

    // Doubled words
    const re2 = new RegExp(DOUBLED_WORD_RE.source, "gi");
    while ((m = re2.exec(cleaned)) !== null) {
      const word = m[1].toLowerCase();
      // Ignore intentional doubled words and short ones prone to false positives.
      if (["had", "that", "very"].includes(word) && false) continue;
      // "that that", "had had" are grammatically valid; flag but separately.
      doubled.push({ file, word: m[0], excerpt: excerpt(cleaned, m.index) });
      if (m.index === re2.lastIndex) re2.lastIndex += 1;
    }

    // Space before punctuation (excluding ellipses and markdown tables)
    const re3 = /\s+([,.;:!?])(?!\S)/g;
    while ((m = re3.exec(cleaned)) !== null) {
      // skip ellipsis runs and decimal numbers
      const before = cleaned.slice(Math.max(0, m.index - 3), m.index);
      if (before.endsWith(".")) continue;
      spacePunct.push({ file, excerpt: excerpt(cleaned, m.index) });
      if (m.index === re3.lastIndex) re3.lastIndex += 1;
    }
  }

  return { lowercaseStarts, doubled, spacePunct };
}

function formatMarkdownReport(targetInfo, analysis) {
  const rel = targetInfo.files.map((f) => relative(process.cwd(), f) || f);
  const total = analysis.lowercaseStarts.length + analysis.doubled.length + analysis.spacePunct.length;
  const lines = [
    "# Genesis copy-mechanics audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Files scanned: ${targetInfo.files.length}`,
    `- File selection: ${rel.slice(0, 8).join(", ")}${rel.length > 8 ? `, +${rel.length - 8} more` : ""}`,
    `- Total mechanical findings: ${total}`,
    "",
    "## Verdict",
    "",
  ];
  if (!total) {
    lines.push("- **clean** — no lowercase sentence starts, doubled words, or space-before-punctuation detected.");
  } else {
    if (analysis.lowercaseStarts.length) lines.push(`- ⚠ ${analysis.lowercaseStarts.length} lowercase sentence start(s) — likely capitalization misses.`);
    if (analysis.doubled.length) lines.push(`- ⚠ ${analysis.doubled.length} doubled-word instance(s) — review for accidental repetition.`);
    if (analysis.spacePunct.length) lines.push(`- ⚠ ${analysis.spacePunct.length} space-before-punctuation instance(s).`);
  }

  if (analysis.lowercaseStarts.length) {
    lines.push("", "## Lowercase sentence starts", "", "| file | word | excerpt |", "| --- | --- | --- |");
    for (const f of analysis.lowercaseStarts.slice(0, 60)) lines.push(`| ${relative(process.cwd(), f.file) || f.file} | ${f.word} | ${f.excerpt.replace(/\|/g, "\\|")} |`);
  }
  if (analysis.doubled.length) {
    lines.push("", "## Doubled words", "", "| file | match | excerpt |", "| --- | --- | --- |");
    for (const f of analysis.doubled.slice(0, 60)) lines.push(`| ${relative(process.cwd(), f.file) || f.file} | ${f.word} | ${f.excerpt.replace(/\|/g, "\\|")} |`);
    lines.push("", "_Note: some doubled words are grammatical (\"had had\", \"that that\", \"is is\"-rhetorical). Confirm before deleting._");
  }
  if (analysis.spacePunct.length) {
    lines.push("", "## Space before punctuation", "", "| file | excerpt |", "| --- | --- |");
    for (const f of analysis.spacePunct.slice(0, 40)) lines.push(`| ${relative(process.cwd(), f.file) || f.file} | ${f.excerpt.replace(/\|/g, "\\|")} |`);
  }
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(targetInfo, analysis) {
  const total = analysis.lowercaseStarts.length + analysis.doubled.length + analysis.spacePunct.length;
  const lines = [
    "## Automated copy-mechanics scan",
    "",
    `- Source: mechanical scan on ${targetInfo.files.length} manuscript file(s)`,
    `- Lowercase sentence starts: ${analysis.lowercaseStarts.length} · doubled words: ${analysis.doubled.length} · space-before-punctuation: ${analysis.spacePunct.length}`,
    "- Purpose: supporting diagnostic. These should never survive to a paid copyedit.",
    "",
  ];
  if (analysis.lowercaseStarts.length) {
    lines.push("### Lowercase sentence starts", "", "| file | excerpt |", "| --- | --- |");
    for (const f of analysis.lowercaseStarts.slice(0, 20)) lines.push(`| ${relative(process.cwd(), f.file) || f.file} | ${f.excerpt.replace(/\|/g, "\\|")} |`);
    lines.push("");
  }
  if (analysis.doubled.length) {
    lines.push("### Doubled words", "", "| file | match |", "| --- | --- |");
    for (const f of analysis.doubled.slice(0, 20)) lines.push(`| ${relative(process.cwd(), f.file) || f.file} | ${f.word} |`);
    lines.push("");
  }
  if (!total) lines.push("_No mechanical findings._", "");
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
const analysis = analyze(targetInfo.files);

if (options.json) {
  console.log(JSON.stringify({
    target: targetInfo.root,
    targetType: targetInfo.targetType,
    ...analysis,
    lowercaseStarts: analysis.lowercaseStarts.map((f) => ({ ...f, file: relative(process.cwd(), f.file) || f.file })),
    doubled: analysis.doubled.map((f) => ({ ...f, file: relative(process.cwd(), f.file) || f.file })),
    spacePunct: analysis.spacePunct.map((f) => ({ ...f, file: relative(process.cwd(), f.file) || f.file })),
  }, null, 2));
} else {
  console.log(formatMarkdownReport(targetInfo, analysis));
  if (options.writeAudit) {
    if (targetInfo.targetType !== "project") throw new Error("--write-audit requires a Genesis project root target.");
    const artifactPath = join(targetInfo.root, "artifacts", "copy-mechanics-audit.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(targetInfo.root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "copy-mechanics-audit", formatArtifactSection(targetInfo, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
