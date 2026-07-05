import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Temporal forward-reference audit.
//
// Surfaces promises of future events ("Tomorrow there would be a law about
// water") so they can be reconciled after chapter reorders or revisions. The
// publication-blocker this catches: Chapter 12 establishes water law, but a
// later chapter still ends "Tomorrow there would be a law about water" because
// the chapters were reordered and the dangling forward-reference survived.
//
// This is a SURFACING tool, not a verdict. It cannot tell whether the promised
// event already happened — that requires the author to cross-check each hit
// against chronology-rebuild.md and continuity-ledger.md. Its value is putting
// every temporal promise in one list so none survive silently.

const TEMPORAL_LEADS = [
  "\\btomorrow\\b",
  "\\bby morning\\b",
  "\\bby nightfall\\b",
  "\\bby sundown\\b",
  "\\bby dawn\\b",
  "\\bby the next (?:day|morning|moon)\\b",
  "\\bsoon(?:er|est)?\\b",
  "\\bbefore long\\b",
  "\\bin time\\b",
  "\\bwhen the time came\\b",
  "\\bwhen (?:he|she|they|it|we|i) (?:returned|came back|arrived|reached)\\b",
  "\\blater there (?:would|will|could|might) be\\b",
  "\\bthere (?:would|will|could|might) (?:soon|yet|one day) be\\b",
  "\\bone day\\b",
  "\\bin the (?:days|weeks|months|years) (?:that )?(?:followed|ahead|to come|after)\\b",
  "\\bbefore the next\\b",
  "\\bthe next (?:morning|day|night|week|moon|season)\\b",
  "\\bnot yet\\b",
  "\\bstill to come\\b",
];

const LEAD_REGEX = new RegExp(`(?:${TEMPORAL_LEADS.join("|")})[^.\\n]{0,120}?[.]`, "gi");

