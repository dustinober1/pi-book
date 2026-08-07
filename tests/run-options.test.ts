import test from "node:test";
import assert from "node:assert/strict";
import { parseRunOptions } from "../src/pi/arguments.js";

test("run option parsing rejects unsafe chapter counts and unknown stop targets", () => {
  assert.throws(() => parseRunOptions("--max-chapters 0"), /1 to 200/);
  assert.throws(() => parseRunOptions("--max-chapters 201"), /1 to 200/);
  // A book-scale request is now legal: the run stops on gates, blockers and
  // budgets rather than on a counter the writer cannot see.
  assert.equal(parseRunOptions("--max-chapters 40").maxChapters, 40);
  assert.throws(() => parseRunOptions("--until whatever"), /unknown.*until/i);
  assert.deepEqual(parseRunOptions("--max-chapters 3 --until midpoint-review --no-prose"), {
    maxChapters: 3,
    until: "midpoint-review",
    resume: false,
    pause: false,
    cancel: false,
    noProse: true,
    reviewOnly: false,
    stopOnWarning: false,
  });
});

test("run option parsing accepts only known runtime profiles", () => {
  assert.deepEqual(parseRunOptions("--runtime-profile tiny-local"), {
    runtimeProfile: "tiny-local",
    resume: false,
    pause: false,
    cancel: false,
    noProse: false,
    reviewOnly: false,
    stopOnWarning: false,
  });
  assert.throws(() => parseRunOptions("--runtime-profile small"), /Unknown runtime profile: small/);
  assert.throws(() => parseRunOptions("--resume --runtime-profile local"), /cannot be combined|run-control/i);
});
