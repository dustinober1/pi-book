import { resolve } from "node:path";
import {
  benchmarkReportJson,
  runConstrainedRuntimeBenchmark,
  runContextBoundaryBenchmark,
} from "../src/evaluation/constrained-runtime.js";

const results = runConstrainedRuntimeBenchmark(resolve(process.cwd(), "evals"));
const boundaries = runContextBoundaryBenchmark();
process.stdout.write(benchmarkReportJson(results, boundaries));
if (
  results.some((result) => !result.stageSuccess || result.validationResult !== "pass")
  || boundaries.some((result) => !result.passed)
) process.exitCode = 1;
