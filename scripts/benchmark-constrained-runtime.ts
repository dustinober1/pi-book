import { resolve } from "node:path";
import { benchmarkReportJson, runConstrainedRuntimeBenchmark } from "../src/evaluation/constrained-runtime.js";

const results = runConstrainedRuntimeBenchmark(resolve(process.cwd(), "evals"));
process.stdout.write(benchmarkReportJson(results));
if (results.some((result) => !result.stageSuccess || result.validationResult !== "pass")) process.exitCode = 1;
