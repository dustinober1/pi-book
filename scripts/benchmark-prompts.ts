import { runPromptCompilerBenchmark } from "../src/evaluation/prompt-compiler-benchmark.js";
import { runPromptCompileMatrix } from "../src/evaluation/prompt-compile-matrix.js";

const report = runPromptCompilerBenchmark();
const matrix = runPromptCompileMatrix();
process.stdout.write(`${JSON.stringify({ ...report, compileMatrix: matrix }, null, 2)}\n`);
if (!report.allPassed || matrix.failures.length > 0) process.exitCode = 1;
