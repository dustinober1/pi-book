import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface V172ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(id: string, passed: boolean, detail: string): V172ReleaseCheck {
  return { id, passed, detail };
}

export function verifyV172ReleaseTree(root: string): V172ReleaseCheck[] {
  const packageJson = JSON.parse(text(root, "package.json")) as { version: string; scripts: Record<string, string>; files: string[] };
  const lock = JSON.parse(text(root, "package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  const versionSource = text(root, "src/application/version-core.ts");
  const readme = text(root, "README.md");
  const release = text(root, "RELEASE.md");
  const changelog = text(root, "CHANGELOG.md");
  const notes = text(root, "docs/releases/v1.7.2.md");
  const skill = text(root, "SKILL.md");
  const remarkabilityTemplate = text(root, "references/templates/novel/remarkability.yaml");

  return [
    check("package-version", packageJson.version === "1.7.2", `package.json version is ${packageJson.version}.`),
    check("lock-version", lock.version === "1.7.2" && lock.packages[""]?.version === "1.7.2", `Lock versions are ${lock.version} and ${lock.packages[""]?.version ?? "missing"}.`),
    check("runtime-version", /NOVEL_FORGE_VERSION\s*=\s*"1\.7\.2"/.test(versionSource), "Runtime version constant reports 1.7.2."),
    check("release-script", packageJson.scripts["verify:release"] === "node --import tsx scripts/verify-v1-7-2-release.ts", "verify:release targets the v1.7.2 checker."),
    check("release-files", ["docs/releases/v1.7.2.md", "scripts/verify-v1-7-2-release.ts", "tests/v1-7-2-release-checklist.test.ts"].every((path) => existsSync(join(root, path))), "All v1.7.2 release files exist."),
    check("pinned-install", /pi install git:github\.com\/dustinober1\/pi-book@v1\.7\.2/.test(readme) && /@v1\.7\.2/.test(release), "README and release status pin v1.7.2."),
    check("changelog", /## 1\.7\.2 — Guarded YAML Authoring Guidance/.test(changelog), "Changelog contains the v1.7.2 heading."),
    check("release-notes", /additional properties/.test(notes) && /quoting any YAML scalar containing `: `/.test(notes), "Release notes describe the YAML-authoring fix."),
    check("skill-yaml-quoting-rule", /scalar string value containing `: `/.test(skill), "SKILL.md requires quoting colon-bearing YAML scalars."),
    check("skill-exact-field-rule", /Do not add descriptive extra keys/.test(skill), "SKILL.md requires using only exact schema field names for nested objects."),
    check("remarkability-template-documents-fields", ["signature_moments items use exactly these keys", "productive_disagreements items use exactly these keys", "recurring_motifs items use exactly these keys"].every((phrase) => remarkabilityTemplate.includes(phrase)), "remarkability.yaml template documents the exact allowed nested keys."),
    check("package-assets", ["src/", "scripts/", "SKILL.md", "README.md", "RELEASE.md"].every((path) => packageJson.files.includes(path)), "Package allowlist includes runtime and guidance assets."),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = verifyV172ReleaseTree(process.cwd());
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}
