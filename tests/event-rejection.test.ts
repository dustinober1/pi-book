import test from "node:test";
import assert from "node:assert/strict";
import {
  NovelEventRejection,
  canRetryEvent,
  normalizeEventRejection,
  rejectionInstruction,
  type EventRejectionContext,
} from "../src/application/event-rejection.js";

const context: EventRejectionContext = {
  root: "/tmp/novel-forge-secret/project",
  currentStage: "drafting",
  currentProjectHash: "hash-123",
};

function rejection(message: string | Error) {
  return normalizeEventRejection(message, context);
}

test("invalid YAML becomes retryable schema-validation with the exact path", () => {
  const value = rejection(new Error("books/book-01/book-strategy.yaml is not valid YAML: Unexpected scalar"));
  assert.ok(value instanceof NovelEventRejection);
  assert.equal(value.message, "books/book-01/book-strategy.yaml is not valid YAML: Unexpected scalar");
  assert.equal(value.detail.code, "schema-validation");
  assert.equal(value.detail.retryable, true);
  assert.equal(value.detail.requiresReload, false);
  assert.deepEqual(value.detail.invalidPaths, ["books/book-01/book-strategy.yaml"]);
  assert.deepEqual(value.detail.issues, [{ path: "books/book-01/book-strategy.yaml", expected: "valid YAML or schema-conforming data", received: "invalid submitted data" }]);
  assert.equal(value.detail.currentStage, "drafting");
  assert.equal(value.detail.currentProjectHash, "hash-123");
});

test("reference failures are retryable once without requiring reload", () => {
  const value = rejection(new Error("Reference validation blocked chapter-queue:\n- RES-404 is missing from research ledger."));
  assert.equal(value.detail.code, "reference-validation");
  assert.equal(value.detail.retryable, true);
  assert.equal(value.detail.requiresReload, false);
  assert.equal(canRetryEvent(value.detail, 0), true);
  assert.equal(canRetryEvent(value.detail, 1), false);
  assert.match(rejectionInstruction(value.detail, 0), /correct only the rejected payload/i);
  assert.match(rejectionInstruction(value.detail, 0), /once/i);
  assert.match(rejectionInstruction(value.detail, 1), /stop/i);
});

test("stale stage and hash require reload and never permit same-attempt retry", () => {
  const stage = rejection(new Error("Stale event stage: expected drafting, current revision."));
  assert.equal(stage.detail.code, "stale-stage");
  assert.equal(stage.detail.requiresReload, true);
  assert.equal(stage.detail.retryable, false);
  assert.equal(canRetryEvent(stage.detail, 0), false);
  assert.match(rejectionInstruction(stage.detail), /reload canonical state/i);

  const hash = rejection(new Error("Stale project hash; reload state before applying this event."));
  assert.equal(hash.detail.code, "stale-project-hash");
  assert.equal(hash.detail.requiresReload, true);
  assert.equal(hash.detail.retryable, false);
});

test("wrong stages, allowlist violations, gates, integrity, and filesystem errors never auto-retry", () => {
  const cases: Array<[string | Error, string]> = [
    [new Error("research-update is not allowed during complete."), "wrong-stage"],
    [new Error("books/book-01/manuscript/chapters/01.md is not allowed for research-update."), "allowlist-violation"],
    [new Error("Gate book-plan-approval must be approved before drafting."), "human-gate-required"],
    [new Error("Integrity validation blocked the event: broken canon reference."), "integrity-failure"],
    [Object.assign(new Error("ENOENT: no such file or directory, open '/tmp/novel-forge-secret/project/PROJECT.yaml'"), { code: "ENOENT" }), "filesystem-failure"],
  ];
  for (const [error, code] of cases) {
    const value = rejection(error);
    assert.equal(value.detail.code, code);
    assert.equal(value.detail.retryable, false);
    assert.equal(canRetryEvent(value.detail, 0), false);
  }
  const allowlist = rejection(new Error("books/book-01/manuscript/chapters/01.md is not allowed for research-update."));
  assert.deepEqual(allowlist.detail.invalidPaths, ["books/book-01/manuscript/chapters/01.md"]);
  assert.deepEqual(allowlist.detail.issues, [{ path: "books/book-01/manuscript/chapters/01.md", expected: "an allowlisted path for this event", received: "disallowed submitted path" }]);
});

test("schema assertions and duplicate paths classify deterministically", () => {
  const schema = rejection(new Error("book-strategy.yaml schema validation failed: /reader_promise must be string"));
  assert.equal(schema.detail.code, "schema-validation");

  const duplicate = normalizeEventRejection(new Error("Duplicate event path: books/book-01/book-strategy.yaml"), {
    ...context,
    invalidPaths: ["books/book-01/book-strategy.yaml"],
  });
  assert.equal(duplicate.detail.code, "allowlist-violation");
  assert.deepEqual(duplicate.detail.invalidPaths, ["books/book-01/book-strategy.yaml"]);
});

test("unknown failures are sanitized without stacks absolute paths or raw object dumps", () => {
  const error = new Error("Unexpected failure at /tmp/novel-forge-secret/project/books/book-01/file.yaml");
  error.stack = "SECRET STACK /tmp/novel-forge-secret/project/private.ts:1";
  const value = rejection(error);
  assert.equal(value.detail.code, "unknown");
  assert.equal(value.detail.retryable, false);
  assert.doesNotMatch(value.message, /SECRET STACK/);
  assert.doesNotMatch(value.message, /\/tmp\/novel-forge-secret/);
  assert.match(value.message, /<project-root>/);

  const raw = normalizeEventRejection({ secret: "do not expose", path: "C:\\Users\\Writer\\book" }, context);
  assert.equal(raw.detail.code, "unknown");
  assert.equal(raw.message, "Novel Forge rejected the operation for an unknown reason.");
  assert.doesNotMatch(JSON.stringify(raw.detail), /do not expose|Users|Writer/);
});

test("an existing NovelEventRejection remains stable", () => {
  const original = rejection(new Error("Stale project hash; reload state before applying this event."));
  assert.equal(normalizeEventRejection(original, { ...context, currentStage: "revision" }), original);
});