function usage() {
  console.log(`Usage: node scripts/temporal-reference-audit.mjs [target] [options]

Target:
  file.md              Audit one Markdown file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --min-count <n>      Minimum hits per chapter to report the chapter (default: 1)
  --json               Output JSON instead of Markdown
  --write-audit        Write/update a bounded section in artifacts/temporal-reference-audit.md
  --help               Show this help

Examples:
  npm run audit:temporal -- /path/to/project
  node scripts/temporal-reference-audit.mjs /path/to/project --write-audit
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), minCount: 1, json: false, writeAudit: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") { usage(); process.exit(0); }
    if (token === "--json") { args.json = true; continue; }
    if (token === "--write-audit") { args.writeAudit = true; continue; }
    if (token === "--min-count") { args.minCount = Number.parseInt(argv[++i] || "", 10); continue; }
    if (token.startsWith("--")) throw new Error(`Unknown option: ${token}`);
    positional.push(token);
  }
  if (positional.length) args.target = positional[0];
  if (!Number.isInteger(args.minCount) || args.minCount < 1) throw new Error("--min-count must be a positive integer.");
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

function stripMarkdown(text) {
  return String(text)
    .replace(/^---\n[\s\S]*?\n---\n?/m, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
}

function chapterLabel(text, file) {
  const m = text.match(/^#{1,2}\s+(.+)$/m);
  return m ? m[1].trim() : (relative(process.cwd(), file) || file);
}

function analyze(files) {
  const chapters = []; // { file, label, order, references:[{lead, sentence}] }
  files.forEach((file, order) => {
    const raw = readFileSync(file, "utf8");
    const cleaned = stripMarkdown(raw);
    const label = chapterLabel(raw, file);
    const references = [];
    let m;
    const re = new RegExp(LEAD_REGEX.source, "gi");
    while ((m = re.exec(cleaned)) !== null) {
      const sentence = m[0].replace(/\s+/g, " ").trim();
      const leadMatch = sentence.match(new RegExp(`(?:${TEMPORAL_LEADS.join("|")})`, "i"));
      references.push({ lead: leadMatch ? leadMatch[0] : "(temporal)", sentence });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    if (references.length) chapters.push({ file, label, order, references });
  });
  return { chapters, totalReferences: chapters.reduce((s, c) => s + c.references.length, 0) };
}

function formatMarkdownReport(targetInfo, options, analysis) {
  const rel = targetInfo.files.map((f) => relative(process.cwd(), f) || f);
  const lines = [
    "# Genesis temporal forward-reference audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Files scanned: ${targetInfo.files.length}`,
    `- Chapters with temporal forward-references: ${analysis.chapters.length}`,
    `- Total temporal references surfaced: ${analysis.totalReferences}`,
    `- File selection: ${rel.slice(0, 8).join(", ")}${rel.length > 8 ? `, +${rel.length - 8} more` : ""}`,
    "",
    "## What this catches",
    "",
    "Every promise of a future event (\"tomorrow there would be…\", \"soon\", \"when the time came\", \"in the days that followed\"). After a chapter reorder or revision, these can dangle — promising an event that now happens *earlier* in the book. The reviewer-blocking failure mode: Chapter 12 establishes a law, but a later chapter still ends \"Tomorrow there would be a law about X.\"",
    "",
    "**This is a surfacing tool, not a verdict.** It cannot tell whether the promised event already occurred. For each hit, cross-check against `chronology-rebuild.md` and `continuity-ledger.md`: does the promised event happen *after* this reference, or did it already happen *before* it?",
    "",
    "## Reconciliation checklist",
    "",
    "| # | chapter | lead | sentence | promised event already happened earlier? |", "| ---: | --- | --- | --- | --- |",
  ];
  if (!analysis.chapters.length) {
    lines.push("| _(no temporal forward-references detected)_ | — | — | — |");
  } else {
    let n = 1;
    for (const ch of analysis.chapters) {
      for (const ref of ch.references) {
        if (n > 200) { lines.push(`| … | _(truncated; ${analysis.totalReferences - 200} more)_ | | | |`); break; }
        const file = relative(process.cwd(), ch.file) || ch.file;
        const sentence = ref.sentence.replace(/\|/g, "\\|").slice(0, 160);
        lines.push(`| ${n++} | ${ch.label} (${file}) | ${ref.lead} | ${sentence} | ☐ verify |`);
      }
    }
  }
  lines.push("", "## Repair guidance", "");
  lines.push("- If the promised event now occurs **earlier** in the book, the reference is a dangling forward-reference: rewrite it to past tense, or remove it. (This is the Water-Laws-after-the-law-already-exists bug.)");
  lines.push("- If the promised event still occurs **later**, the reference is fine.");
  lines.push("- If chapters were recently reordered or expanded, treat every hit in the moved region as suspect until reconciled.");
  lines.push("- Clustered forward-references to the *same* noun (\"law\", \"sign\", \"door\", \"count\") in adjacent chapters are the highest-risk — verify the cluster as a unit.");
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(targetInfo, options, analysis) {
  const lines = [
    "## Automated temporal forward-reference scan",
    "",
    `- Source: temporal-lead phrase scan on ${targetInfo.files.length} manuscript file(s)`,
    `- Chapters with forward-references: ${analysis.chapters.length} · total surfaced: ${analysis.totalReferences}`,
    "- Purpose: supporting diagnostic only. Reconcile each hit against chronology-rebuild.md before acting.",
    "",
  ];
  if (!analysis.chapters.length) {
    lines.push("_No temporal forward-references detected._", "");
  } else {
    lines.push("| chapter | lead | sentence |", "| --- | --- | --- |");
    let count = 0;
    outer: for (const ch of analysis.chapters) {
      for (const ref of ch.references) {
        if (count++ >= 40) { lines.push("| … | _(truncated)_ | |"); break outer; }
        const file = relative(process.cwd(), ch.file) || ch.file;
        lines.push(`| ${ch.label} (${file}) | ${ref.lead} | ${ref.sentence.replace(/\|/g, "\\|").slice(0, 140)} |`);
      }
    }
    lines.push("");
  }
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
    chapters: analysis.chapters.map((c) => ({ ...c, file: relative(process.cwd(), c.file) || c.file })),
  }, null, 2));
} else {
  console.log(formatMarkdownReport(targetInfo, options, analysis));
  if (options.writeAudit) {
    if (targetInfo.targetType !== "project") throw new Error("--write-audit requires a Genesis project root target.");
    const artifactPath = join(targetInfo.root, "artifacts", "temporal-reference-audit.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(targetInfo.root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "temporal-reference-audit", formatArtifactSection(targetInfo, options, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
