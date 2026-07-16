import test from "node:test";
import assert from "node:assert/strict";
import { parseRunOptions } from "../src/pi/arguments.js";

test("run option parsing rejects unsafe chapter counts and unknown stop targets", () => {
  assert.throws(() => parseRunOptions("--max-chapters 0"), /1.*10/);
  assert.throws(() => parseRunOptions("--max-chapters 11"), /1.*10/);
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
