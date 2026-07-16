import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerNovelForge } from "../src/pi/extension.js";

const html = readFileSync(join(process.cwd(), "wizard", "index.html"), "utf8");
const app = readFileSync(join(process.cwd(), "wizard", "app.js"), "utf8");

test("wizard exposes a premise workflow with comparison and explicit selection", () => {
  assert.match(html, /data-workflow="premise"/);
  assert.match(app, /Premise Laboratory/);
  assert.match(app, /Raw author idea/);
  assert.match(app, /Seed elements/);
  assert.match(app, /Preview comparison/);
  assert.match(app, /Select variant/);
  assert.match(app, /writer decision/i);
  assert.doesNotMatch(app, /highest score|automatic winner|model recommendation/i);
});

test("premise browser uses existing local API routes and no scoring or remote assets", () => {
  const routes = [...app.matchAll(/api\("([^\"]+)"/g)].map((match) => match[1] ?? "");
  assert.ok(routes.every((route) => ["/api/snapshot", "/api/preview", "/api/apply", "/api/upload", "/api/close", "/api/session"].includes(route)));
  assert.doesNotMatch(html + app, /https?:\/\//i);
  assert.doesNotMatch(app, /premise-score|winner_id|recommended_variant|rank_variant/i);
});

test("novel-wizard command offers premise without removing existing workflows", () => {
  const commands = new Map<string, any>();
  registerNovelForge({
    registerCommand(name: string, definition: any) { commands.set(name, definition); },
    registerTool() {},
    sendUserMessage() {},
  } as never);
  const wizard = commands.get("novel-wizard");
  const values = wizard.getArgumentCompletions("").map((item: { value: string }) => item.value);
  assert.deepEqual(values, ["adoption", "readers", "packaging", "next-book", "research", "premise"]);
  assert.match(wizard.description, /premise/i);
});
