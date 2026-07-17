import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { countWords, findProjectRoot, safeSlug } from "../../infrastructure/files.js";
import type { OrganizationPreview, OrganizerCandidate, OrganizerCategory, OrganizerConfidence } from "./types.js";

const maxFiles = 2_000;
const maxFileBytes = 20 * 1024 * 1024;
const maxSelectedBytes = 100 * 1024 * 1024;
const textExtensions = new Set([".md", ".txt"]);
const documentExtensions = new Set([".docx", ".epub", ".pdf", ".rtf"]);
const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".wav"]);
const codeExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".class", ".sh", ".css", ".scss", ".html", ".map"]);
const configExtensions = new Set([".json", ".yaml", ".yml", ".toml", ".lock", ".ini", ".env"]);
const prunedDirectories = new Set([
  ".git", ".archive", ".pi-book", ".next", ".cache", "node_modules", "dist", "build", "coverage", "out", "target", "vendor", "tmp", "temp",
]);
const protectedNames = new Set([
  "project.yaml", "status.md", "handoff.md", "start-here.md", "skill.md", "readme.md", "readme.txt", "license", "license.md", "changelog.md",
  "contributing.md", "security.md", "release.md", "code_of_conduct.md", "notice.md", "authors.md",
]);

interface RawFile {
  path: string;
  absolutePath: string;
  bytes: Uint8Array;
  byteSize: number;
  hash: string;
  exclusionReason: string | null;
}

function normalized(path: string): string { return path.split(sep).join("/").replace(/^\.\//, ""); }
function hash(bytes: Uint8Array | string): string { return createHash("sha256").update(bytes).digest("hex"); }
function collisionKey(path: string): string { return path.normalize("NFC").toLocaleLowerCase("en-US"); }

function isGeneratedDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return name.startsWith(".") || prunedDirectories.has(lower) || lower.startsWith(".novel-forge-");
}

function collectPaths(root: string): Array<{ path: string; absolutePath: string }> {
  const output: Array<{ path: string; absolutePath: string }> = [];
  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const path = normalized(relative(root, absolutePath));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!isGeneratedDirectory(entry.name)) {
          if (existsSync(join(absolutePath, ".git"))) throw new Error(`Nested Git repository is outside organizer scope: ${path}`);
          walk(absolutePath);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      output.push({ path, absolutePath });
      if (output.length > maxFiles) throw new Error(`Repository organization supports at most ${maxFiles} files in one scan.`);
    }
  }
  walk(root);
  return output.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true, sensitivity: "base" }));
}

function gitIgnored(root: string, paths: string[]): Set<string> {
  if (!paths.length) return new Set();
  let temporaryGitDir: string | null = null;
  try {
    let args: string[];
    if (existsSync(join(root, ".git"))) args = ["check-ignore", "--no-index", "--stdin", "-z"];
    else {
      temporaryGitDir = mkdtempSync(join(tmpdir(), "novel-forge-ignore-"));
      execFileSync("git", ["init", "--bare", temporaryGitDir], { stdio: "ignore" });
      args = [`--git-dir=${temporaryGitDir}`, `--work-tree=${root}`, "check-ignore", "--no-index", "--stdin", "-z"];
    }
    try {
      const output = execFileSync("git", args, { cwd: root, input: `${paths.join("\0")}\0`, stdio: ["pipe", "pipe", "ignore"] }).toString();
      return new Set(output.split("\0").filter(Boolean).map(normalized));
    } catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() ?? "";
      return new Set(output.split("\0").filter(Boolean).map(normalized));
    }
  } finally {
    if (temporaryGitDir) rmSync(temporaryGitDir, { recursive: true, force: true });
  }
}

function configReason(path: string): string | null {
  const name = basename(path).toLowerCase();
  if (path.toLowerCase().startsWith("docs/")) return "repository documentation is protected";
  const extension = extname(name);
  if (protectedNames.has(name) || name.startsWith("license") || name.startsWith("package-lock") || name.startsWith("yarn.lock") || name.startsWith("pnpm-lock")) return "repository documentation or configuration is protected";
  if (name.startsWith(".") || name.includes(".config.") || /^(package|tsconfig|jsconfig|eslint|prettier|vite|webpack|rollup|dockerfile)/i.test(name)) return "tool configuration is protected";
  if (configExtensions.has(extension) || codeExtensions.has(extension)) return "code or configuration files are outside organizer scope";
  return null;
}

