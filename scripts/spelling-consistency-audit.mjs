import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Spelling-system consistency audit.
//
// Detects mixed British / American spelling in the same manuscript. A
// reviewer will flag "labor/labour", "center/centre", "neighbor/neighbour",
// "theater/theatre" appearing in the same book as a copy-editing miss. This
// scanner lists every mixed-system word pair found, counts, and excerpts, so
// the author can standardize on one system before submission.

// Each entry: [british, american]. Bias toward forms that actually appear in
// literary prose; omit trivially rare ones. Order within a manuscript is
// detected, not assumed.
const SPELLING_PAIRS = [
  ["labour", "labor"],
  ["laboured", "labored"],
  ["labouring", "laboring"],
  ["centre", "center"],
  ["centred", "centered"],
  ["centres", "centers"],
  ["theatre", "theater"],
  ["theatres", "theaters"],
  ["neighbour", "neighbor"],
  ["neighbours", "neighbors"],
  ["neighbourhood", "neighborhood"],
  ["colour", "color"],
  ["colours", "colors"],
  ["coloured", "colored"],
  ["favour", "favor"],
  ["favours", "favors"],
  ["favoured", "favored"],
  ["favourite", "favorite"],
  ["favourites", "favorites"],
  ["honour", "honor"],
  ["honoured", "honored"],
  ["behaviour", "behavior"],
  ["harbour", "harbor"],
  ["harbours", "harbors"],
  ["rumour", "rumor"],
  ["rumours", "rumors"],
  ["tumour", "tumor"],
  ["tumours", "tumors"],
  ["humour", "humor"],
  ["humours", "humors"],
  ["valour", "valor"],
  ["vigour", "vigor"],
  ["ardour", "ardor"],
  ["splendour", "splendor"],
  ["rancour", "rancor"],
  ["clamour", "clamor"],
  ["glamour", "glamor"],
  ["parlour", "parlor"],
  ["mould", "mold"],
  ["moulds", "molds"],
  ["moulded", "molded"],
  ["smoulder", "smolder"],
  ["smouldered", "smoldered"],
  ["grey", "gray"],
  ["greys", "grays"],
  ["greyed", "grayed"],
  ["greyish", "grayish"],
  ["judgement", "judgment"],
  ["acknowledgement", "acknowledgment"],
  ["pretence", "pretense"],
  ["pretences", "pretenses"],
  ["defence", "defense"],
  ["defences", "defenses"],
  ["offence", "offense"],
  ["offences", "offenses"],
  ["licence", "license"],
  ["licences", "licenses"],
  ["practise", "practice"],
  ["practised", "practiced"],
  ["practising", "practicing"],
  ["cosy", "cozy"],
  ["draught", "draft"],
  ["draughts", "drafts"],
  ["pyjamas", "pajamas"],
  ["sceptic", "skeptic"],
  ["sceptics", "skeptics"],
  ["sceptical", "skeptical"],
  ["sulphur", "sulfur"],
  ["tyre", "tire"],
  ["tyres", "tires"],
  ["vapour", "vapor"],
  ["vapours", "vapors"],
  ["cheque", "check"],
  ["cheques", "checks"],
  ["programme", "program"],
  ["catalogue", "catalog"],
  ["catalogues", "catalogs"],
  ["analogue", "analog"],
  ["maths", "math"],
  ["oedema", "edema"],
  ["kerb", "curb"],
  ["gaol", "jail"],
  ["gaoler", "jailer"],
  ["argument", "argument"], // american-only; flag if "arguement" typo? skip
  ["traveller", "traveler"],
  ["travellers", "travelers"],
  ["travelling", "traveling"],
  ["travelled", "traveled"],
  ["cancellation", "cancellation"], // both acceptable; skip
  ["counsellor", "counselor"],
  ["counsellors", "counselors"],
  ["labelled", "labeled"],
  ["labelling", "labeling"],
  ["modelled", "modeled"],
  ["modelling", "modeling"],
  ["fuelled", "fueled"],
  ["fuelling", "fueling"],
  ["signalled", "signaled"],
  ["signalling", "signaling"],
  ["marvelled", "marveled"],
  ["marvelling", "marveling"],
  ["fulfil", "fulfill"],
  ["fulfils", "fulfills"],
  ["fulfilment", "fulfillment"],
  ["enrol", "enroll"],
  ["enrolment", "enrollment"],
  ["instal", "install"],
  ["instalment", "installment"],
  ["skillful", "skillful"], // american; british is "skilful" — skip ambiguous
  ["towards", "toward"],
  ["afterwards", "afterward"],
  ["forwards", "forward"],
  ["backwards", "backward"],
  ["upwards", "upward"],
  ["downwards", "downward"],
  ["northwards", "northward"],
  ["southwards", "southward"],
  ["amidst", "amid"],
  ["amongst", "among"],
  ["whilst", "while"],
  ["amid", "amid"],
  ["plough", "plow"],
  ["ploughed", "plowed"],
  ["ploughing", "plowing"],
  ["sceptre", "scepter"],
  ["sceptres", "scepters"],
  ["spectre", "specter"],
  ["spectres", "specters"],
  ["kilometre", "kilometer"],
  ["millimetre", "millimeter"],
  ["litre", "liter"],
  ["litres", "liters"],
  ["metre", "meter"],
  ["metres", "meters"],
  ["manoeuvre", "maneuver"],
  ["manoeuvres", "maneuvers"],
  ["oestrogen", "estrogen"],
  ["haemoglobin", "hemoglobin"],
  ["haemorrhage", "hemorrhage"],
  ["paediatric", "pediatric"],
  ["orthopaedic", "orthopedic"],
  ["gynaecology", "gynecology"],
  ["oesophagus", "esophagus"],
  ["anaemia", "anemia"],
  ["anaesthesia", "anesthesia"],
  ["diarrhoea", "diarrhea"],
  ["foetus", "fetus"],
  ["leukaemia", "leukemia"],
  ["manoeuvring", "maneuvering"],
  ["greybeard", "graybeard"],
];

