import { fileURLToPath } from "node:url";
import {
  defaultProseLintRules,
  loadProseLintInput,
  renderProseLintJson,
  renderProseLintMarkdown,
  runProseLint,
  type LintClass,
  type ProseLintResult,
} from "../src/application/prose-lint/index.js";

type Format = "markdown" | "json";

interface CliOptions {
  target: string;
  format: Format;
  rulePrefixes: string[];
  title?: string;
}

interface CliDependencies {
  load?: typeof loadProseLintInput;
  run?: typeof runProseLint;
  stdout?: (value: string) => void;
  stderr?: (value: string) => void;
  cwd?: () => string;
  allowTitle?: boolean;
}

function parse(args: readonly string[], cwd: string, allowTitle: boolean): CliOptions {
  let target: string | undefined;
  let format: Format = "markdown";
  let rulePrefixes: string[] = [];
  let title: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index] as string;
    if (value === "--format" || value === "--rules" || value === "--title") {
      const next = args[index + 1];
      if (next === undefined || next.startsWith("--")) throw new Error(`Missing value for ${value}.`);
      index += 1;
      if (value === "--format") {
        if (next !== "markdown" && next !== "json") throw new Error(`Unknown format: ${next}.`);
        format = next;
      } else if (value === "--rules") {
        rulePrefixes = next.split(",").map((prefix) => prefix.trim()).filter(Boolean);
        if (rulePrefixes.length === 0) throw new Error("Missing rule prefix list.");
      } else {
        if (!allowTitle) throw new Error("--title is reserved for legacy scanner forwarding.");
        title = next;
      }
      continue;
    }
    if (value.startsWith("--")) throw new Error(`Unknown option: ${value}.`);
    if (target !== undefined) throw new Error(`Unexpected target: ${value}.`);
    target = value;
  }

  for (const prefix of rulePrefixes) {
    if (!defaultProseLintRules.some((rule) => rule.id.startsWith(prefix))) throw new Error(`Unknown rule prefix: ${prefix}.`);
  }

  return { target: target ?? cwd, format, rulePrefixes, ...(title === undefined ? {} : { title }) };
}

function filtered(result: ProseLintResult, rulePrefixes: readonly string[]): ProseLintResult {
  if (rulePrefixes.length === 0) return result;
  const matches = (ruleId: string) => rulePrefixes.some((prefix) => ruleId.startsWith(prefix));
  const findings = result.findings.filter((finding) => matches(finding.ruleId));
  const counts: Record<LintClass, number> = {
    mechanical: 0,
    consistency: 0,
    repetition: 0,
    "style-pattern": 0,
  };
  for (const finding of findings) counts[finding.class] += 1;
  return { ...result, findings, failures: result.failures.filter((failure) => matches(failure.ruleId)), counts };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runProseLintCli(args: readonly string[] = process.argv.slice(2), dependencies: CliDependencies = {}): number {
  const stdout = dependencies.stdout ?? ((value) => process.stdout.write(value));
  const stderr = dependencies.stderr ?? ((value) => process.stderr.write(value));
  try {
    const options = parse(args, (dependencies.cwd ?? (() => process.cwd()))(), dependencies.allowTitle ?? process.env.NOVEL_FORGE_PROSE_LINT_FORWARDER === "1");
    const input = (dependencies.load ?? loadProseLintInput)(options.target);
    const result = filtered((dependencies.run ?? runProseLint)(input), options.rulePrefixes);
    stdout(options.format === "json"
      ? renderProseLintJson(result)
      : renderProseLintMarkdown(result, { rulePrefixes: options.rulePrefixes, ...(options.title === undefined ? {} : { title: options.title }) }));
    return result.failures.length === 0 ? 0 : 1;
  } catch (error) {
    stderr(`${message(error)}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = runProseLintCli();
