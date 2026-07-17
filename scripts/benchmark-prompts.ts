import { runPromptCompilerBenchmark } from "../src/evaluation/prompt-compiler-benchmark.js";

const report = runPromptCompilerBenchmark();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.allPassed) process.exitCode = 1;
