import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Rhetorical pattern audit.
//
// Unlike ngram-audit.mjs (which finds exact repeated phrases), this script
// finds recurring SENTENCE SHAPES — the reviewer's "Not X. Y.", "It was not X.
// It was Y.", "the kind of man who...", "which is to say...", "That was the
// work/law/cost.", "He had not been hired for...". These are pattern matches,
// not string matches, so they catch authorial over-insistence the n-gram tool
// cannot.

const DEFAULT_PATTERNS = [
  // Negative parallelism: "It was not X. It was Y." / "Not X. Y." / "Not only X but Y."
  { id: "negative-parallelism", label: "Negative parallelism (Not X. Y. / It was not X. It was Y.)", regex: /\bnot\s+[^.\n;]{1,40}?\.\s+[A-Z][^.\n]{1,60}?\./g },
  { id: "not-only-but", label: "Not only / but also", regex: /\bnot\s+only\b[^.\n;]{0,60}?\bbut\b[^.\n]{0,40}?\./gi },
  // Aphoristic closeout: "That was the work." / "That was the law." / "That was the cost."
  { id: "aphoristic-closeout", label: "Aphoristic closeout (That was the work/law/cost.)", regex: /\bthat\s+(?:was|is)\s+the\s+[a-z]{2,15}\./gi },
  // "the kind of man/woman/..."
  { id: "kind-of", label: "The kind of (man/voice/...) construction", regex: /\bthe\s+kind\s+of\s+(?:man|woman|person|voice|silence|look|grief|faith|work|love|fear|hope|man|girl|boy|father|mother|son|daughter)\b/gi },
  // "which is to say..."
  { id: "which-is-to-say", label: "Which is to say...", regex: /\bwhich\s+is\s+to\s+say\b/gi },
  // "He had not been hired for..." / "She had not been hired to..."
  { id: "had-not-been-hired", label: "He had not been hired (for/to)...", regex: /\b(?:he|she|they|i|we)\s+had\s+not\s+been\s+hired\b/gi },
  // "The thing about..."
  { id: "the-thing-about", label: "The thing about...", regex: /\bthe\s+thing\s+about\b/gi },
  // Fragment verdict: a one-line emphatic fragment ending a beat.
  { id: "fragment-verdict", label: "Fragment verdict (This was X. / So this was X.)", regex: /\b(?:this|so this|and this)\s+was\s+(?:the\s+)?[a-z]{2,15}\./gi },
  // Triadic list closeout: "..., and ." (loose, but flags three-beat rhythm).
  { id: "triadic-list", label: "Triadic list (a, b, and c closeout)", regex: /[^.\n;]{1,30}?,\s+[^.\n;,]{1,30}?,\s+and\s+[^.\n;,]{1,30}?\./g },
];

