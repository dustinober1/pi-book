import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

export interface AuthorJourneyMetrics {
  authorQuestions: number;
  modelPrompts: number;
  guardedEvents: number;
  rejectedEvents: number;
  retries: number;
  writerApprovals: number;
  chaptersCompleted: number;
  contextCharacters: number;
  stopReason: string;
}

export type AuthorJourneyEvent =
  | { type: "author-question"; id: string }
  | { type: "model-prompt"; id: string }
  | {
      type: "guarded-event";
      id: string;
      action: string;
      outcome: "accepted" | "rejected";
      chapter?: number;
      retry_of?: string;
    }
  | { type: "writer-approval"; gate: string }
  | { type: "context"; characters: number }
  | { type: "run-state"; run_id: string; state: "started" | "paused" | "resumed" | "completed" }
  | { type: "stop"; reason: string };

export interface AuthorJourneyTrace {
  events: AuthorJourneyEvent[];
}

export interface AuthorJourneyFixture {
  schema_version: "1.0.0";
  id: string;
  description: string;
  limitations: string[];
  trace: AuthorJourneyTrace;
  expected: AuthorJourneyMetrics;
  limits: {
    max_author_questions: number;
    max_model_prompts: number;
    max_rejected_events: number;
    max_retries: number;
  };
}

export interface AuthorJourneyEvaluation {
  id: string;
  metrics: AuthorJourneyMetrics;
  passed: boolean;
  failures: string[];
  limitations: string[];
}

type RunState = "started" | "paused" | "resumed" | "completed";
type MetricKey = keyof AuthorJourneyMetrics;

const METRIC_KEYS: readonly MetricKey[] = [
  "authorQuestions",
  "modelPrompts",
  "guardedEvents",
  "rejectedEvents",
  "retries",
  "writerApprovals",
  "chaptersCompleted",
  "contextCharacters",
  "stopReason",
];

