import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { assertGemmaQualificationPromotion } from "../src/domain/gemma-qualification.js";
import {
  loadGemmaQualificationAssets,
  loadGemmaQualificationFingerprint,
  parseGemmaQualificationArguments,
  requireGemmaQualificationConfiguration,
  resolveGemmaQualificationRunRoot,
  runGemmaQualification,
} from "../src/evaluation/gemma-qualification.js";
import { PiPrintWorker } from "../src/pi/pi-print-worker.js";

async function main(): Promise<void> {
  const args = parseGemmaQualificationArguments(process.argv.slice(2));
  if (process.env.NOVEL_FORGE_RUN_GEMMA_QUALIFICATION !== "1") {
    throw new Error("Real Gemma qualification requires NOVEL_FORGE_RUN_GEMMA_QUALIFICATION=1.");
  }
  const repositoryRoot = process.cwd();
  const fingerprint = loadGemmaQualificationFingerprint(resolve(repositoryRoot, args.fingerprintPath));
  requireGemmaQualificationConfiguration(process.env, {
    provider: args.provider,
    model: args.model,
    seed: args.seed,
    fingerprint,
  });
  const assets = loadGemmaQualificationAssets(repositoryRoot);
  const runId = `individual-${createHash("sha256")
    .update(`${args.seed}\0${JSON.stringify(fingerprint)}`)
    .digest("hex")
    .slice(0, 16)}`;
  const outputRoot = resolveGemmaQualificationRunRoot(repositoryRoot, runId);
  const result = await runGemmaQualification({
    cases: assets.cases,
    fingerprint,
    provider: args.provider,
    model: args.model,
    seed: args.seed,
    worker: new PiPrintWorker({ cwd: repositoryRoot }),
    outputRoot,
    fixtureSources: assets.fixtureSources,
    rubric: assets.rubric,
  });
  console.log(JSON.stringify({
    output_root: outputRoot,
    report: result.paths.report,
    prose_review_kit: result.paths.reviewKit,
    sealed_labels: result.paths.labelSeal,
    report_hash: result.report.report_hash,
  }, null, 2));
  assertGemmaQualificationPromotion(result.report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
