import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("the packed extension imports, registers, and contains the 1.4 release surface", async () => {
  const temp = mkdtempSync(join(tmpdir(), "novel-forge-pack-"));
  try {
    const json = execFileSync("npm", ["pack", "--json", "--pack-destination", temp], { cwd: process.cwd() }).toString();
    const pack = JSON.parse(json)[0] as { filename: string; files: Array<{ path: string }> };
    const packedPaths = pack.files.map((item) => item.path);
    execFileSync("tar", ["-xzf", join(temp, pack.filename), "-C", temp]);
    const packageRoot = resolve(temp, "package");
    execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: packageRoot, stdio: "pipe" });
    const module = await import(pathToFileURL(resolve(packageRoot, "extensions", "novel-forge.ts")).href);
    const store = await import(pathToFileURL(resolve(packageRoot, "src", "project", "store.ts")).href);
    const commands: string[] = [];
    const tools: string[] = [];
    module.default({ registerCommand(name: string) { commands.push(name); }, registerTool(tool: { name: string }) { tools.push(tool.name); }, sendUserMessage() {} });
    assert.equal(commands.length, 14);
    assert.ok(commands.includes("novel"));
    assert.ok(commands.includes("novel-wizard"));
    assert.ok(commands.includes("novel-readers"));
    assert.ok(commands.includes("novel-adopt"));
    assert.ok(commands.includes("novel-organize"));
    assert.deepEqual(tools, ["novel_apply_event"]);
    const project = store.initializeProject(temp, { projectName: "Packed Prose Audit", projectType: "standalone", profile: "thriller" });
    writeFileSync(resolve(project, "books", "book-01", "manuscript", "chapters", "01-opening.md"), "# Opening\n\nThe the lantern failed.\n", "utf8");
    const proseOutput = execFileSync("npm", ["run", "audit:prose", "--", project], { cwd: packageRoot, encoding: "utf8" });
    const legacyOutput = execFileSync("node", [resolve(packageRoot, "scripts", "copy-mechanics-audit.mjs"), project], { cwd: packageRoot, encoding: "utf8" });
    assert.match(proseOutput, /mechanics\/doubled-word/);
    assert.match(legacyOutput, /^# Novel Forge copy-mechanics audit$/m);
    assert.match(legacyOutput, /mechanics\/doubled-word/);
    assert.equal(JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")).version, "1.6.1");
    for (const asset of [
      "README.md", "SKILL.md", "CHANGELOG.md", "RELEASE.md",
      "wizard/index.html", "wizard/app.js", "wizard/styles.css",
      "src/domain/v1-3-schemas.ts", "src/domain/v1-3-research-schemas.ts",
      "src/domain/v1-3-architecture-schemas.ts", "src/domain/v1-3-audit-schemas.ts",
      "src/application/research/wizard.ts", "src/application/organizer/scan.ts", "src/application/organizer/apply.ts",
      "src/infrastructure/organization-transaction.ts", "src/evaluation/v1-3-release.ts", "src/evaluation/v1-3-journey.ts",
    ]) assert.equal(existsSync(resolve(packageRoot, asset)), true, asset);
    assert.equal(packedPaths.some((path) => path.startsWith("tests/")), false);
    assert.equal(packedPaths.some((path) => path.startsWith("evals/")), false);
    assert.equal(packedPaths.some((path) => path.startsWith(".github/")), false);
    assert.equal(packedPaths.some((path) => /phase7|diagnostic|\.tgz$/i.test(path)), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
