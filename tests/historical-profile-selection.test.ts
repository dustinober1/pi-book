import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PROFILE_IDS, isProfileId } from "../src/domain/schemas.js";
import { registerNovelForge } from "../src/pi/extension.js";
import { initializeProject } from "../src/project/store.js";
import { bookTemplateFiles } from "../src/project/templates.js";

function temp(): string {
  return mkdtempSync(join(tmpdir(), "novel-forge-historical-profile-"));
}

test("canonical profile selection includes historical fiction", () => {
  assert.deepEqual(PROFILE_IDS, ["thriller", "romantasy", "historical-fiction"]);
  assert.equal(isProfileId("historical-fiction"), true);
  assert.equal(isProfileId("historical"), false);
});

test("historical projects alone receive historical evidence artifacts", () => {
  const parent = temp();
  try {
    const historical = initializeProject(parent, {
      projectName: "A Republic of Smoke",
      projectType: "standalone",
      profile: "historical-fiction",
    });
    assert.equal(existsSync(join(historical, "books/book-01/historical-context.yaml")), true);
    assert.equal(existsSync(join(historical, "books/book-01/invention-ledger.yaml")), true);

    for (const profile of ["thriller", "romantasy"] as const) {
      const files = bookTemplateFiles("book-02", 2, profile);
      assert.equal(`books/book-02/historical-context.yaml` in files, false);
      assert.equal(`books/book-02/invention-ledger.yaml` in files, false);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("novel-start accepts historical fiction and the next-book wizard offers it", async () => {
  const parent = temp();
  try {
    const commands = new Map<string, any>();
    const pi = {
      registerCommand(name: string, definition: any) { commands.set(name, definition); },
      registerTool() {},
      sendUserMessage() {},
    };
    registerNovelForge(pi as never);
    const context = {
      cwd: parent,
      hasUI: true,
      ui: {
        input: async () => "100000",
        select: async () => undefined,
        confirm: async () => true,
        editor: async () => undefined,
        notify() {},
      },
      isIdle: () => true,
    };
    await commands.get("novel-start").handler('"A Republic of Smoke" historical-fiction standalone', context);
    assert.equal(existsSync(join(parent, "a-republic-of-smoke", "books/book-01/historical-context.yaml")), true);

    const wizard = readFileSync(resolve("wizard/app.js"), "utf8");
    assert.match(wizard, /<option[^>]*>historical-fiction<\/option>/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
