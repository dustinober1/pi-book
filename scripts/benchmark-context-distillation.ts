import { runContextDistillationBenchmark } from "../src/evaluation/context-distillation-benchmark.js";

const report = runContextDistillationBenchmark();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.allRequiredRetained || !report.allWithinBudget) process.exitCode = 1;
