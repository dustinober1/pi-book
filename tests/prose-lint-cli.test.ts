import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { initializeProject } from "../src/project/store.js";
import { normalizeDocument, runProseLint, type LintRule } from "../src/application/prose-lint/index.js";

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
    assert.equal(firstJson, secondJson);
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

test("rule prefixes select and validate rule objects before loading and unselected rules never run", async () => {
  const { runProseLintCli } = await import("../scripts/prose-lint.js");
  let selectedRuns = 0;
  let unselectedRuns = 0;
  let loads = 0;
  const selected: LintRule = {
    id: "mechanics/selected",
    version: "1.0.0",
    run() { selectedRuns += 1; return []; },
  };
  const unselected: LintRule = {
    id: "consistency/unselected",
    version: "1.0.0",
    run() { unselectedRuns += 1; return []; },
  };
  const output: string[] = [];
  const status = runProseLintCli(["fixture", "--rules", "mechanics/"], {
    rules: [selected, unselected],
    load: (_target, options) => {
      loads += 1;
      assert.ok(options);
      assert.deepEqual(options.rules, [selected]);
      return {
        documents: [normalizeDocument("01.md", "Clean prose.", 1)],
        rules: options.rules,
      };
    },
    run: runProseLint,
    stdout: (value) => { output.push(value); },
  });

  assert.equal(status, 0);
  assert.equal(loads, 1);
  assert.equal(selectedRuns, 1);
  assert.equal(unselectedRuns, 0);
  assert.match(output.join(""), /Findings: 0/);

  const invalidStatus = runProseLintCli(["fixture", "--rules", "missing/"], {
    rules: [selected, unselected],
    load: () => { loads += 1; throw new Error("loader must not run"); },
    stderr: () => {},
  });
  assert.equal(invalidStatus, 1);
  assert.equal(loads, 1);
});

test("manuscript and tied finding order is byte-stable across ambient locales with code-point tiebreaks", () => {
  const root = mkdtempSync(join(tmpdir(), "novel-forge-prose-locale-"));
  try {
    for (const name of ["a.md", "á.md", "ä.md", "z.md"]) writeFileSync(join(root, name), "The the lantern failed.\n", "utf8");
    const run = (locale: string) => execFileSync("node", [
      "--import", "tsx", resolve("scripts/prose-lint.ts"), root, "--rules", "mechanics/", "--format", "json",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, LANG: locale, LC_ALL: locale },
    });

    const english = run("en_US.UTF-8");
    const swedish = run("sv_SE.UTF-8");
    assert.equal(swedish, english);
    assert.deepEqual(JSON.parse(english).findings.map((finding: { location: { path: string } }) => finding.location.path), [
      "a.md", "á.md", "ä.md", "z.md",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
