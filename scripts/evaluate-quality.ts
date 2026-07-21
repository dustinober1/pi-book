import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertPaidQualityEvalConfig,
  assertQualityFixtureTreeClean,
  loadQualityEvalFixtures,
  runQualityEvaluation,
} from "../src/evaluation/quality-eval.js";
import { writeQualityEvalArtifacts } from "../src/evaluation/quality-eval-report.js";
import { PiPrintWorker } from "../src/pi/pi-print-worker.js";

function fixtureStatus(root: string): string {
  const result = spawnSync("git", ["status", "--porcelain", "--", "evals/quality/fixtures"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error("Unable to verify the quality evaluation fixture tree with Git.");
  return result.stdout;
}

export async function evaluateQualityFromEnvironment(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const config = assertPaidQualityEvalConfig(env);
  assertQualityFixtureTreeClean(fixtureStatus(root));
  const fixtures = loadQualityEvalFixtures(resolve(root, "evals", "quality", "fixtures"));
  const worker = new PiPrintWorker({ cwd: root, env });
  const bundle = await runQualityEvaluation({
    fixtures,
    worker,
    provider: config.provider,
    model: config.model,
    tiers: config.tiers,
    seed: config.seed,
  });
  const output = resolve(root, env.NOVEL_FORGE_QUALITY_EVAL_OUTPUT?.trim() || `.pi-book/evals/quality/${bundle.seedHash.slice(0, 12)}`);
  writeQualityEvalArtifacts(output, bundle);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  evaluateQualityFromEnvironment()
    .then((output) => console.log(`Blinded quality evaluation kit written to ${output}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
