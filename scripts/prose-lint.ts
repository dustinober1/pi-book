import { fileURLToPath } from "node:url";
import {
  defaultProseLintRules,
  createNgramRule,
  loadProseLintInput,
  renderProseLintJson,
  renderProseLintMarkdown,
  runProseLint,
  type LintRule,
  type LegacyReportKind,
} from "../src/application/prose-lint/index.js";

type Format = "markdown" | "json";

interface CliOptions {
  target: string;
  format: Format;
  rulePrefixes: string[];
  title?: string;
  legacyReport?: LegacyReportKind;
  ngramMinimumCount?: number;
}

interface CliDependencies {
  load?: typeof loadProseLintInput;
  run?: typeof runProseLint;
  stdout?: (value: string) => void;
  stderr?: (value: string) => void;
  cwd?: () => string;
  allowTitle?: boolean;
  rules?: readonly LintRule[];
}

function parse(args: readonly string[], cwd: string, allowTitle: boolean): CliOptions {
  let target: string | undefined;
  let format: Format = "markdown";
  let rulePrefixes: string[] = [];
  let title: string | undefined;
  let legacyReport: LegacyReportKind | undefined;
  let ngramMinimumCount: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index] as string;
    if (value === "--format" || value === "--rules" || value === "--title" || value === "--legacy-report" || value === "--ngram-min-count") {
      const next = args[index + 1];
      if (next === undefined || next.startsWith("--")) throw new Error(`Missing value for ${value}.`);
      index += 1;
      if (value === "--format") {
        if (next !== "markdown" && next !== "json") throw new Error(`Unknown format: ${next}.`);
        format = next;
      } else if (value === "--rules") {
        rulePrefixes = next.split(",").map((prefix) => prefix.trim()).filter(Boolean);
        if (rulePrefixes.length === 0) throw new Error("Missing rule prefix list.");
      } else if (value === "--title") {
        if (!allowTitle) throw new Error("--title is reserved for legacy scanner forwarding.");
        title = next;
      } else if (value === "--legacy-report") {
        if (!allowTitle) throw new Error("--legacy-report is reserved for legacy scanner forwarding.");
        const values: readonly LegacyReportKind[] = ["ngram", "rhetoric", "continuity", "integrity", "structure", "spelling", "temporal", "mechanics"];
        if (!values.includes(next as LegacyReportKind)) throw new Error(`Unknown legacy report: ${next}.`);
        legacyReport = next as LegacyReportKind;
      } else {
        if (!allowTitle) throw new Error("--ngram-min-count is reserved for legacy scanner forwarding.");
        const parsed = Number(next);
        if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid n-gram minimum count: ${next}.`);
        ngramMinimumCount = parsed;
      }
      continue;
    }
    if (value.startsWith("--")) throw new Error(`Unknown option: ${value}.`);
    if (target !== undefined) throw new Error(`Unexpected target: ${value}.`);
    target = value;
  }

  return {
    target: target ?? cwd,
    format,
    rulePrefixes,
    ...(title === undefined ? {} : { title }),
    ...(legacyReport === undefined ? {} : { legacyReport }),
    ...(ngramMinimumCount === undefined ? {} : { ngramMinimumCount }),
  };
}

function selectRules(rules: readonly LintRule[], prefixes: readonly string[]): readonly LintRule[] {
  if (prefixes.length === 0) return rules;
  for (const prefix of prefixes) {
    if (!rules.some((rule) => rule.id.startsWith(prefix))) throw new Error(`Unknown rule prefix: ${prefix}.`);
  }
  return rules.filter((rule) => prefixes.some((prefix) => rule.id.startsWith(prefix)));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runProseLintCli(args: readonly string[] = process.argv.slice(2), dependencies: CliDependencies = {}): number {
  const stdout = dependencies.stdout ?? ((value) => process.stdout.write(value));
  const stderr = dependencies.stderr ?? ((value) => process.stderr.write(value));
  try {
    const options = parse(args, (dependencies.cwd ?? (() => process.cwd()))(), dependencies.allowTitle ?? process.env.NOVEL_FORGE_PROSE_LINT_FORWARDER === "1");
    const ngramMinimumCount = options.ngramMinimumCount;
    const availableRules = ngramMinimumCount === undefined
      ? dependencies.rules ?? defaultProseLintRules
      : (dependencies.rules ?? defaultProseLintRules).map((rule) => rule.id === "repetition/ngram"
        ? createNgramRule({ minimumCount: ngramMinimumCount })
        : rule);
    const rules = selectRules(availableRules, options.rulePrefixes);
    const input = (dependencies.load ?? loadProseLintInput)(options.target, { rules });
    const result = (dependencies.run ?? runProseLint)(input);
    stdout(options.format === "json"
      ? renderProseLintJson(result)
      : renderProseLintMarkdown(result, {
        rulePrefixes: options.rulePrefixes,
        documentCount: input.documents.length,
        ...(options.title === undefined ? {} : { title: options.title }),
        ...(options.legacyReport === undefined ? {} : { legacyReport: options.legacyReport }),
      }));
    return result.failures.length === 0 ? 0 : 1;
  } catch (error) {
    stderr(`${message(error)}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = runProseLintCli();
