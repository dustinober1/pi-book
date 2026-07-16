import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const html = readFileSync(join(root, "wizard", "index.html"), "utf8");
const app = readFileSync(join(root, "wizard", "app.js"), "utf8");

test("wizard exposes a guided research workflow with five evidence surfaces", () => {
  assert.match(html, /data-workflow="research"/);
  assert.match(app, /Influence Palette/);
  assert.match(app, /Anonymous Voice Comparison/);
  assert.match(app, /Reader Friction/);
  assert.match(app, /Research Ledger/);
  assert.match(app, /Revision Learning/);
  assert.match(app, /public market evidence/i);
  assert.match(app, /real manuscript reader evidence/i);
});

test("research browser remains local and uses only approved API routes", () => {
  const routes = [...app.matchAll(/api\("([^\"]+)"/g)].map((match) => match[1] ?? "");
  assert.ok(routes.every((route) => ["/api/snapshot", "/api/preview", "/api/apply", "/api/upload", "/api/close", "/api/session"].includes(route)));
  assert.doesNotMatch(html + app, /https?:\/\//i);
  assert.equal(app.includes("eval("), false);
  assert.equal(app.includes("new Function"), false);
  assert.equal(app.includes("createElement(\"script\")"), false);
  assert.equal(app.includes("child_process"), false);
  assert.equal(app.includes("node:fs"), false);
  assert.equal(app.includes('require("fs")'), false);
  assert.equal(app.includes("require('fs')"), false);
});

test("voice comparison labels variants only as A B and C", () => {
  assert.match(app, /variant\.id/);
  assert.doesNotMatch(app, /Author A|Author B|Author C|in the style of/i);
});
