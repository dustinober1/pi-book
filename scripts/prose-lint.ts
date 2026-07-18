import { resolve } from "node:path";
import { loadProseLintInput } from "../src/application/prose-lint/project.js";
import { defaultProseLintRules } from "../src/application/prose-lint/index.js";
import { runProseLint } from "../src/application/prose-lint/engine.js";
import { renderProseLintJson, renderProseLintMarkdown } from "../src/application/prose-lint/report.js";

const args = process.argv.slice(2);
const target = resolve(args.find((arg) => !arg.startsWith("-")) ?? process.cwd());
const format = args.includes("--json") ? "json" : "markdown";
const result = runProseLint(loadProseLintInput(target), defaultProseLintRules);
process.stdout.write(format === "json" ? renderProseLintJson(result) : renderProseLintMarkdown(result, `Prose lint: ${target}`));
if (result.failures.length) process.exitCode = 2;
