import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGuideScreen } from "../src/application/guide.js";
import { initializeProject } from "../src/project/store.js";

test("guided workflow offers research without replacing the primary stage action", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-research-guide-"));
  try {
    const root = initializeProject(parent, { projectName: "Research Guide", projectType: "standalone", profile: "thriller" });
    const screen = buildGuideScreen(root);
    const research = screen.actions.find((action) => action.id === "research");
    assert.ok(research);
    assert.equal(research.kind, "secondary");
    assert.notEqual(screen.actions[0]?.id, "research");
    assert.equal(screen.actions[0]?.kind, "primary");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
