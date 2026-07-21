import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { PiPrintWorker } from "../src/pi/pi-print-worker.js";
import {
  createQualityEvaluation,
  requirePaidEvaluationConfiguration,
  type QualityEvalFixture,
  type QualityEvalGeneration,
  type QualityEvalGenerator,
} from "../src/evaluation/quality-eval.js";
import type { QualityTierId } from "../src/domain/quality-profile.js";

function argumentsMap(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    result.set(key.slice(2), value);
    index += 1;
  }
  return result;
}

function required(args: Map<string, string>, key: string): string {
  const value = args.get(key)?.trim();
  if (!value) throw new Error(`--${key} is required.`);
  return value;
}

function loadFixture(path: string): QualityEvalFixture {
  const value = parseYaml<Record<string, unknown>>(readFileSync(path, "utf8"), undefined, path);
  const hash = /^[a-f0-9]{64}$/;
  if (value.schema_version !== "1.0.0") throw new Error(`${path} requires schema_version 1.0.0.`);
  if (typeof value.id !== "string" || !value.id.trim()) throw new Error(`${path} requires id.`);
  if (!["thriller", "romantasy", "historical-fiction"].includes(String(value.profile))) throw new Error(`${path} has unsupported profile.`);
  if (!Number.isInteger(value.chapter) || Number(value.chapter) < 1) throw new Error(`${path} requires a positive chapter.`);
  for (const key of ["project_hash", "packet_hash", "context_hash"] as const) {
    if (typeof value[key] !== "string" || !hash.test(value[key])) throw new Error(`${path} requires a SHA-256 ${key}.`);
  }
  if (!Array.isArray(value.rubric) || value.rubric.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${path} requires rubric strings.`);
  return value as unknown as QualityEvalFixture;
}

function requireCleanTree(): void {
  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" });
  } catch {
    throw new Error("Paid quality evaluation requires an accessible Git worktree.");
  }
  if (status.trim()) throw new Error("Paid quality evaluation requires a clean tracked fixture tree.");
}

class PiQualityEvalGenerator implements QualityEvalGenerator {
  readonly #worker: PiPrintWorker;
  #order = 0;
  constructor(cwd: string) { this.#worker = new PiPrintWorker({ cwd }); }

  async generate(input: { fixture: QualityEvalFixture; tier: QualityTierId; sampleId: string; provider: string; model: string }): Promise<QualityEvalGeneration> {
    const prompt = [
      "NOVEL FORGE BLINDED QUALITY EVALUATION",
      `Generate one complete sample for quality policy ${input.tier}.`,
      "Use only the frozen scenario supplied as context. Do not mention the tier, provider, model, evaluation, or rubric in the prose.",
      "Return exactly one JSON object with: text, severe_failures (string array), diagnostic_scores (object of numeric 1-5 values).",
      "Automated scores are diagnostic only and must not claim human validation.",
    ].join("\n");
    const result = await this.#worker.run({
      callId: `QE-${String(++this.#order).padStart(4, "0")}`,
      stage: "drafting",
      chapter: input.fixture.chapter,
      pass: "verification",
      prompt,
      context: JSON.stringify(input.fixture),
      timeoutMs: 10 * 60_000,
      provider: input.provider,
      model: input.model,
    });
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(result.text) as Record<string, unknown>; }
    catch { throw new Error(`Quality evaluation sample ${input.sampleId} did not return valid JSON.`); }
    if (typeof parsed.text !== "string" || !parsed.text.trim()) throw new Error(`Quality evaluation sample ${input.sampleId} has no prose.`);
    const failures = Array.isArray(parsed.severe_failures) ? parsed.severe_failures.filter((item): item is string => typeof item === "string") : [];
    const scores = parsed.diagnostic_scores && typeof parsed.diagnostic_scores === "object"
      ? Object.fromEntries(Object.entries(parsed.diagnostic_scores as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])))
      : {};
    return {
      text: parsed.text,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      costUsd: result.usage.costUsd ?? 0,
      severeFailures: failures,
      diagnosticScores: scores,
    };
  }
}

async function main(): Promise<void> {
  const args = argumentsMap(process.argv.slice(2));
  const fixturePath = required(args, "fixture");
  const provider = required(args, "provider");
  const model = required(args, "model");
  const seed = required(args, "seed");
  const tiers = required(args, "tiers").split(",").map((item) => item.trim()).filter(Boolean) as QualityTierId[];
  const allowed: QualityTierId[] = ["economy", "balanced", "premium", "editorial"];
  if (tiers.some((tier) => !allowed.includes(tier))) throw new Error("--tiers contains an unsupported quality tier.");
  requirePaidEvaluationConfiguration(process.env, { provider, model, tiers, seed });
  requireCleanTree();
  const fixture = loadFixture(fixturePath);
  const suffix = createHash("sha256").update(seed).digest("hex").slice(0, 10);
  const outputRoot = join(process.cwd(), "evals", "quality", "runs", `${basename(fixturePath, ".yaml")}-${suffix}`);
  mkdirSync(outputRoot, { recursive: true });
  const result = await createQualityEvaluation({ fixture, tiers, seed, provider, model, generator: new PiQualityEvalGenerator(process.cwd()), outputRoot });
  console.log(JSON.stringify({ outputRoot, report: result.paths.report, reviewKit: result.paths.reviewMarkdown, labelSeal: result.paths.labelSeal }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
