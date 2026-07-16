export type EventRejectionCode =
  | "schema-validation"
  | "reference-validation"
  | "wrong-stage"
  | "stale-stage"
  | "stale-project-hash"
  | "allowlist-violation"
  | "human-gate-required"
  | "integrity-failure"
  | "filesystem-failure"
  | "unknown";

export interface EventRejectionIssue {
  path: string;
  expected: string;
  received: string;
}

export interface EventRejectionDetail {
  code: EventRejectionCode;
  message: string;
  retryable: boolean;
  requiresReload: boolean;
  invalidPaths: string[];
  issues: EventRejectionIssue[];
  currentStage: string;
  currentProjectHash: string;
}

export interface EventRejectionContext {
  root?: string;
  currentStage: string;
  currentProjectHash: string;
  invalidPaths?: string[];
}

export class NovelEventRejection extends Error {
  readonly detail: EventRejectionDetail;

  constructor(detail: EventRejectionDetail) {
    super(detail.message);
    this.name = "NovelEventRejection";
    this.detail = detail;
  }
}

interface Policy {
  retryable: boolean;
  requiresReload: boolean;
}

const FILESYSTEM_CODES = new Set(["ENOENT", "EACCES", "EPERM", "ENOSPC", "EROFS", "EMFILE", "ENFILE", "EIO"]);

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "Novel Forge rejected the operation for an unknown reason.";
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Novel Forge rejected the operation for an unknown reason.";
}

function redactAbsolutePaths(message: string, root?: string): string {
  let safe = message;
  if (root) {
    const variants = new Set([root, root.replace(/\\/g, "/"), root.replace(/\//g, "\\")]);
    for (const variant of variants) if (variant) safe = safe.split(variant).join("<project-root>");
  }
  safe = safe.replace(/\b[A-Za-z]:\\(?:[^\\\s'"<>]+\\)*[^\\\s'"<>]+/g, "<absolute-path>");
  safe = safe.replace(/\/(?:tmp|home|Users|var|private|mnt|workspace|root)(?:\/[^\s'"<>:]+)+/g, "<absolute-path>");
  return safe.replace(/\s+/g, " ").trim();
}

function normalizedPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function messagePaths(message: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /(?:^|[\s:(])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+)(?=\s+is not valid YAML|\s+is not allowed|\s|:|$)/g,
    /Duplicate event path:\s*((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of message.matchAll(pattern)) {
      const candidate = match[1];
      if (candidate) values.add(normalizedPath(candidate));
    }
  }
  return [...values];
}

function filesystemFailure(error: unknown, lower: string): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "").toUpperCase();
    if (FILESYSTEM_CODES.has(code)) return true;
  }
  return [...FILESYSTEM_CODES].some((code) => lower.includes(code.toLowerCase()));
}

function classify(error: unknown, message: string): EventRejectionCode {
  const lower = message.toLowerCase();
  if (lower.includes("stale project hash") || lower.includes("stale wizard project hash")) return "stale-project-hash";
  if (lower.includes("stale event stage") || lower.includes("stale wizard stage")) return "stale-stage";
  if (lower.includes(" is not allowed during ") || lower.includes("wrong stage")) return "wrong-stage";
  if (lower.includes(" is not allowed for ") || lower.includes("duplicate event path")) return "allowlist-violation";
  if (lower.includes("not valid yaml") || lower.includes("schema validation") || lower.includes("schema-validation") || lower.includes("does not match schema")) return "schema-validation";
  if (lower.includes("reference validation") || lower.includes("missing canon reference") || lower.includes("missing research reference") || lower.includes("reference is missing")) return "reference-validation";
  if ((lower.includes("gate") || lower.includes("approval")) && (lower.includes("must be") || lower.includes("requires") || lower.includes("human"))) return "human-gate-required";
  if (lower.includes("integrity")) return "integrity-failure";
  if (filesystemFailure(error, lower)) return "filesystem-failure";
  return "unknown";
}

function policy(code: EventRejectionCode): Policy {
  if (code === "schema-validation" || code === "reference-validation") return { retryable: true, requiresReload: false };
  if (code === "stale-stage" || code === "stale-project-hash") return { retryable: false, requiresReload: true };
  return { retryable: false, requiresReload: false };
}

function issueFor(code: EventRejectionCode, path: string): EventRejectionIssue {
  if (code === "schema-validation") {
    return { path, expected: "valid YAML or schema-conforming data", received: "invalid submitted data" };
  }
  if (code === "allowlist-violation") {
    return { path, expected: "an allowlisted path for this event", received: "disallowed submitted path" };
  }
  if (code === "reference-validation") {
    return { path, expected: "an existing allowed canon, thread, source, or research reference", received: "missing or invalid reference" };
  }
  return { path, expected: "a valid event input", received: "rejected input" };
}

export function normalizeEventRejection(error: unknown, context: EventRejectionContext): NovelEventRejection {
  if (error instanceof NovelEventRejection) return error;
  const original = rawMessage(error);
  const message = redactAbsolutePaths(original, context.root);
  const code = classify(error, message);
  const rule = policy(code);
  const invalidPaths = [...new Set([...(context.invalidPaths ?? []).map(normalizedPath), ...messagePaths(message)])]
    .filter(Boolean)
    .sort();
  return new NovelEventRejection({
    code,
    message,
    retryable: rule.retryable,
    requiresReload: rule.requiresReload,
    invalidPaths,
    issues: invalidPaths.map((path) => issueFor(code, path)),
    currentStage: context.currentStage || "unknown",
    currentProjectHash: context.currentProjectHash || "unknown",
  });
}

export function canRetryEvent(detail: EventRejectionDetail, previousRetries: number): boolean {
  return detail.retryable && Number.isInteger(previousRetries) && previousRetries === 0;
}

export function rejectionInstruction(detail: EventRejectionDetail, previousRetries = 0): string {
  if (canRetryEvent(detail, previousRetries)) {
    return "Correct only the rejected payload and resubmit once. Do not change accepted project state or unrelated files.";
  }
  if (detail.retryable) {
    return "Stop: the one permitted corrected retry has been used. Surface the blocker for review.";
  }
  if (detail.requiresReload) {
    return "Reload canonical state and rebuild the proposal from the returned current stage and project hash.";
  }
  return "Stop automatic work and surface this rejection. Do not retry or bypass the validation boundary.";
}