function usage() {
  console.log(`Usage: node scripts/rhetorical-pattern-audit.mjs [target] [options]

Target:
  file.md              Audit one Markdown file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --min-count <n>      Minimum hits per pattern globally to report (default: 3)
  --per-scene <n>      Flag scenes with at least this many total pattern hits (default: 5)
  --top <n>            Max example excerpts per pattern (default: 8)
  --json               Output JSON instead of Markdown
  --write-ear-pass     Write/update a bounded section in artifacts/ear-pass.md
  --help               Show this help

Examples:
  npm run audit:rhetoric -- examples/novel-project
  node scripts/rhetorical-pattern-audit.mjs manuscript/chapters --min-count 2
  node scripts/rhetorical-pattern-audit.mjs examples/novel-project --write-ear-pass
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), minCount: 3, perScene: 5, top: 8, json: false, writeEarPass: false };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
    if (token === "--json") { args.json = true; continue; }
    if (token === "--write-ear-pass") { args.writeEarPass = true; continue; }
    if (token === "--min-count") { args.minCount = Number.parseInt(argv[++index] || "", 10); continue; }
    if (token === "--per-scene") { args.perScene = Number.parseInt(argv[++index] || "", 10); continue; }
    if (token === "--top") { args.top = Number.parseInt(argv[++index] || "", 10); continue; }
    if (token.startsWith("--")) throw new Error(`Unknown option: ${token}`);
    positional.push(token);
  }

  if (positional.length) args.target = positional[0];
  for (const value of [args.minCount, args.perScene, args.top]) {
    if (!Number.isInteger(value) || value < 1) throw new Error("min-count, per-scene, and top must be positive integers.");
  }
  if (args.writeEarPass && args.json) throw new Error("--json cannot be combined with --write-ear-pass.");
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
    throw new Error(`No manuscript chapters found under ${chaptersDir}. Draft or compile the manuscript first, or pass a file/directory explicitly.`);
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
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function excerpt(text, match, radius = 40) {
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function analyze(files, options) {
  const patternTotals = new Map(); // id -> { id, label, count, files:Set, examples:[] }
  const sceneRows = []; // { file, scene, hits, byPattern:{} }
  const perFile = new Map();

  for (const id of DEFAULT_PATTERNS.map((p) => p.id)) patternTotals.set(id, { id, label: "", count: 0, files: new Set(), examples: [] });

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const cleaned = stripMarkdown(raw);

    // Split into "scenes" by markdown headings; if no headings, treat whole file as one scene.
    const sceneChunks = [];
    const headingRe = /^(#{1,6})\s+(.+)$/gm;
    let lastIndex = 0;
    let lastHeading = "(top)";
    let match;
    while ((match = headingRe.exec(cleaned)) !== null) {
      if (match.index > lastIndex) sceneChunks.push({ heading: lastHeading, body: cleaned.slice(lastIndex, match.index) });
      lastHeading = match[2].trim();
      lastIndex = match.index + match[0].length;
    }
    sceneChunks.push({ heading: lastHeading, body: cleaned.slice(lastIndex) });
    if (!sceneChunks.some((c) => c.body.trim())) {
      sceneChunks.length = 0;
      sceneChunks.push({ heading: "(file)", body: cleaned });
    }

    for (const scene of sceneChunks) {
      const sceneHits = { file, scene: scene.heading, hits: 0, byPattern: {} };
      for (const pattern of DEFAULT_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes("g") ? pattern.regex.flags : `${pattern.regex.flags}g`);
        let m;
        const local = [];
        while ((m = regex.exec(scene.body)) !== null) {
          local.push(m[0]);
          if (m.index === regex.lastIndex) regex.lastIndex += 1;
        }
        if (!local.length) continue;
        const total = patternTotals.get(pattern.id);
        total.label = pattern.label;
        total.count += local.length;
        total.files.add(file);
        for (const hit of local) {
          if (total.examples.length < options.top) total.examples.push(excerpt(scene.body, { index: scene.body.indexOf(hit), 0: hit }));
        }
        sceneHits.hits += local.length;
        sceneHits.byPattern[pattern.id] = local.length;
      }
      if (sceneHits.hits > 0) {
        sceneRows.push(sceneHits);
        perFile.set(file, (perFile.get(file) || 0) + sceneHits.hits);
      }
    }
  }

  const patterns = [...patternTotals.values()]
    .filter((p) => p.count >= options.minCount)
    .sort((a, b) => b.count - a.count);

  const hotScenes = sceneRows
    .filter((row) => row.hits >= options.perScene)
    .sort((a, b) => b.hits - a.hits);

  return { patterns, hotScenes, totalScenes: sceneRows.length };
}

function formatMarkdownReport(targetInfo, options, analysis) {
  const rel = targetInfo.files.map((f) => relative(process.cwd(), f) || f);
  const lines = [
    "# Genesis rhetorical-pattern audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Files scanned: ${targetInfo.files.length}`,
    `- Scenes with any hits: ${analysis.totalScenes}`,
    `- File selection: ${rel.slice(0, 8).join(", ")}${rel.length > 8 ? `, +${rel.length - 8} more` : ""}`,
    `- Min hits to report a pattern: ${options.minCount}`,
    `- Scene flag threshold: ${options.perScene} total pattern hits`,
    "- Notes: This catches SENTENCE SHAPES, not exact phrases. Pair with ngram-audit.mjs for verbatim repetition.",
    "",
    "## Pattern totals",
    "",
    "| pattern | hits | files |", "| --- | ---: | ---: |",
  ];
  if (!analysis.patterns.length) {
    lines.push("| _(none above threshold)_ | 0 | 0 |");
  } else {
    for (const p of analysis.patterns) lines.push(`| ${p.label} | ${p.count} | ${p.files.size} |`);
  }
  lines.push("", "## Example excerpts", "");
  if (!analysis.patterns.length) {
    lines.push("- _none_");
  } else {
    for (const p of analysis.patterns) {
      lines.push(`### ${p.label}`, "");
      for (const ex of p.examples) lines.push(`> ${ex}`);
      lines.push("");
    }
  }
  lines.push(`## Scenes over the ${options.perScene}-hit threshold`, "");
  if (!analysis.hotScenes.length) {
    lines.push("- _none — good._");
  } else {
    lines.push("| file | scene | total hits | densest pattern |", "| --- | --- | ---: | --- |");
    for (const row of analysis.hotScenes) {
      const densest = Object.entries(row.byPattern).sort((a, b) => b[1] - a[1])[0];
      const label = DEFAULT_PATTERNS.find((p) => p.id === densest[0]).label;
      lines.push(`| ${relative(process.cwd(), row.file) || row.file} | ${row.scene} | ${row.hits} | ${label} (${densest[1]}) |`);
    }
  }
  lines.push("", "## Restraint guidance", "");
  lines.push("- Allow roughly **one major aphoristic landing per scene**. If a scene has three or four, cut or convert the others into concrete action, gesture, dialogue, or silence.");
  lines.push("- The densest scenes above are the highest-leverage revision targets. Do not delete the signature — thin the supporting echoes so the signature line can land.");
  lines.push("- Negative parallelism (`Not X. Y.`) is the most common fatigue source. Vary it: let one beat be the negative, then drop the positive silently in the next action.");
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(targetInfo, options, analysis) {
  const lines = [
    `## Automated rhetorical-pattern scan`,
    "",
    `- Source: sentence-shape pattern audit on ${targetInfo.files.length} manuscript file(s)`,
    `- Scope: recurring aphoristic shapes — negative parallelism, aphoristic closeouts, fragment verdicts, triadic lists, and stock phrases`,
    "- Purpose: supporting diagnostic only. A signature move is allowed; recurring closeouts become prose fatigue when the author is more audible than the character.",
    "",
  ];
  if (!analysis.patterns.length) {
    lines.push("_No patterns above threshold._", "");
  } else {
    lines.push("| pattern | hits | files |", "| --- | ---: | ---: |");
    for (const p of analysis.patterns) lines.push(`| ${p.label} | ${p.count} | ${p.files.size} |`);
    lines.push("");
  }
  if (analysis.hotScenes.length) {
    lines.push(`### Scenes over ${options.perScene}-hit threshold`, "", "| file | scene | hits |", "| --- | --- | ---: |");
    for (const row of analysis.hotScenes.slice(0, 15)) lines.push(`| ${relative(process.cwd(), row.file) || row.file} | ${row.scene} | ${row.hits} |`);
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
const analysis = analyze(targetInfo.files, options);

if (options.writeEarPass && targetInfo.targetType !== "project") {
  throw new Error("--write-ear-pass requires a Genesis project root target.");
}

if (options.json) {
  console.log(JSON.stringify({
    target: targetInfo.root,
    targetType: targetInfo.targetType,
    filesScanned: targetInfo.files.length,
    options: { minCount: options.minCount, perScene: options.perScene, top: options.top },
    patterns: analysis.patterns.map((p) => ({ ...p, files: p.files.size })),
    hotScenes: analysis.hotScenes,
  }, null, 2));
} else {
  console.log(formatMarkdownReport(targetInfo, options, analysis));
  if (options.writeEarPass) {
    const artifactPath = join(targetInfo.root, "artifacts", "ear-pass.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(targetInfo.root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "rhetorical-pattern-audit", formatArtifactSection(targetInfo, options, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
