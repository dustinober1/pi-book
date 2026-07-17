import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}
function allFiles(root: string, path = root): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) output.push(...allFiles(root, absolute));
    else output.push(relative(root, absolute).replace(/\\/g, "/"));
  }
  return output.sort();
}
function check(id: string, passed: boolean, detail: string): ReleaseCheck { return { id, passed, detail }; }
function countOccurrences(value: string, needle: string): number { return value.split(needle).length - 1; }

export function verifyV13ReleaseTree(root: string): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; files: string[]; scripts: Record<string, string> };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  checks.push(check("package-version", packageJson.version === "1.3.0", `package.json version is ${packageJson.version}.`));
  checks.push(check("lock-version", lock.version === "1.3.0" && lock.packages[""]?.version === "1.3.0", `package-lock root versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`));
  checks.push(check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-3-release.ts", `verify:release script is ${packageJson.scripts["verify:release"] ?? "missing"}.`));

  const required = [
    "src/evaluation/v1-3-release.ts", "src/evaluation/v1-3-journey.ts", "src/application/research/wizard.ts",
    "wizard/index.html", "wizard/app.js", "wizard/styles.css", "README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md", "docs/releases/v1.3.0.md",
  ];
  const missing = required.filter((path) => !existsSync(join(root, path)));
  checks.push(check("required-release-files", missing.length === 0, missing.length ? `Missing: ${missing.join(", ")}.` : "All required release files exist."));

  const fixturesRoot = join(root, "evals", "v1-3-release");
  const fixtureNames = existsSync(fixturesRoot) ? readdirSync(fixturesRoot).filter((name) => name.endsWith(".yaml")).sort() : [];
  checks.push(check("release-fixture-count", fixtureNames.length === 9, `Found ${fixtureNames.length} release fixtures.`));

  const repoFiles = allFiles(root);
  const forbiddenPatterns = [
    /^docs\/\.phase/, /^scripts\/apply-phase/, /^\.github\/workflows\/phase7-(?:source-export|.*-apply)\.yml$/,
    /(?:^|\/)diagnostics?(?:\/|$)/i, /\.tgz$/, /(?:^|\/)package-output(?:\/|$)/,
    /^scripts\/(?:p7|phase7-green)/,
  ];
  const forbiddenFiles = repoFiles.filter((path) => forbiddenPatterns.some((pattern) => pattern.test(path)));
  checks.push(check("no-temporary-files", forbiddenFiles.length === 0, forbiddenFiles.length ? `Temporary files remain: ${forbiddenFiles.join(", ")}.` : "No temporary release files remain."));

  const release = existsSync(join(root, "docs", "releases", "v1.3.0.md")) ? text(root, "docs/releases/v1.3.0.md") : "";
  const boundaries = [
    /1\.2.*readable|backward compatib/i,
    /does not scrape|non-scraping/i,
    /public.*review.*not.*human|market evidence.*not.*reader evidence/i,
    /named.*influence|original voice/i,
    /127\.0\.0\.1|loopback-only/i,
    /writer approval|does not automate approvals/i,
    /pi install git:github\.com\/dustinober1\/pi-book@v1\.3\.0/i,
    /human editorial|human reader judgment/i,
  ];
  const absentBoundaries = boundaries.map((pattern, index) => pattern.test(release) ? null : index + 1).filter((value): value is number => value !== null);
  checks.push(check("release-note-boundaries", absentBoundaries.length === 0, absentBoundaries.length ? `Release notes miss boundary checks: ${absentBoundaries.join(", ")}.` : "Release notes contain all required boundaries."));

  const historicalInstallNotes = text(root, "docs/releases/v1.3.0.md");
  checks.push(check("readme-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.3\.0/.test(historicalInstallNotes), "Historical v1.3.0 release notes contain the tagged install command."));

  const releaseChecklist = text(root, "RELEASE.md");
  const duplicateLine = "- [ ] Existing adoption, readers, packaging, and next-book wizard workflows remain passing.";
  checks.push(check("release-checklist-deduplicated", countOccurrences(releaseChecklist, duplicateLine) <= 1, `Wizard regression checklist line appears ${countOccurrences(releaseChecklist, duplicateLine)} times.`));

  const filesAllowlist = new Set(packageJson.files ?? []);
  const requiredAllowlist = ["SKILL.md", "README.md", "CHANGELOG.md", "RELEASE.md", "agents/", "extensions/", "src/", "profiles/", "references/", "scripts/", "wizard/"];
  const allowlistMissing = requiredAllowlist.filter((path) => !filesAllowlist.has(path));
  const forbiddenAllowlist = ["evals/", "tests/", ".github/"].filter((path) => filesAllowlist.has(path));
  checks.push(check("package-allowlist", allowlistMissing.length === 0 && forbiddenAllowlist.length === 0, `Missing allowlist: ${allowlistMissing.join(", ") || "none"}; forbidden: ${forbiddenAllowlist.join(", ") || "none"}.`));

  try {
    const pack = JSON.parse(execFileSync("npm", ["pack", "--json", "--dry-run"], { cwd: root, encoding: "utf8" })) as Array<{ files: Array<{ path: string }> }>;
    const packed = new Set((pack[0]?.files ?? []).map((item) => item.path));
    const requiredPacked = [
      "package.json", "README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md",
      "src/evaluation/v1-3-release.ts", "src/evaluation/v1-3-journey.ts", "src/application/research/wizard.ts",
      "wizard/index.html", "wizard/app.js", "wizard/styles.css",
    ];
    const missingPacked = requiredPacked.filter((path) => !packed.has(path));
    const leakedPacked = [...packed].filter((path) => path.startsWith("tests/") || path.startsWith("evals/") || path.startsWith(".github/") || path.endsWith(".tgz"));
    checks.push(check("packed-file-contract", missingPacked.length === 0 && leakedPacked.length === 0, `Missing packed: ${missingPacked.join(", ") || "none"}; leaked: ${leakedPacked.join(", ") || "none"}.`));
  } catch (error) {
    checks.push(check("packed-file-contract", false, error instanceof Error ? error.message : String(error)));
  }

  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV13ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}
