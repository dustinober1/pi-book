import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("the packed extension imports and registers against the installed Pi API boundary", async () => {
  const temp = mkdtempSync(join(tmpdir(), "novel-forge-pack-"));
  try {
    const json = execFileSync("npm", ["pack", "--json", "--pack-destination", temp], { cwd: process.cwd() }).toString();
    const filename = JSON.parse(json)[0].filename as string;
    execFileSync("tar", ["-xzf", join(temp, filename), "-C", temp]);
    const packageRoot = resolve(temp, "package");
    execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: packageRoot, stdio: "pipe" });
    const module = await import(pathToFileURL(resolve(packageRoot, "extensions", "novel-forge.ts")).href);
    const commands: string[] = []; const tools: string[] = [];
    module.default({ registerCommand(name: string) { commands.push(name); }, registerTool(tool: { name: string }) { tools.push(tool.name); }, sendUserMessage() {} });
    assert.equal(commands.length, 10);
    assert.ok(commands.includes("novel-readers"));
    assert.deepEqual(tools, ["novel_apply_event"]);
    assert.match(readFileSync(resolve(packageRoot, "package.json"), "utf8"), /novel-forge-for-pi/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