function usage() {
  console.log(`Usage: node scripts/spelling-consistency-audit.mjs [target] [options]

Target:
  file.md              Audit one Markdown file
  manuscript/chapters  Audit a directory of Markdown files
  <project-root>       Audit manuscript/chapters automatically when PROJECT_STATE.yaml exists

Options:
  --json               Output JSON instead of Markdown
  --write-audit        Write/update a bounded section in artifacts/spelling-consistency-audit.md
  --help               Show this help

Examples:
  npm run audit:spelling -- /path/to/project
  node scripts/spelling-consistency-audit.mjs /path/to/project --write-audit
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
    .replace(/https?:\/\/\S+/g, " ");
}

function buildIndex() {
  // Map each spelling form to { system: "british"|"american", partner: <other form> }
  const index = new Map();
  for (const [british, american] of SPELLING_PAIRS) {
    if (british === american) continue;
    index.set(british, { system: "british", partner: american });
    index.set(american, { system: "american", partner: british });
  }
  return index;
}

const INDEX = buildIndex();

function analyze(files) {
  // form -> { count, files:Set, examples:[] }
  const formHits = new Map();
  // system -> total tokens
  const systemTotals = { british: 0, american: 0 };
  let totalWords = 0;

  for (const file of files) {
    const cleaned = stripMarkdown(readFileSync(file, "utf8"));
    const words = cleaned.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    totalWords += words.length;
    for (const word of words) {
      const lower = word.toLowerCase();
      const entry = INDEX.get(lower);
      if (!entry) continue;
      systemTotals[entry.system] += 1;
      const existing = formHits.get(lower) || { form: lower, system: entry.system, partner: entry.partner, count: 0, files: new Set(), examples: [] };
      existing.count += 1;
      existing.files.add(file);
      if (existing.examples.length < 3) {
        const idx = cleaned.toLowerCase().indexOf(lower);
        if (idx >= 0) {
          const radius = 45;
          const start = Math.max(0, idx - radius);
          const end = Math.min(cleaned.length, idx + lower.length + radius);
          existing.examples.push(`${start > 0 ? "…" : ""}${cleaned.slice(start, end).replace(/\s+/g, " ").trim()}${end < cleaned.length ? "…" : ""}`);
        }
      }
      formHits.set(lower, existing);
    }
  }

  // Find pairs where BOTH forms appear anywhere in the manuscript.
  const mixedPairs = [];
  const seenPairs = new Set();
  for (const [form, hit] of formHits) {
    const partner = hit.partner;
    const key = [form, partner].sort().join("|");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const partnerHit = formHits.get(partner);
    if (partnerHit) {
      mixedPairs.push({
        british: hit.system === "british" ? form : partner,
        american: hit.system === "american" ? form : partner,
        britishCount: (hit.system === "british" ? hit : partnerHit).count,
        americanCount: (hit.system === "american" ? hit : partnerHit).count,
        britishFiles: (hit.system === "british" ? hit : partnerHit).files.size,
        americanFiles: (hit.system === "american" ? hit : partnerHit).files.size,
      });
    }
  }
  mixedPairs.sort((a, b) => (b.britishCount + b.americanCount) - (a.britishCount + a.americanCount));

  // Single-system usage (no mixing) still report for awareness.
  const totalSystemTokens = systemTotals.british + systemTotals.american;
  const dominantSystem = systemTotals.british > systemTotals.american ? "british" : systemTotals.american > systemTotals.british ? "american" : "tied";

  // Stray tokens: a minority-system word in a confidently dominant-system
  // manuscript is a copy-editing miss even when the partner form is absent
  // (e.g., a lone "pretence" in an otherwise-American manuscript). Flag these
  // only when the dominant system is confidently inferred.
  const minoritySystem = dominantSystem === "british" ? "american" : dominantSystem === "american" ? "british" : null;
  const dominantShare = totalSystemTokens > 0 ? Math.max(systemTotals.british, systemTotals.american) / totalSystemTokens : 0;
  const confidentDominance = totalSystemTokens >= 4 && dominantShare >= 0.7;
  const strayTokens = [];
  if (confidentDominance && minoritySystem) {
    for (const hit of formHits.values()) {
      if (hit.system === minoritySystem) strayTokens.push(hit);
    }
    strayTokens.sort((a, b) => b.count - a.count);
  }

  return {
    totalWords,
    systemTotals,
    dominantSystem,
    dominantShare,
    confidentDominance,
    strayTokens,
    mixedPairs,
    allHits: [...formHits.values()].sort((a, b) => b.count - a.count),
  };
}

function formatMarkdownReport(targetInfo, analysis) {
  const rel = targetInfo.files.map((f) => relative(process.cwd(), f) || f);
  const lines = [
    "# Genesis spelling-consistency audit",
    "",
    `- Target: ${targetInfo.root}`,
    `- Target type: ${targetInfo.targetType}`,
    `- Files scanned: ${targetInfo.files.length}`,
    `- Words scanned: ${analysis.totalWords.toLocaleString()}`,
    `- File selection: ${rel.slice(0, 8).join(", ")}${rel.length > 8 ? `, +${rel.length - 8} more` : ""}`,
    `- British-spelling tokens: ${analysis.systemTotals.british}`,
    `- American-spelling tokens: ${analysis.systemTotals.american}`,
    `- Inferred dominant system: ${analysis.dominantSystem}`,
    "",
    "## Verdict",
    "",
  ];
  if (!analysis.mixedPairs.length && !analysis.strayTokens.length) {
    lines.push(`- **clean** — no British/American spelling pair appears in both forms, and no stray minority-system tokens detected. Manuscript reads as a single spelling system (${analysis.dominantSystem}).`);
  } else {
    if (analysis.mixedPairs.length) {
      lines.push(`- ⚠ **mixed spelling systems** — ${analysis.mixedPairs.length} word(s) appear in BOTH British and American forms. Standardize on one system before submission.`);
    }
    if (analysis.strayTokens.length) {
      lines.push(`- ⚠ **stray ${analysis.strayTokens[0].system} tokens** in a ${analysis.dominantSystem} manuscript — ${analysis.strayTokens.length} word form(s) belong to the other system even though their counterpart never appears. These read as copy-editing misses (e.g., a lone "pretence" in an American book).`);
    }
    lines.push(`- Recommended target system: **${analysis.dominantSystem}** (current majority, ${analysis.confidentDominance ? `${(analysis.dominantShare * 100).toFixed(0)}%` : "weak"}). Override only with a deliberate reason (e.g., UK publisher, character voice).`);
  }
  lines.push("", "## Mixed-system word pairs", "");
  if (!analysis.mixedPairs.length) {
    lines.push("- _none_");
  } else {
    lines.push("| british form | × | american form | × | total |", "| --- | ---: | --- | ---: | ---: |");
    for (const p of analysis.mixedPairs) lines.push(`| ${p.british} | ${p.britishCount} | ${p.american} | ${p.americanCount} | ${p.britishCount + p.americanCount} |`);
  }
  if (analysis.strayTokens.length) {
    lines.push("", "## Stray minority-system tokens", "", `| stray form (${analysis.strayTokens[0].system}) | should be (${analysis.dominantSystem}) | count | files |`, "| --- | --- | ---: | ---: |");
    for (const s of analysis.strayTokens) lines.push(`| ${s.form} | ${s.partner} | ${s.count} | ${s.files.size} |`);
  }
  if (analysis.allHits.length) {
    lines.push("", "## All spelling-system tokens found", "", "| form | system | count | files |", "| --- | --- | ---: | ---: |");
    for (const h of analysis.allHits) lines.push(`| ${h.form} | ${h.system} | ${h.count} | ${h.files.size} |`);
  }
  lines.push("", "## Standardization guidance", "");
  lines.push("- For U.S. submission, standardize to American spelling unless the publisher or a deliberate voice choice dictates otherwise.");
  lines.push("- For UK / Commonwealth submission, standardize to British spelling.");
  lines.push("- Character voice can justify a holdout, but it must be intentional and consistent for that voice — not random.");
  lines.push("- After standardizing, re-run this scan to confirm zero mixed pairs.");
  return `${lines.join("\n")}\n`;
}

function formatArtifactSection(targetInfo, analysis) {
  const lines = [
    "## Automated spelling-consistency scan",
    "",
    `- Source: British/American word-pair scan on ${targetInfo.files.length} manuscript file(s)`,
    `- British tokens: ${analysis.systemTotals.british} · American tokens: ${analysis.systemTotals.american} · inferred system: ${analysis.dominantSystem}`,
    "- Purpose: supporting diagnostic. Mixed spelling systems read as a copy-editing miss; standardize before submission.",
    "",
  ];
  if (analysis.mixedPairs.length) {
    lines.push("| british | × | american | × |", "| --- | ---: | --- | ---: |");
    for (const p of analysis.mixedPairs) lines.push(`| ${p.british} | ${p.britishCount} | ${p.american} | ${p.americanCount} |`);
    lines.push("");
  }
  if (analysis.strayTokens.length) {
    lines.push(`Stray ${analysis.strayTokens[0].system} tokens in a ${analysis.dominantSystem} manuscript:`, "", "| stray | should be | × |", "| --- | --- | ---: |");
    for (const s of analysis.strayTokens) lines.push(`| ${s.form} | ${s.partner} | ${s.count} |`);
    lines.push("");
  }
  if (!analysis.mixedPairs.length && !analysis.strayTokens.length) {
    lines.push("_No mixed-system pairs or stray tokens detected._", "");
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
    allHits: analysis.allHits.map((h) => ({ ...h, files: h.files.size })),
  }, null, 2));
} else {
  console.log(formatMarkdownReport(targetInfo, analysis));
  if (options.writeAudit) {
    if (targetInfo.targetType !== "project") throw new Error("--write-audit requires a Genesis project root target.");
    const artifactPath = join(targetInfo.root, "artifacts", "spelling-consistency-audit.md");
    const existing = existsSync(artifactPath) ? readFileSync(artifactPath, "utf8") : "";
    mkdirSync(join(targetInfo.root, "artifacts"), { recursive: true });
    writeFileSync(artifactPath, upsertSection(existing, "spelling-consistency-audit", formatArtifactSection(targetInfo, analysis)), "utf8");
    console.log(`Updated artifact section: ${artifactPath}`);
  }
}
