import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AuthorJourneyEvent } from "../evaluation/author-journey.js";

/**
 * Append-only storage for author-journey traces.
 *
 * The project's author-velocity baseline evaluated four hand-authored YAML
 * fixtures: the evaluator counted events that a person had typed, and the test
 * asserted it reproduced those numbers. That is a schema test for a counter,
 * and "how many author actions does a book cost" is the central question of the
 * whole small-model effort. This is where a real answer comes from.
 *
 * Traces are operational, not canonical: they live under the ignored `.pi-book`
 * tree, never enter a guarded event, and are excluded from the package. Nothing
 * reads them to make a workflow decision.
 *
 * Privacy follows the existing telemetry rule exactly. `AuthorJourneyEvent`
 * carries identifiers, action names, outcomes, gate names, counts and stop
 * reasons — never prompts, prose, source excerpts, model output, reasoning, or
 * credentials — and `assertPrivacySafe` refuses anything that grows a field
 * outside that shape rather than trusting callers to remember.
 */

const JOURNEY_DIRECTORY = join(".pi-book", "journey");
const TRACE_FILE = "trace.jsonl";

export function journeyTracePath(root: string): string {
  return join(root, JOURNEY_DIRECTORY, TRACE_FILE);
}

const ALLOWED_FIELDS: Readonly<Record<AuthorJourneyEvent["type"], readonly string[]>> = Object.freeze({
  "author-question": ["type", "id"],
  "model-prompt": ["type", "id"],
  "guarded-event": ["type", "id", "action", "outcome", "chapter", "retry_of"],
  "writer-approval": ["type", "gate"],
  context: ["type", "characters"],
  "run-state": ["type", "run_id", "state"],
  stop: ["type", "reason"],
});

/**
 * A trace must never become a side channel for content. Any field outside the
 * event's declared shape is refused, so a future event variant cannot quietly
 * start carrying prose.
 */
export function assertPrivacySafe(event: AuthorJourneyEvent): void {
  const allowed = ALLOWED_FIELDS[event.type];
  if (!allowed) throw new Error(`Unknown journey event type: ${String((event as { type?: unknown }).type)}.`);
  const unexpected = Object.keys(event).filter((key) => !allowed.includes(key));
  if (unexpected.length) {
    throw new Error(`Journey event ${event.type} carries fields outside its privacy-safe shape: ${unexpected.join(", ")}.`);
  }
}

export function appendJourneyEvent(root: string, event: AuthorJourneyEvent): void {
  assertPrivacySafe(event);
  const directory = join(root, JOURNEY_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  appendFileSync(join(directory, TRACE_FILE), `${JSON.stringify(event)}\n`, "utf8");
}

export function readJourneyTrace(root: string): AuthorJourneyEvent[] {
  const path = journeyTracePath(root);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuthorJourneyEvent);
}

export function clearJourneyTrace(root: string): void {
  rmSync(join(root, JOURNEY_DIRECTORY), { recursive: true, force: true });
}
