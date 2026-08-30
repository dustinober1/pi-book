import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import novelForgeExtension from "../extensions/novel-forge.js";

const root = process.cwd();

function text(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function registeredCommandNames(): string[] {
  const commands: string[] = [];
  novelForgeExtension({
    registerCommand(name: string) { commands.push(name); },
    registerTool() { /* command/tool parity is out of this test's scope */ },
    sendUserMessage() {},
  } as never);
  return commands;
}

// The registered set is derived by actually invoking registration against a
// recording stub, not by parsing src/pi/*.ts for `registerCommand(` calls, so
// this test cannot drift from the real command surface the way SKILL.md did
// (14 of 18 commands listed, two wizard workflows missing).
test("every registered command is documented in SKILL.md's power-user list, and vice versa", () => {
  const commands = registeredCommandNames();
  const skill = text("SKILL.md");
  const block = skill.match(/## Power-user commands\n\n```text\n([\s\S]*?)```/);
  assert.ok(block, "SKILL.md must carry a fenced power-user command list.");
  const listed = block![1]!.trim().split("\n").map((line) => line.trim().split(/\s+/)[0]!.replace(/^\//, ""));

  const commandSet = new Set(commands);
  const listedSet = new Set(listed);
  const undocumented = commands.filter((name) => !listedSet.has(name));
  const nonexistent = listed.filter((name) => !commandSet.has(name));
  assert.deepEqual(undocumented, [], `Registered but undocumented in SKILL.md: ${undocumented.join(", ")}`);
  assert.deepEqual(nonexistent, [], `Documented in SKILL.md but not registered: ${nonexistent.join(", ")}`);
});

test("release notes exist for the current package version", () => {
  const packageJson = JSON.parse(text("package.json")) as { version: string };
  assert.equal(existsSync(join(root, "docs", "releases", `v${packageJson.version}.md`)), true, `Missing docs/releases/v${packageJson.version}.md`);
});

test("package version, lock version, and the runtime version constant agree", () => {
  const packageJson = JSON.parse(text("package.json")) as { version: string };
  const lock = JSON.parse(text("package-lock.json")) as { version: string; packages: Record<string, { version?: string }> };
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[""]?.version, packageJson.version);
  const escaped = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(text("src/application/version-core.ts"), new RegExp(`NOVEL_FORGE_VERSION\\s*=\\s*"${escaped}"`));
});

test("verify:release and test:release name scripts and tests that exist", () => {
  const packageJson = JSON.parse(text("package.json")) as { scripts: Record<string, string> };
  const verifyMatch = packageJson.scripts["verify:release"]?.match(/scripts\/([\w.-]+\.ts)/);
  assert.ok(verifyMatch, "verify:release must name a script under scripts/.");
  assert.equal(existsSync(join(root, "scripts", verifyMatch![1]!)), true, `Missing scripts/${verifyMatch![1]}`);

  const releaseTestFiles = [...(packageJson.scripts["test:release"] ?? "").matchAll(/(tests\/[\w./-]+\.test\.ts)/g)].map((match) => match[1]!);
  assert.ok(releaseTestFiles.length > 0, "test:release must name at least one test file.");
  for (const file of releaseTestFiles) assert.equal(existsSync(join(root, file)), true, `Missing ${file}`);
});

// This is the drift class that made the 2.1.0 cut red and left SKILL.md
// pinning "Novel Forge 1.6.2" thirteen releases later: a document's "this is
// the current version" example moves on only when someone remembers to edit
// prose, and nothing checked it. Each assertion targets one such example.
test("no shipped current-version example names an older Novel Forge version", () => {
  const packageJson = JSON.parse(text("package.json")) as { version: string };
  const escaped = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const readme = text("README.md");
  assert.match(readme, new RegExp(`pi install git:github\\.com/dustinober1/pi-book@v${escaped}`), "README install example is stale.");
  assert.match(readme, new RegExp(`pi -e git:github\\.com/dustinober1/pi-book@v${escaped}`), "README one-session example is stale.");
  assert.match(readme, new RegExp(`Novel Forge ${escaped} release notes`), "README release-notes link is stale.");

  const release = text("RELEASE.md");
  assert.match(release, new RegExp(`## Current verified release: v${escaped}`), "RELEASE.md current-release heading is stale.");
  assert.match(release, new RegExp(`Novel Forge ${escaped} is the pinned release`), "RELEASE.md pinned-release sentence is stale.");

  const skill = text("SKILL.md");
  assert.match(skill, new RegExp(`Novel Forge ${escaped} is \`v${escaped}\``), "SKILL.md's pinned-tag example is stale.");
});

test("the shipped wizard page carries no hardcoded version literal", () => {
  const html = text("wizard/index.html");
  assert.match(html, /\{\{NOVEL_FORGE_VERSION\}\}/, "wizard/index.html should render the version dynamically, not hardcode it.");
  assert.doesNotMatch(html, /Novel Forge \d/, "wizard/index.html must not hardcode a version literal.");
});
