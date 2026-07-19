import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyNovelEvent, projectStateHash } from "../src/application/events.js";
import { gateEvidencePaths } from "../src/application/gate-metadata.js";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";

test("manuscript review compiles every chapter into one file before requesting approval", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-manuscript-approval-"));
  try {
    const root = initializeProject(parent, {
      projectName: "Complete Manuscript",
      projectType: "standalone",
      profile: "thriller",
    });
    const project = readProject(root);
    project.current_stage = "manuscript-review";
    project.next_gate = null;
    writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
    writeFileSync(join(root, "books/book-01/manuscript/chapters/01-opening.md"), "# Opening\n\nFirst chapter marker.\n", "utf8");
    writeFileSync(join(root, "books/book-01/manuscript/chapters/02-ending.md"), "# Ending\n\nFinal chapter marker.\n", "utf8");

    applyNovelEvent(root, {
      eventType: "review",
      expectedStage: "manuscript-review",
      expectedProjectHash: projectStateHash(root),
      scope: "manuscript",
      files: [
        { path: "books/book-01/review-report.md", content: "# Review Report\n\nNo blockers.\n" },
        { path: "books/book-01/revision-tickets.yaml", content: stringifyYaml({ schema_version: "1.0.0", tickets: [] }) },
      ],
    });

    const compiledPath = join(root, "delivery/manuscript.md");
    assert.equal(existsSync(compiledPath), true);
    const compiled = readFileSync(compiledPath, "utf8");
    assert.match(compiled, /First chapter marker/);
    assert.match(compiled, /Final chapter marker/);
    assert.ok(compiled.indexOf("First chapter marker") < compiled.indexOf("Final chapter marker"));

    const reviewed = readProject(root);
    assert.equal(reviewed.next_gate, "manuscript-approval");
    assert.ok(gateEvidencePaths(reviewed, "manuscript-approval").includes("delivery/manuscript.md"));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