function nonBlank(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonblank string.`);
  return value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return Number(value);
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}

function assertUniqueId(id: string, seen: Set<string>): void {
  if (seen.has(id)) throw new Error(`Duplicate journey event id ${id}.`);
  seen.add(id);
}

function validateRunTransition(runId: string, next: RunState, current: RunState | undefined): void {
  if (next === "started") {
    if (current !== undefined) throw new Error(`Run ${runId} cannot start after ${current}.`);
    return;
  }
  if (next === "paused") {
    if (current !== "started" && current !== "resumed") throw new Error(`Run ${runId} may pause only after started or resumed.`);
    return;
  }
  if (next === "resumed") {
    if (current !== "paused") throw new Error(`Run ${runId} may resume only after paused.`);
    return;
  }
  if (current !== "started" && current !== "resumed") throw new Error(`Run ${runId} may complete only after started or resumed.`);
}

function emptyMetrics(): AuthorJourneyMetrics {
  return {
    authorQuestions: 0,
    modelPrompts: 0,
    guardedEvents: 0,
    rejectedEvents: 0,
    retries: 0,
    writerApprovals: 0,
    chaptersCompleted: 0,
    contextCharacters: 0,
    stopReason: "unknown",
  };
}

export function evaluateAuthorJourney(
  _fixture: AuthorJourneyFixture,
  trace: AuthorJourneyTrace,
): AuthorJourneyMetrics {
  if (!trace || !Array.isArray(trace.events)) throw new Error("Author journey trace must contain an events list.");

  const metrics = emptyMetrics();
  const eventIds = new Set<string>();
  const guardedIds = new Set<string>();
  const completedChapters = new Set<number>();
  const runStates = new Map<string, RunState>();

  for (const [index, event] of trace.events.entries()) {
    if (!event || typeof event !== "object") throw new Error(`Journey event ${index + 1} must be an object.`);

    if (event.type === "author-question") {
      const id = nonBlank(event.id, `Journey event ${index + 1} id`);
      assertUniqueId(id, eventIds);
      metrics.authorQuestions += 1;
      continue;
    }

    if (event.type === "model-prompt") {
      const id = nonBlank(event.id, `Journey event ${index + 1} id`);
      assertUniqueId(id, eventIds);
      metrics.modelPrompts += 1;
      continue;
    }

    if (event.type === "guarded-event") {
      const id = nonBlank(event.id, `Journey event ${index + 1} id`);
      assertUniqueId(id, eventIds);
      nonBlank(event.action, `Guarded event ${id} action`);
      if (event.outcome !== "accepted" && event.outcome !== "rejected") {
        throw new Error(`Guarded event ${id} outcome must be accepted or rejected.`);
      }
      if (event.retry_of !== undefined) {
        const retryOf = nonBlank(event.retry_of, `Guarded event ${id} retry_of`);
        if (!guardedIds.has(retryOf)) throw new Error(`Guarded event ${id} retries unknown earlier event ${retryOf}.`);
        metrics.retries += 1;
      }
      metrics.guardedEvents += 1;
      if (event.outcome === "rejected") metrics.rejectedEvents += 1;
      if (event.action === "draft-chapter" && event.outcome === "accepted") {
        completedChapters.add(positiveInteger(event.chapter, `Accepted draft event ${id} chapter`));
      } else if (event.chapter !== undefined) {
        positiveInteger(event.chapter, `Guarded event ${id} chapter`);
      }
      guardedIds.add(id);
      continue;
    }

    if (event.type === "writer-approval") {
      nonBlank(event.gate, `Writer approval ${index + 1} gate`);
      metrics.writerApprovals += 1;
      continue;
    }

    if (event.type === "context") {
      const characters = nonNegativeInteger(event.characters, `Context event ${index + 1} characters`);
      metrics.contextCharacters = Math.max(metrics.contextCharacters, characters);
      continue;
    }

    if (event.type === "run-state") {
      const runId = nonBlank(event.run_id, `Run-state event ${index + 1} run_id`);
      if (!["started", "paused", "resumed", "completed"].includes(event.state)) {
        throw new Error(`Run ${runId} has unsupported state ${String(event.state)}.`);
      }
      validateRunTransition(runId, event.state, runStates.get(runId));
      runStates.set(runId, event.state);
      continue;
    }

    if (event.type === "stop") {
      metrics.stopReason = nonBlank(event.reason, `Stop event ${index + 1} reason`);
      continue;
    }

    throw new Error(`Journey event ${index + 1} has unsupported type ${String((event as { type?: unknown }).type)}.`);
  }

  metrics.chaptersCompleted = completedChapters.size;
  return metrics;
}

function metricMismatch(
  key: MetricKey,
  actual: AuthorJourneyMetrics,
  expected: AuthorJourneyMetrics,
): string | null {
  if (actual[key] === expected[key]) return null;
  return `${key} expected ${JSON.stringify(expected[key])} but received ${JSON.stringify(actual[key])}.`;
}

function validateFixtureMetadata(fixture: AuthorJourneyFixture): void {
  if (!fixture || typeof fixture !== "object") throw new Error("Author journey fixture must be an object.");
  if (fixture.schema_version !== "1.0.0") throw new Error(`${fixture.id || "Journey fixture"} requires schema_version 1.0.0.`);
  nonBlank(fixture.id, "Journey fixture id");
  nonBlank(fixture.description, `${fixture.id} description`);
  if (!Array.isArray(fixture.limitations) || !fixture.limitations.length) throw new Error(`${fixture.id} requires at least one current limitation.`);
  for (const [index, limitation] of fixture.limitations.entries()) nonBlank(limitation, `${fixture.id} limitation ${index + 1}`);
  if (!fixture.expected || typeof fixture.expected !== "object") throw new Error(`${fixture.id} expected metrics are required.`);
  for (const key of METRIC_KEYS) {
    if (!(key in fixture.expected)) throw new Error(`${fixture.id} expected metrics are missing ${key}.`);
    if (key === "stopReason") nonBlank(fixture.expected[key], `${fixture.id} expected stopReason`);
    else nonNegativeInteger(fixture.expected[key], `${fixture.id} expected ${key}`);
  }
  if (!fixture.limits || typeof fixture.limits !== "object") throw new Error(`${fixture.id} limits are required.`);
  nonNegativeInteger(fixture.limits.max_author_questions, `${fixture.id} max_author_questions`);
  nonNegativeInteger(fixture.limits.max_model_prompts, `${fixture.id} max_model_prompts`);
  nonNegativeInteger(fixture.limits.max_rejected_events, `${fixture.id} max_rejected_events`);
  nonNegativeInteger(fixture.limits.max_retries, `${fixture.id} max_retries`);
}

export function evaluateAuthorJourneyFixture(fixture: AuthorJourneyFixture): AuthorJourneyEvaluation {
  validateFixtureMetadata(fixture);
  const metrics = evaluateAuthorJourney(fixture, fixture.trace);
  const failures = METRIC_KEYS
    .map((key) => metricMismatch(key, metrics, fixture.expected))
    .filter((message): message is string => message !== null);

  const limits: Array<[keyof AuthorJourneyFixture["limits"], number]> = [
    ["max_author_questions", metrics.authorQuestions],
    ["max_model_prompts", metrics.modelPrompts],
    ["max_rejected_events", metrics.rejectedEvents],
    ["max_retries", metrics.retries],
  ];
  for (const [name, actual] of limits) {
    const maximum = fixture.limits[name];
    if (actual > maximum) failures.push(`${name} allows at most ${maximum} but received ${actual}.`);
  }

  return {
    id: fixture.id,
    metrics,
    passed: failures.length === 0,
    failures,
    limitations: [...fixture.limitations],
  };
}

export function loadAuthorJourneyFixtures(root: string): AuthorJourneyFixture[] {
  return readdirSync(root)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => YAML.parse(readFileSync(join(root, name), "utf8")) as AuthorJourneyFixture);
}
