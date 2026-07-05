import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "for", "from", "had", "has", "have", "he", "her", "hers", "him", "his", "i", "if", "in", "into", "is", "it", "its", "itself", "me", "my", "of", "on", "or", "our", "ours", "she", "so", "than", "that", "the", "their", "theirs", "them", "then", "there", "these", "they", "this", "those", "to", "too", "us", "was", "we", "were", "what", "when", "where", "which", "who", "whom", "why", "will", "with", "you", "your", "yours",
]);

function usage() {
  console.log(`Usage: node scripts/ngram-audit.mjs [target] [options]

Target:
  file.md              Audit one Markdown file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --min-n <n>          Minimum n-gram size (default: 2)
  --max-n <n>          Maximum n-gram size (default: 5)
  --min-count <n>      Minimum repeated count to report (default: 3)
  --top <n>            Max rows per n-gram size (default: 20)
  --json               Output JSON instead of Markdown
  --write-ear-pass     Write/update a bounded n-gram section in artifacts/ear-pass.md
  --write-ai-tell      Write/update a bounded n-gram section in artifacts/ai-tell-mitigation-audit.md
  --help               Show this help

Examples:
  npm run audit:ngrams -- examples/novel-project
  node scripts/ngram-audit.mjs manuscript/chapters --min-count 2 --top 10
  node scripts/ngram-audit.mjs examples/novel-project --write-ear-pass --min-count 2
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), minN: 2, maxN: 5, minCount: 3, top: 20, json: false, writeEarPass: false, writeAiTell: false };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--write-ear-pass") {
      args.writeEarPass = true;
      continue;
    }
    if (token === "--write-ai-tell") {
      args.writeAiTell = true;
      continue;
    }
    if (token === "--min-n") {
      args.minN = Number.parseInt(argv[++index] || "", 10);
      continue;
    }
    if (token === "--max-n") {
      args.maxN = Number.parseInt(argv[++index] || "", 10);
      continue;
    }
    if (token === "--min-count") {
      args.minCount = Number.parseInt(argv[++index] || "", 10);
      continue;
    }
    if (token === "--top") {
      args.top = Number.parseInt(argv[++index] || "", 10);
      continue;
    }
    if (token.startsWith("--")) throw new Error(`Unknown option: ${token}`);
    positional.push(token);
  }

  if (positional.length) args.target = positional[0];
  if (!Number.isInteger(args.minN) || !Number.isInteger(args.maxN) || !Number.isInteger(args.minCount) || !Number.isInteger(args.top)) {
    throw new Error("min/max n, min-count, and top must be integers.");
  }
  if (args.minN < 1 || args.maxN < args.minN) throw new Error("Expected 1 <= min-n <= max-n.");
  if (args.minCount < 1 || args.top < 1) throw new Error("Expected min-count >= 1 and top >= 1.");
  if ((args.writeEarPass || args.writeAiTell) && args.json) throw new Error("--json cannot be combined with --write-ear-pass or --write-ai-tell.");
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
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/^\s*>.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function tokenize(text) {
  const cleaned = stripMarkdown(text).toLowerCase();
  return [...cleaned.matchAll(/[a-z0-9]+(?:'[a-z0-9]+)?/g)].map((match) => match[0]);
}

function isUsefulNgram(tokens) {
  if (!tokens.length) return false;
  if (tokens.every((token) => /^\d+$/.test(token))) return false;
  if (tokens.every((token) => STOPWORDS.has(token)) && tokens.every((token) => token.length <= 3)) return false;
  if (!tokens.some((token) => token.length > 1 && !/^\d+$/.test(token))) return false;
  return true;
}

function analyze(files, options) {
  const results = new Map();
  let totalTokens = 0;

  for (let n = options.minN; n <= options.maxN; n += 1) results.set(n, new Map());

  for (const file of files) {
    const tokens = tokenize(readFileSync(file, "utf8"));
    totalTokens += tokens.length;
    for (let n = options.minN; n <= options.maxN; n += 1) {
      if (tokens.length < n) continue;
      const bucket = results.get(n);
      for (let index = 0; index <= tokens.length - n; index += 1) {
        const phraseTokens = tokens.slice(index, index + n);
        if (!isUsefulNgram(phraseTokens)) continue;
        const phrase = phraseTokens.join(" ");
        const existing = bucket.get(phrase) || { phrase, n, count: 0, files: new Set(), fileCounts: new Map() };
        existing.count += 1;
        existing.files.add(file);
        existing.fileCounts.set(file, (existing.fileCounts.get(file) || 0) + 1);
        bucket.set(phrase, existing);
      }
    }
  }

  const formatted = {};
  for (let n = options.minN; n <= options.maxN; n += 1) {
    const rows = [...results.get(n).values()]
      .filter((row) => row.count >= options.minCount)
      .map((row) => ({
        n: row.n,
        phrase: row.phrase,
        count: row.count,
        fileCount: row.files.size,
        files: [...row.files].sort(),
      }))
      .sort((left, right) => right.count - left.count || right.fileCount - left.fileCount || left.phrase.localeCompare(right.phrase))
      .slice(0, options.top);
    formatted[n] = rows;
  }

  return { totalTokens, results: formatted };
}

function formatMarkdownReport(targetInfo, options, analysis) {
  const relativeFiles = targetInfo.files.map((file) => relative(process.cwd(), file) || file);
  const lines = [
    "# Genesis n-gram audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Files scanned: ${targetInfo.files.length}`,
    `- Tokens scanned: ${analysis.totalTokens}`,
    `- File selection: ${relativeFiles.slice(0, 8).join(", ")}${relativeFiles.length > 8 ? `, +${relativeFiles.length - 8} more` : ""}`,
    `- N-gram range: ${options.minN}-${options.maxN}`,
    `- Minimum repeated count: ${options.minCount}`,
    `- Max rows per n: ${options.top}`,
    "- Notes: Markdown headings/code fences/frontmatter are stripped; stopword-only phrases are ignored.",
    "",
  ];

  for (let n = options.minN; n <= options.maxN; n += 1) {
    lines.push(`## ${n}-grams`, "");
    const rows = analysis.results[n] || [];
    if (!rows.length) {
      lines.push("- none above threshold", "");
      continue;
    }
    lines.push("| phrase | count | files |", "| --- | ---: | ---: |");
    for (const row of rows) lines.push(`| ${row.phrase} | ${row.count} | ${row.fileCount} |`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(title, targetInfo, options, analysis) {
  const lines = [
    `## ${title}`,
    "",
    `- Source: automated n-gram audit on ${targetInfo.files.length} manuscript file(s)` ,
    `- Scope: ${options.minN}-${options.maxN}-grams, minimum count ${options.minCount}, top ${options.top} rows per n`,
    "- Purpose: supporting diagnostic only. Repetition can be intentional; keep the strongest signature moves and vary the rest.",
    "",
  ];

  for (let n = options.minN; n <= options.maxN; n += 1) {
    const rows = analysis.results[n] || [];
    if (!rows.length) continue;
    lines.push(`### ${n}-gram clusters`, "", "| phrase | count | files |", "| --- | ---: | ---: |");
    for (const row of rows) lines.push(`| ${row.phrase} | ${row.count} | ${row.fileCount} |`);
    lines.push("");
  }

  if (lines.at(-1) !== "") lines.push("");
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

function writeArtifactReport(projectRoot, artifactRelativePath, marker, title, targetInfo, options, analysis) {
  const artifactPath = join(projectRoot, artifactRelativePath);
  const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
  const section = formatArtifactSection(title, targetInfo, options, analysis);
  const next = upsertSection(existing, marker, section);
  mkdirSync(join(projectRoot, "artifacts"), { recursive: true });
  writeFileSync(artifactPath, next, "utf8");
  return artifactPath;
}

const options = parseArgs(process.argv.slice(2));
const targetInfo = collectFiles(options.target);
const analysis = analyze(targetInfo.files, options);

if ((options.writeEarPass || options.writeAiTell) && targetInfo.targetType !== "project") {
  throw new Error("--write-ear-pass and --write-ai-tell require a Genesis project root target.");
}

const written = [];
if (options.writeEarPass) written.push(writeArtifactReport(targetInfo.root, join("artifacts", "ear-pass.md"), "ngram-audit", "Automated n-gram repetition scan", targetInfo, options, analysis));
if (options.writeAiTell) written.push(writeArtifactReport(targetInfo.root, join("artifacts", "ai-tell-mitigation-audit.md"), "ngram-audit", "Automated n-gram repetition scan", targetInfo, options, analysis));

if (options.json) {
  console.log(JSON.stringify({
    target: targetInfo.root,
    targetType: targetInfo.targetType,
    filesScanned: targetInfo.files.length,
    tokensScanned: analysis.totalTokens,
    options: { minN: options.minN, maxN: options.maxN, minCount: options.minCount, top: options.top },
    results: analysis.results,
  }, null, 2));
} else {
  const report = formatMarkdownReport(targetInfo, options, analysis);
  console.log(report);
  if (written.length) console.log(`Updated artifact section(s): ${written.join(", ")}`);
}
