import test from "node:test";
import assert from "node:assert/strict";
import { allowedPath, type NovelEventType } from "../src/application/events.js";
import { PROFILE_IDS } from "../src/domain/schemas.js";
import { bookTemplateFiles } from "../src/project/templates.js";

const EVENT_TYPES: readonly NovelEventType[] = [
  "voice-profile", "series-plan", "book-plan", "chapter-queue", "draft-chapter", "review", "reader-test",
  "research-update", "intake-update", "premise-update", "plan-change", "revise", "canon-lock", "package",
];

// Every path here is created by bookTemplateFiles but is never submitted
// through novel_apply_event's NovelEventType system — each is reachable
// through its own dedicated guarded mechanism instead, verified below.
// A path landing here without one of those reasons is exactly the defect
// this test exists to catch: thriller-evidence.yaml sat here, undocumented,
// until an event was actually wired for it.
const READ_ONLY_BY_DESIGN: Record<string, string> = {
  "books/book-01/BOOK.yaml": "populated automatically by every state-changing event, never submitted by a caller (src/application/events.ts)",
  "books/book-01/publishing.yaml": "written only by the packaging wizard's guarded apply handler (src/application/packaging/wizard.ts)",
  "books/book-01/marketing.yaml": "written only by the packaging wizard's guarded apply handler (src/application/packaging/wizard.ts)",
  "books/book-01/reader-kits/index.yaml": "written only by the reader-kit builder's guarded event (src/application/readers/kit.ts)",
};

test("every book-scoped template file is writable through some guarded event, or is a documented exception", () => {
  for (const profile of PROFILE_IDS) {
    const files = bookTemplateFiles("book-01", 1, profile);
    for (const path of Object.keys(files)) {
      if (path in READ_ONLY_BY_DESIGN) continue;
      const writableBy = EVENT_TYPES.filter((event) => allowedPath(event, path, "book-01", profile));
      assert.ok(
        writableBy.length > 0,
        `${path} (profile: ${profile}) is created by bookTemplateFiles but no event can write it. `
          + "Either wire an event allowlist entry for it, or add it to READ_ONLY_BY_DESIGN with the reason.",
      );
    }
  }
});

test("the documented exceptions are still genuinely unreachable through the event system", () => {
  // If one of these ever becomes event-writable (by design, on purpose), it
  // should move out of the exception list, not linger in both places.
  for (const path of Object.keys(READ_ONLY_BY_DESIGN)) {
    for (const profile of PROFILE_IDS) {
      const writableBy = EVENT_TYPES.filter((event) => allowedPath(event, path, "book-01", profile));
      assert.deepEqual(writableBy, [], `${path} is listed as read-only-by-design but is actually writable via: ${writableBy.join(", ")}`);
    }
  }
});
