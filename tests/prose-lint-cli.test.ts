import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { initializeProject } from "../src/project/store.js";

function fixture(): { parent: string; root: string; hashes: Map<string, string> } {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-prose-cli-"));
  const root = initializeProject(parent, { projectName: "CLI Fixture", projectType: "standalone", profile: "thriller" });
  const source = join(root, "books", "book-01", "manuscript", "chapters", "01-opening.md");
  writeFileSync(source, "# Opening\n\nThe the lantern went out.\n", "utf8");
  const paths = [join(root, "PROJECT.yaml"), join(root, "books", "book-01", "BOOK.yaml"), source];
  return { parent, root, hashes: new Map(paths.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])) };
}

function invoke(...args: string[]): string {
  return execFileSync("node", ["--import", "tsx", resolve("scripts/prose-lint.ts"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("the prose-lint CLI renders deterministic Markdown and JSON without mutating its target", () => {
  const { parent, root, hashes } = fixture();
  try {
    const markdown = invoke(root);
    const firstJson = invoke(root, "--format", "json");
    const secondJson = invoke(root, "--format", "json");

    assert.match(markdown, /^# Novel Forge deterministic prose lint/m);
    assert.match(markdown, /mechanics\/doubled-word/);
    assert.deepEqual(JSON.parse(firstJson), JSON.parse(secondJson));
    for (const [path, hash] of hashes) assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("the prose-lint CLI rejects a missing target", () => {
  const result = spawnSync("node", ["--import", "tsx", resolve("scripts/prose-lint.ts"), "/missing/prose-lint-target"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read prose-lint target/);
});

test("the prose-lint CLI rejects unknown flags, formats, and rule prefixes", () => {
  const { parent, root } = fixture();
  try {
    for (const args of [["--unknown"], ["--format", "xml"], ["--rules", "unknown/rule"]]) {
      const result = spawnSync("node", ["--import", "tsx", resolve("scripts/prose-lint.ts"), root, ...args], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Unknown/);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("an injected engine failure prints the partial report and returns a failing status", async () => {
  const { parent, root } = fixture();
  try {
    const { runProseLintCli } = await import("../scripts/prose-lint.js");
    let stdout = "";
    let stderr = "";
    const exitCode = runProseLintCli([root], {
      run: () => ({
        findings: [],
        failures: [{ ruleId: "synthetic/failure", message: "intentional failure" }],
        counts: { mechanical: 0, consistency: 0, repetition: 0, "style-pattern": 0 },
        wordCount: 3,
      }),
      stdout: (value: string) => { stdout += value; },
      stderr: (value: string) => { stderr += value; },
    });

    assert.equal(exitCode, 1);
    assert.match(stdout, /synthetic\/failure/);
    assert.equal(stderr, "");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
