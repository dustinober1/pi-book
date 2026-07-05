import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Continuity scan.
//
// Reads locked numerical/term facts from artifacts/continuity-ledger.md and
// scans the manuscript for divergences. Catches the reviewer's exact complaint
// (Abdi is eleven, later thirteen, elsewhere twelve) plus age/count/date/year
// drift on any locked term. This is a deterministic scanner — cheaper and more
// reliable than asking the LLM each pass.

const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function usage() {
  console.log(`Usage: node scripts/continuity-scan.mjs [project-root] [options]

Target:
  <project-root>   A Genesis project root (must contain PROJECT_STATE.yaml).
                   Reads locked facts from artifacts/continuity-ledger.md and scans
                   manuscript/chapters/ (or delivery/manuscript-full.md).

Options:
  --ledger <path>  Path to a continuity ledger (default: artifacts/continuity-ledger.md)
  --json           Output JSON instead of Markdown
  --write-audit    Write/update a bounded section in artifacts/continuity-scan.md
  --help           Show this help

Examples:
  npm run audit:continuity -- examples/novel-project
  node scripts/continuity-scan.mjs examples/novel-project --write-audit
`);
}

function parseArgs(argv) {
  const args = { target: process.cwd(), ledger: "", json: false, writeAudit: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") { usage(); process.exit(0); }
    if (token === "--json") { args.json = true; continue; }
    if (token === "--write-audit") { args.writeAudit = true; continue; }
    if (token === "--ledger") { args.ledger = argv[++i] || ""; continue; }
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

function resolveManuscript(root) {
  const chaptersDir = join(root, "manuscript", "chapters");
  if (existsSync(chaptersDir)) {
    const files = walkMarkdownFiles(chaptersDir);
    if (files.length) return files;
  }
  const compiled = join(root, "delivery", "manuscript-full.md");
  if (existsSync(compiled)) return [compiled];
  throw new Error(`No manuscript found under ${root}. Draft or compile first.`);
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

// Parse the continuity-ledger lock table for "numerical value" rows and the
// timeline anchors, plus any "alternate forms to catch" entries.
function parseLockedFacts(ledgerText) {
  const facts = []; // { canonical, type, alternates:[], lockedIn }
  const lines = ledgerText.split(/\r?\n/);
  let inLockTable = false;
  let inTimeline = false;
  let headerSeen = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\|\s*canonical form\s*\|/i.test(trimmed)) { inLockTable = true; headerSeen = 0; continue; }
    if (/^\|\s*anchor\s*\|/i.test(trimmed)) { inTimeline = true; headerSeen = 0; continue; }
    if (inLockTable || inTimeline) {
      if (/^\|\s*-{3,}/.test(trimmed)) { headerSeen += 1; continue; }
      if (!trimmed.startsWith("|")) { inLockTable = false; inTimeline = false; continue; }
      if (headerSeen < 1) continue; // wait for separator row
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (inLockTable) {
        const [canonical, type, , lockedIn, alternates] = cells;
        if (canonical && /numerical value|world fact|object|date\/time reference|character name/i.test(type || "")) {
          facts.push({ canonical, type: type || "", lockedIn: lockedIn || "", alternates: (alternates || "").split(/[\/,;]/).map((s) => s.trim()).filter(Boolean) });
        }
      }
    }
  }
  return facts;
}

function valueOf(token) {
  if (/^\d+$/.test(token)) return Number.parseInt(token, 10);
  const lower = token.toLowerCase();
  if (lower in WORD_NUMBERS) return WORD_NUMBERS[lower];
  return null;
}

// Build candidate numeric mentions near a subject term.
function findNumericMentions(text, subjectTerms) {
  const cleaned = stripMarkdown(text);
  const findings = [];
  // Patterns: "<subject>, <num>", "<subject> (<num>)", "<num>-year-old <subject>",
  // "<subject> was/were/is/are <num>", "age <num> <subject>", "<subject> of <num>"
  for (const subject of subjectTerms) {
    if (!subject) continue;
    const esc = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      { re: new RegExp(`\\b${esc}\\b[^.\\n]{0,30}?\\b(\\d{1,4}|${Object.keys(WORD_NUMBERS).join("|")})\\b`, "gi"), kind: "proximate" },
      { re: new RegExp(`\\b(\\d{1,4}|${Object.keys(WORD_NUMBERS).join("|")})-?year[s]?-old[^.\\n]{0,20}?\\b${esc}\\b`, "gi"), kind: "age-adjunct" },
      { re: new RegExp(`\\bage\\s+(\\d{1,4})[^.\\n]{0,20}?\\b${esc}\\b`, "gi"), kind: "age-prefix" },
      { re: new RegExp(`\\b${esc}\\b[^.\\n]{0,15}?(?:was|is|were|are)\\s+(\\d{1,4}|${Object.keys(WORD_NUMBERS).join("|")})\\b`, "gi"), kind: "copula" },
    ];
    for (const { re, kind } of patterns) {
      let m;
      while ((m = re.exec(cleaned)) !== null) {
        const numToken = m[1];
        const value = valueOf(numToken);
        if (value === null) continue;
        const radius = 50;
        const start = Math.max(0, m.index - radius);
        const end = Math.min(cleaned.length, m.index + m[0].length + radius);
        findings.push({ subject, kind, value, excerpt: `${start > 0 ? "…" : ""}${cleaned.slice(start, end).replace(/\s+/g, " ").trim()}${end < cleaned.length ? "…" : ""}` });
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    }
  }
  return findings;
}

function analyze(root, options) {
  const ledgerPath = options.ledger ? resolve(options.ledger) : join(root, "artifacts", "continuity-ledger.md");
  if (!existsSync(ledgerPath)) {
    throw new Error(`No continuity ledger found at ${ledgerPath}. Scaffold artifacts/continuity-ledger.md from references/templates/continuity-ledger.md and lock numerical facts first.`);
  }
  const ledgerText = readFileSync(ledgerPath, "utf8");
  const facts = parseLockedFacts(ledgerText);
  const files = resolveManuscript(root);

  const findings = []; // { subject, lockedValue, manuscriptValue, file, kind, excerpt, status }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const fact of facts) {
      // Derive a canonical numeric value from the locked form (e.g., "Abdi's age: 11")
      const lockedNums = [...fact.canonical.matchAll(/\b(\d{1,4})\b/g)].map((m) => Number.parseInt(m[1], 10));
      if (!lockedNums.length) continue; // only scan facts that contain a number to defend
      const subjectTerms = [fact.canonical.replace(/[:].*$/, "").trim(), ...fact.alternates]
        .map((s) => s.replace(/\s*\(\d+\)\s*/g, "").trim())
        .filter((s) => s && s.length >= 3 && /[a-z]/i.test(s));
      if (!subjectTerms.length) continue;
      const mentions = findNumericMentions(text, subjectTerms);
      for (const mention of mentions) {
        for (const locked of lockedNums) {
          // Only flag plausible divergences: not equal, and within a sane window (so we don't flag "year 600" vs "age 11").
          if (mention.value !== locked && Math.abs(mention.value - locked) <= 30) {
            findings.push({
              subject: fact.canonical,
              lockedValue: locked,
              manuscriptValue: mention.value,
              file,
              kind: mention.kind,
              excerpt: mention.excerpt,
              status: Math.abs(mention.value - locked) <= 2 ? "likely-continuity-error" : "verify",
            });
          }
        }
      }
    }
  }

  // De-duplicate by (subject, manuscriptValue, excerpt)
  const seen = new Set();
  const deduped = findings.filter((f) => {
    const key = `${f.subject}|${f.manuscriptValue}|${f.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { files, factsScanned: facts.length, findings: deduped };
}

function formatMarkdownReport(root, options, analysis) {
  const lines = [
    "# Genesis continuity scan",
    "",
    `- Project root: ${root}`,
    `- Files scanned: ${analysis.files.length}`,
    `- Locked facts considered: ${analysis.files.length ? analysis.findings.length : 0}`,
    "- Notes: This scanner reads locked numerical facts from the continuity ledger and flags manuscript mentions whose value diverges. Review each finding; some are intentional in-world.",
    "",
    "## Findings",
    "",
    "| subject | locked | found | status | file | excerpt |",
    "| --- | ---: | ---: | --- | --- | --- |",
  ];
  if (!analysis.findings.length) {
    lines.push("| _(no divergences detected)_ | — | — | clean | — | — |");
  } else {
    for (const f of analysis.findings) {
      const file = relative(process.cwd(), f.file) || f.file;
      const esc = f.excerpt.replace(/\|/g, "\\|");
      lines.push(`| ${f.subject} | ${f.lockedValue} | ${f.manuscriptValue} | ${f.status} | ${file} | ${esc} |`);
    }
  }
  lines.push("", "## Repair guidance", "");
  lines.push("- `likely-continuity-error` (within ±2): almost always a real slip — standardize on the locked value or update the ledger with an explicit justification.");
  lines.push("- `verify`: possibly a different quantity (e.g., chapter number vs. age). Confirm against context before changing anything.");
  lines.push("- If the manuscript value is correct and the ledger is wrong, update the ledger first so future scans trust the right number.");
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(root, options, analysis) {
  const lines = [
    "## Automated continuity scan",
    "",
    `- Source: deterministic scan of locked numerical facts in artifacts/continuity-ledger.md against the manuscript`,
    "- Purpose: supporting diagnostic. Confirm each finding in context before editing.",
    "",
    "| subject | locked | found | status | file |",
    "| --- | ---: | ---: | --- | --- |",
  ];
  for (const f of analysis.findings.slice(0, 30)) {
    lines.push(`| ${f.subject} | ${f.lockedValue} | ${f.manuscriptValue} | ${f.status} | ${relative(process.cwd(), f.file) || f.file} |`);
  }
  if (!analysis.findings.length) lines.push("| _(no divergences)_ | — | — | — | — |");
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
const root = resolve(options.target);
if (!existsSync(join(root, "PROJECT_STATE.yaml"))) {
  throw new Error(`Expected a Genesis project root containing PROJECT_STATE.yaml: ${root}`);
}
const analysis = analyze(root, options);

if (options.json) {
  console.log(JSON.stringify({ root, ...analysis, files: analysis.files.map((f) => relative(process.cwd(), f) || f) }, null, 2));
} else {
  console.log(formatMarkdownReport(root, options, analysis));
  if (options.writeAudit) {
    const artifactPath = join(root, "artifacts", "continuity-scan.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "continuity-scan", formatArtifactSection(root, options, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
