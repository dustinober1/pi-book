import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("the packed 1.4 extension initializes a clean project and keeps research optional", async () => {
  const temp = mkdtempSync(join(tmpdir(), "novel-forge-v14-packed-start-"));
  try {
    const pack = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temp], { cwd: process.cwd() }).toString())[0];
    execFileSync("tar", ["-xzf", join(temp, pack.filename), "-C", temp]);
    const packageRoot = resolve(temp, "package");
    execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: packageRoot, stdio: "pipe" });
    const store = await import(pathToFileURL(resolve(packageRoot, "src", "project", "store.ts")).href);
    const guide = await import(pathToFileURL(resolve(packageRoot, "src", "application", "guide.ts")).href);
    const root = store.initializeProject(temp, { projectName: "Packed Start", projectType: "standalone", profile: "thriller" });
    const project = store.readProject(root);
    const screen = guide.buildGuideScreen(root);
    assert.equal(project.novel_forge_version, "1.5.0");
    assert.notEqual(screen.actions[0]?.id, "research");
    assert.equal(screen.actions[0]?.kind, "primary");
    assert.equal(screen.actions.find((action: { id: string }) => action.id === "research")?.kind, "secondary");
    assert.equal(existsSync(resolve(packageRoot, "src", "evaluation", "v1-3-release.ts")), true);
    assert.equal(JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")).version, "1.5.0");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