function firstChapterNumber(path: string, text: string): number | null {
  const heading = text.match(/^(?:#{1,6}\s*)?(?:chapter|ch\.?)\s+(\d+)\b/im);
  if (heading?.[1]) return Number.parseInt(heading[1], 10);
  const filename = basename(path, extname(path)).match(/^0*(\d+)(?:\D|$)/);
  return filename?.[1] ? Number.parseInt(filename[1], 10) : null;
}

function classifyText(path: string, text: string): { category: OrganizerCategory; confidence: OrganizerConfidence; reason: string; chapterNumber: number | null } {
  const signal = `${path}\n${text.slice(0, 2_000)}`.toLowerCase();
  const chapterHeadings = [...text.matchAll(/^(?:#{1,6}\s*)?(?:chapter|ch\.?)\s+(\d+)\b/gim)];
  if (chapterHeadings.length > 1) return { category: "draft", confidence: "provisional", reason: "multi-chapter manuscript retained intact for later adoption and splitting", chapterNumber: null };
  const chapterNumber = firstChapterNumber(path, text);
  if (chapterNumber !== null) return { category: "chapter", confidence: "structural", reason: "explicit chapter heading or numeric filename", chapterNumber };
  if (/\b(outline|beat[ -]?sheet|synopsis|plot[ -]?plan|treatment|scene[ -]?list)\b/.test(signal)) return { category: "outline", confidence: "provisional", reason: "outline-related filename, folder, or heading", chapterNumber: null };
  if (/\b(character|characters|cast|character[ -]?(?:bio|sheet|profile))\b/.test(signal)) return { category: "character-note", confidence: "provisional", reason: "character-note filename, folder, or heading", chapterNumber: null };
  if (/\b(research|sources?|references?|bibliograph|fact[ -]?check)\b/.test(signal)) return { category: "research", confidence: "provisional", reason: "research-related filename, folder, or heading", chapterNumber: null };
  if (/\b(feedback|critique|editorial|revision[ -]?notes?|review[ -]?notes?)\b/.test(signal)) return { category: "editorial", confidence: "provisional", reason: "editorial-note filename, folder, or heading", chapterNumber: null };
  if (/\b(series|world|lore|canon|timeline|worldbuilding)\b/.test(signal)) return { category: "series-note", confidence: "provisional", reason: "series or worldbuilding filename, folder, or heading", chapterNumber: null };
  if (/\b(draft|manuscript|scene|fragment|prologue|epilogue|interlude)\b/.test(signal) || countWords(text) >= 500) return { category: "draft", confidence: "provisional", reason: "draft-related label or prose-sized text", chapterNumber: null };
  return { category: "note", confidence: "provisional", reason: "unclassified writing-related text", chapterNumber: null };
}

function assetSignatureMatches(extension: string, bytes: Uint8Array): boolean {
  if (extension === ".svg") return Buffer.from(bytes.slice(0, 256)).toString("utf8").includes("<svg");
  if (extension === ".png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (extension === ".jpg" || extension === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (extension === ".gif") return Buffer.from(bytes.slice(0, 3)).toString("ascii") === "GIF";
  if (extension === ".webp") return Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP";
  if (extension === ".wav") return Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF";
  return true;
}

function proposedBase(category: OrganizerCategory, path: string, sourceHash: string, chapterNumber: number | null): string | null {
  const extension = extname(path).toLowerCase();
  const stem = safeSlug(basename(path, extension));
  if (category === "chapter") return `books/book-01/manuscript/chapters/${String(chapterNumber ?? 1).padStart(2, "0")}-${stem}.md`;
  if (category === "draft") return `books/book-01/manuscript/drafts/${stem}${extension || ".md"}`;
  if (category === "outline") return `books/book-01/source-material/outlines/${stem}${extension || ".md"}`;
  if (category === "character-note") return `books/book-01/source-material/characters/${stem}${extension || ".md"}`;
  if (category === "series-note") return `series/source-material/${stem}${extension || ".md"}`;
  if (category === "research") return `research/notes/imported/${stem}${extension || ".md"}`;
  if (category === "editorial") return `books/book-01/source-material/editorial/${stem}${extension || ".md"}`;
  if (category === "note") return `books/book-01/source-material/notes/${stem}${extension || ".md"}`;
  if (category === "document") return `books/book-01/source-material/documents/${stem}${extension}`;
  if (category === "asset") return `books/book-01/assets/adopted/${sourceHash.slice(0, 12)}-${stem}${extension}`;
  return null;
}

function uniqueDestination(base: string | null, sourceHash: string, occupied: Set<string>): string | null {
  if (!base) return null;
  let candidate = base;
  let attempt = 0;
  while (occupied.has(collisionKey(candidate))) {
    attempt += 1;
    const extension = extname(base);
    const stem = extension ? base.slice(0, -extension.length) : base;
    candidate = `${stem}-${sourceHash.slice(0, 8)}${attempt > 1 ? `-${attempt}` : ""}${extension}`;
  }
  occupied.add(collisionKey(candidate));
  return candidate;
}

function excludedCandidate(raw: RawFile, reason: string): OrganizerCandidate {
  return {
    id: `file-${hash(`${raw.path}\0${raw.hash}`).slice(0, 16)}`,
    originalPath: raw.path,
    category: "excluded",
    confidence: "excluded",
    reason,
    destination: null,
    duplicateOf: null,
    byteSize: raw.byteSize,
    sha256: raw.hash,
    selected: false,
    archive: false,
    chapterNumber: null,
    excerpt: null,
  };
}

export function scanWritingRepository(inputRoot: string): OrganizationPreview {
  const requestedRoot = resolve(inputRoot);
  const rootStat = lstatSync(requestedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Repository organizer requires a real directory, not a symbolic link.");
  const root = realpathSync(requestedRoot);
  if (existsSync(join(root, "PROJECT.yaml"))) throw new Error("This repository is already a Novel Forge project. Use adoption or integrity repair instead.");
  const ancestorProject = findProjectRoot(dirname(root));
  if (ancestorProject) throw new Error(`Repository organizer cannot initialize a project inside existing Novel Forge project ${ancestorProject}.`);
  const pending = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith(".novel-forge-organize-txn-"));
  if (pending.length) throw new Error("An interrupted repository organization transaction exists. Inspect its journal and restore archived sources before rescanning; automatic recovery will not trust repository-authored journals.");

  const paths = collectPaths(root);
  const ignored = gitIgnored(root, paths.map((item) => item.path));
  const rawFiles: RawFile[] = paths.map((item) => {
    const stat = lstatSync(item.absolutePath);
    const ignoredPath = ignored.has(item.path);
    const protectedReason = ignoredPath ? "Git-ignored files are protected" : configReason(item.path);
    const extension = extname(item.path).toLowerCase();
    const supported = textExtensions.has(extension) || documentExtensions.has(extension) || assetExtensions.has(extension);
    const exclusionReason = protectedReason ?? (!supported ? "unsupported or unknown file type" : stat.size > maxFileBytes ? `file exceeds the ${maxFileBytes / 1024 / 1024} MB organizer limit` : null);
    if (exclusionReason) return { ...item, bytes: new Uint8Array(), byteSize: stat.size, hash: hash(`excluded\0${item.path}\0${stat.size}`), exclusionReason };
    const bytes = readFileSync(item.absolutePath);
    return { ...item, bytes, byteSize: bytes.byteLength, hash: hash(bytes), exclusionReason: null };
  });

  const occupied = new Set(paths.map((item) => collisionKey(item.path)));
  const firstByHash = new Map<string, OrganizerCandidate>();
  const candidates: OrganizerCandidate[] = [];
  let selectedBytes = 0;
  const usedChapterNumbers = new Set<number>();
  for (const raw of rawFiles) {
    if (raw.exclusionReason) { candidates.push(excludedCandidate(raw, raw.exclusionReason)); continue; }
    const extension = extname(raw.path).toLowerCase();
    let classification: { category: OrganizerCategory; confidence: OrganizerConfidence; reason: string; chapterNumber: number | null };
    let excerpt: string | null = null;
    if (textExtensions.has(extension)) {
      const text = Buffer.from(raw.bytes).toString("utf8");
      if (text.includes("\u0000")) { candidates.push(excludedCandidate(raw, "binary content is not safe to classify as text")); continue; }
      classification = classifyText(raw.path, text);
      if (classification.category === "chapter" && classification.chapterNumber !== null) {
        if (usedChapterNumbers.has(classification.chapterNumber)) {
          classification = { category: "draft", confidence: "provisional", reason: `duplicate chapter number ${classification.chapterNumber} retained as a draft for author resolution`, chapterNumber: null };
        } else usedChapterNumbers.add(classification.chapterNumber);
      }
      excerpt = text.replace(/\s+/g, " ").trim().slice(0, 400) || null;
    } else if (documentExtensions.has(extension)) {
      classification = { category: "document", confidence: "provisional", reason: "supported writing document retained without semantic conversion", chapterNumber: null };
    } else if (assetExtensions.has(extension) && assetSignatureMatches(extension, raw.bytes)) {
      classification = { category: "asset", confidence: "structural", reason: "supported asset type and file signature", chapterNumber: null };
    } else {
      candidates.push(excludedCandidate(raw, "unsupported or unrecognized file signature"));
      continue;
    }

    const prior = firstByHash.get(raw.hash);
    const id = `file-${hash(`${raw.path}\0${raw.hash}`).slice(0, 16)}`;
    if (prior) {
      const duplicate: OrganizerCandidate = {
        id,
        originalPath: raw.path,
        category: "duplicate",
        confidence: "structural",
        reason: `byte-identical duplicate of ${prior.originalPath}`,
        destination: prior.destination,
        duplicateOf: prior.id,
        byteSize: raw.byteSize,
        sha256: raw.hash,
        selected: true,
        archive: true,
        chapterNumber: prior.chapterNumber,
        excerpt,
      };
      candidates.push(duplicate);
      selectedBytes += raw.byteSize;
      continue;
    }
    const destination = uniqueDestination(proposedBase(classification.category, raw.path, raw.hash, classification.chapterNumber), raw.hash, occupied);
    const candidate: OrganizerCandidate = {
      id,
      originalPath: raw.path,
      ...classification,
      destination,
      duplicateOf: null,
      byteSize: raw.byteSize,
      sha256: raw.hash,
      selected: true,
      archive: true,
      excerpt,
    };
    firstByHash.set(raw.hash, candidate);
    candidates.push(candidate);
    selectedBytes += raw.byteSize;
    if (selectedBytes > maxSelectedBytes) throw new Error(`Selected writing files exceed the ${maxSelectedBytes / 1024 / 1024} MB organizer limit.`);
  }

  const previewHash = hash(JSON.stringify(candidates.map(({ excerpt: _excerpt, ...candidate }) => candidate)));
  const selected = candidates.filter((candidate) => candidate.selected);
  return {
    previewId: randomUUID(),
    previewHash,
    rootName: basename(root),
    candidates,
    warnings: [
      "Filename and folder classifications are provisional until the author confirms this preview.",
      "No notes are promoted into canon, plot, approvals, research claims, review evidence, or reader evidence.",
    ],
    totals: {
      scanned: candidates.length,
      selected: selected.length,
      excluded: candidates.filter((candidate) => !candidate.selected).length,
      archive: selected.filter((candidate) => candidate.archive).length,
      bytes: selected.reduce((sum, candidate) => sum + candidate.byteSize, 0),
    },
  };
}

export function renderOrganizationPreview(preview: OrganizationPreview): string {
  const selected = preview.candidates.filter((candidate) => candidate.selected);
  return [
    "# Repository Organization Preview",
    "",
    `- Repository: ${preview.rootName}`,
    `- Scanned files: ${preview.totals.scanned}`,
    `- Proposed files: ${preview.totals.selected}`,
    `- Protected/excluded files: ${preview.totals.excluded}`,
    `- Originals proposed for archive: ${preview.totals.archive}`,
    `- Preview hash: ${preview.previewHash}`,
    "",
    "## Proposed map",
    "",
    ...selected.map((candidate) => `- [${candidate.confidence}] ${candidate.originalPath} → ${candidate.destination ?? "archive as duplicate"} (${candidate.reason})`),
    "",
    "## Protected or excluded",
    "",
    ...preview.candidates.filter((candidate) => !candidate.selected).map((candidate) => `- ${candidate.originalPath}: ${candidate.reason}`),
    "",
    "## Safety",
    "",
    ...preview.warnings.map((warning) => `- ${warning}`),
    "- This preview did not change repository files.",
    "",
  ].join("\n");
}
