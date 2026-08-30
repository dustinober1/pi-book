import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { check, text, type ReleaseCheck } from "./lib/release-check.js";

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

export function verifyV14ReleaseTree(root: string): ReleaseCheck[] {
  const checks: ReleaseCheck[] = [];
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; files: string[]; scripts: Record<string, string> };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };

  checks.push(check("package-version", packageJson.version === "1.4.2", `package.json version is ${packageJson.version}.`));
  checks.push(check("lock-version", lock.version === "1.4.2" && lock.packages[""]?.version === "1.4.2", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`));
  checks.push(check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-4-release.ts", `verify:release is ${packageJson.scripts["verify:release"] ?? "missing"}.`));

  const required = [
    "src/application/automation-run.ts",
    "src/application/autopilot.ts",
    "src/application/brief-bootstrap.ts",
    "src/application/event-rejection.ts",
    "src/application/packet-window.ts",
    "src/application/premise-lab.ts",
    "docs/novel-forge-v1-4-premise-laboratory.md",
    "docs/novel-forge-v1-4-resumable-runs.md",
    "docs/novel-forge-v1-4-rolling-packet-windows.md",
    "docs/novel-forge-v1-4-brief-autopilot.md",
    "docs/releases/v1.4.2.md",
    "README.md",
    "SKILL.md",
    "CHANGELOG.md",
    "RELEASE.md",
  ];
  const missing = required.filter((path) => !existsSync(join(root, path)));
  checks.push(check("required-files", missing.length === 0, missing.length ? `Missing: ${missing.join(", ")}.` : "All required 1.4 files exist."));

  const files = allFiles(root);
  const temporary = files.filter((path) => /^docs\/\.|^scripts\/(?:apply|fix)-v1-4|^\.github\/workflows\/apply-v1-4|\.tgz$/i.test(path));
  checks.push(check("no-temporary-files", temporary.length === 0, temporary.length ? `Temporary files: ${temporary.join(", ")}.` : "No temporary files remain."));

  const release = existsSync(join(root, "docs/releases/v1.4.2.md")) ? text(root, "docs/releases/v1.4.2.md") : "";
  const boundaries = [
    /writer.*approval|manual.*approval/i,
    /writer.*premise|does not.*select.*premise/i,
    /brief.*read.?only/i,
    /1\.3.*readable|older.*project/i,
    /not.*literary quality|workflow.*not.*quality/i,
    /v1\.4\.2/i,
  ];
  checks.push(check("release-note-boundaries", boundaries.every((pattern) => pattern.test(release)), "Release notes document approval, premise, brief, compatibility, and evaluation boundaries."));

  const allowlist = new Set(packageJson.files ?? []);
  const requiredAllowlist = ["SKILL.md", "README.md", "CHANGELOG.md", "RELEASE.md", "agents/", "extensions/", "src/", "profiles/", "references/", "scripts/", "wizard/"];
  const allowlistValid = requiredAllowlist.every((path) => allowlist.has(path)) && !allowlist.has("tests/") && !allowlist.has("evals/") && !allowlist.has(".github/");
  checks.push(check("package-allowlist", allowlistValid, "Package allowlist includes runtime assets and excludes tests, evaluations, and workflows."));

  return checks;
}
