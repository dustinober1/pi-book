import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import YAML from "yaml";
import { ChapterPacketSchema, ProfileIdSchema, type ChapterPacket, type ProfileId } from "../domain/schemas.js";
import { parseQualityTierId, type QualityTierId } from "../domain/quality-profile.js";
import type { ModelCallReport } from "../domain/run-report.js";
import type { QualityWorker, QualityWorkerRequest } from "../domain/quality-worker.js";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });

export const QualityEvalFixtureSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  id: Type.String({ pattern: "^QEF-[A-Z0-9-]+$" }),
  profile: ProfileIdSchema,
  chapter: Type.Integer({ minimum: 1 }),
  project_hash: HashSchema,
  packet: ChapterPacketSchema,
  context: Type.String({ minLength: 1, maxLength: 100_000 }),
  protected_constraints: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 50 }),
}, { additionalProperties: false });
export type QualityEvalFixture = Static<typeof QualityEvalFixtureSchema>;

const ScoreSchema = Type.Integer({ minimum: 1, maximum: 5 });
export const QualityEvalDiagnosticSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  sample_id: Type.String({ pattern: "^SMP-[A-F0-9]{12}$" }),
  scores: Type.Object({
    canon_integrity: ScoreSchema,
    consent_integrity: ScoreSchema,
    reveal_order: ScoreSchema,
    causality: ScoreSchema,
    factual_grounding: ScoreSchema,
    voice_fidelity: ScoreSchema,
  }, { additionalProperties: false }),
  severe_failures: Type.Object({
    canon: Type.Boolean(),
    consent: Type.Boolean(),
    reveal_order: Type.Boolean(),
    causal: Type.Boolean(),
    factual: Type.Boolean(),
    voice: Type.Boolean(),
  }, { additionalProperties: false }),
  notes: Type.Array(Type.String({ maxLength: 500 }), { maxItems: 20 }),
}, { additionalProperties: false });
export type QualityEvalDiagnostic = Static<typeof QualityEvalDiagnosticSchema>;

export interface QualityEvalSample {
  sampleId: string;
  groupId: string;
  text: string;
  generationUsage: ModelCallReport;
  diagnosticUsage: ModelCallReport;
  diagnostic: QualityEvalDiagnostic;
}

export interface QualityEvalSealedLabel {
  fixtureId: string;
  profile: ProfileId;
  tier: QualityTierId;
  provider: string;
  model: string;
}

export interface QualityEvalComparison {
  comparisonId: string;
  groupId: string;
  sampleIds: [string, string];
}

export interface QualityEvaluationBundle {
  schemaVersion: "1.0.0";
  seedHash: string;
  samples: QualityEvalSample[];
  comparisons: QualityEvalComparison[];
  sealedLabels: Record<string, QualityEvalSealedLabel>;
}

export interface RunQualityEvaluationInput {
  fixtures: readonly QualityEvalFixture[];
  worker: QualityWorker;
  provider: string;
  model: string;
  tiers: readonly QualityTierId[];
  seed: string;
  signal?: AbortSignal;
}

export interface PaidQualityEvalConfig {
  provider: string;
  model: string;
  tiers: QualityTierId[];
  seed: string;
}

function schemaErrors(schema: object, value: unknown, label: string): never {
  const errors = [...Value.Errors(schema as never, value)].slice(0, 8).map((error) => `${error.path || "/"}: ${error.message}`);
  throw new Error(`${label} failed schema validation:\n${errors.join("\n")}`);
}

function validateFixture(value: unknown, label: string): QualityEvalFixture {
  if (!Value.Check(QualityEvalFixtureSchema, value)) schemaErrors(QualityEvalFixtureSchema, value, label);
  const fixture = value as QualityEvalFixture;
  if (fixture.chapter !== fixture.packet.chapter) throw new Error(`${label} chapter must match packet.chapter.`);
  return fixture;
}

export function loadQualityEvalFixtures(directory: string): QualityEvalFixture[] {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new Error("Quality evaluation fixture directory contains no YAML fixtures.");
  const fixtures = names.map((name) => {
    const path = join(directory, name);
    let value: unknown;
    try {
      value = YAML.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new Error(`${name} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
    return validateFixture(value, name);
  });
  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (seen.has(fixture.id)) throw new Error(`Duplicate quality evaluation fixture id ${fixture.id}.`);
    seen.add(fixture.id);
  }
  return fixtures.sort((left, right) => left.id.localeCompare(right.id));
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function opaqueId(prefix: "SMP" | "GRP" | "CMP", ...parts: string[]): string {
  return `${prefix}-${digest(parts.join("\u0000")).slice(0, 12).toUpperCase()}`;
}

function stableRank(seed: string, ...parts: string[]): string {
  return digest([seed, ...parts].join("\u0000"));
}

function uniqueTiers(values: readonly QualityTierId[]): QualityTierId[] {
  if (values.length < 2) throw new Error("Quality evaluation requires at least two tiers.");
  const tiers = values.map(parseQualityTierId);
  if (new Set(tiers).size !== tiers.length) throw new Error("Quality evaluation tiers must be unique.");
  return tiers;
}

function frozenContext(fixture: QualityEvalFixture): string {
  return JSON.stringify({
    schema_version: fixture.schema_version,
    profile: fixture.profile,
    chapter: fixture.chapter,
    project_hash: fixture.project_hash,
    packet: fixture.packet,
    context: fixture.context,
    protected_constraints: fixture.protected_constraints,
  });
}

function samplePrompt(input: { sampleId: string; tier: QualityTierId; fixture: QualityEvalFixture }): string {
  return [
    "NOVEL FORGE BLINDED QUALITY EVALUATION SAMPLE",
    JSON.stringify({
      output_type: "quality-eval-sample",
      sample_id: input.sampleId,
      tier: input.tier,
      fixture_hash: digest(frozenContext(input.fixture)),
    }),
    "Generate one complete chapter sample from the supplied frozen packet and context.",
    "Apply the named quality tier, but do not mention the tier, model, provider, evaluation, or sample labels in the prose.",
    "Return chapter prose only. Do not mutate project state or emit control files.",
  ].join("\n");
}

function diagnosticPrompt(sampleId: string): string {
  return [
    "NOVEL FORGE BLINDED AUTOMATED DIAGNOSTIC",
    JSON.stringify({ output_type: "quality-eval-diagnostic", sample_id: sampleId }),
    "Return exactly one JSON object matching the diagnostic schema.",
    "Score canon integrity, consent integrity, reveal order, causality, factual grounding, and voice fidelity from 1 to 5.",
    "Record severe canon, consent, reveal-order, causal, factual, and voice failures separately.",
    "This is an automated diagnostic, not human reader evidence. Do not infer tier, model, provider, or fixture identity.",
  ].join("\n");
}

function parseDiagnostic(text: string, sampleId: string): QualityEvalDiagnostic {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Quality diagnostic ${sampleId} did not return valid JSON.`);
  }
  if (!Value.Check(QualityEvalDiagnosticSchema, value)) schemaErrors(QualityEvalDiagnosticSchema, value, `Quality diagnostic ${sampleId}`);
  const diagnostic = value as QualityEvalDiagnostic;
  if (diagnostic.sample_id !== sampleId) throw new Error(`Quality diagnostic sample_id must be ${sampleId}.`);
  return diagnostic;
}

function request(input: {
  callId: string;
  prompt: string;
  context: string;
  pass: "candidate" | "verification";
  provider: string;
  model: string;
}): QualityWorkerRequest {
  return {
    callId: input.callId,
    stage: "quality-evaluation",
    pass: input.pass,
    prompt: input.prompt,
    context: input.context,
    provider: input.provider,
    model: input.model,
    timeoutMs: input.pass === "candidate" ? 10 * 60_000 : 5 * 60_000,
  };
}

export async function runQualityEvaluation(input: RunQualityEvaluationInput): Promise<QualityEvaluationBundle> {
  const provider = input.provider.trim();
  const model = input.model.trim();
  const seed = input.seed.trim();
  if (!provider) throw new Error("Quality evaluation provider is required.");
  if (!model) throw new Error("Quality evaluation model is required.");
  if (!seed) throw new Error("Quality evaluation seed is required.");
  const tiers = uniqueTiers(input.tiers);
  const fixtures = input.fixtures.map((fixture, index) => validateFixture(fixture, `quality fixture ${index + 1}`));
  if (fixtures.length === 0) throw new Error("Quality evaluation requires at least one fixture.");

  const samples: QualityEvalSample[] = [];
  const sealedLabels: Record<string, QualityEvalSealedLabel> = {};
  const groupSamples = new Map<string, string[]>();
  let callOrder = 0;

  for (const fixture of fixtures) {
    const groupId = opaqueId("GRP", seed, fixture.id);
    const context = frozenContext(fixture);
    const tierOrder = [...tiers].sort((left, right) => stableRank(seed, fixture.id, left).localeCompare(stableRank(seed, fixture.id, right)));
    for (const tier of tierOrder) {
      const sampleId = opaqueId("SMP", seed, fixture.id, tier);
      const generation = await input.worker.run(request({
        callId: `QEV-CALL-${String(++callOrder).padStart(4, "0")}`,
        prompt: samplePrompt({ sampleId, tier, fixture }),
        context,
        pass: "candidate",
        provider,
        model,
      }), input.signal);
      if (!generation.text.trim()) throw new Error(`Quality evaluation sample ${sampleId} is empty.`);
      const diagnostic = await input.worker.run(request({
        callId: `QEV-CALL-${String(++callOrder).padStart(4, "0")}`,
        prompt: diagnosticPrompt(sampleId),
        context: generation.text,
        pass: "verification",
        provider,
        model,
      }), input.signal);
      const parsedDiagnostic = parseDiagnostic(diagnostic.text, sampleId);
      samples.push({
        sampleId,
        groupId,
        text: generation.text,
        generationUsage: generation.usage,
        diagnosticUsage: diagnostic.usage,
        diagnostic: parsedDiagnostic,
      });
      sealedLabels[sampleId] = { fixtureId: fixture.id, profile: fixture.profile, tier, provider, model };
      groupSamples.set(groupId, [...(groupSamples.get(groupId) ?? []), sampleId]);
    }
  }

  const comparisons: QualityEvalComparison[] = [];
  for (const [groupId, ids] of groupSamples) {
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const pair = [ids[left]!, ids[right]!] as [string, string];
        if (stableRank(seed, groupId, pair[0], pair[1]) > stableRank(seed, groupId, pair[1], pair[0])) pair.reverse();
        comparisons.push({
          comparisonId: opaqueId("CMP", seed, groupId, ...[...pair].sort()),
          groupId,
          sampleIds: pair,
        });
      }
    }
  }
  comparisons.sort((left, right) => stableRank(seed, left.comparisonId).localeCompare(stableRank(seed, right.comparisonId)));
  samples.sort((left, right) => stableRank(seed, left.sampleId).localeCompare(stableRank(seed, right.sampleId)));

  return {
    schemaVersion: "1.0.0",
    seedHash: digest(seed),
    samples,
    comparisons,
    sealedLabels,
  };
}

export function assertPaidQualityEvalConfig(env: Record<string, string | undefined>): PaidQualityEvalConfig {
  if (env.NOVEL_FORGE_RUN_PAID_EVAL !== "1") throw new Error("Paid quality evaluation requires NOVEL_FORGE_RUN_PAID_EVAL=1.");
  const provider = env.NOVEL_FORGE_QUALITY_EVAL_PROVIDER?.trim() ?? "";
  const model = env.NOVEL_FORGE_QUALITY_EVAL_MODEL?.trim() ?? "";
  const seed = env.NOVEL_FORGE_QUALITY_EVAL_SEED?.trim() ?? "";
  if (!provider) throw new Error("Paid quality evaluation requires an explicit provider.");
  if (!model) throw new Error("Paid quality evaluation requires an explicit model.");
  const rawTiers = env.NOVEL_FORGE_QUALITY_EVAL_TIERS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (rawTiers.length < 2) throw new Error("Paid quality evaluation requires at least two explicit tiers.");
  const tiers = uniqueTiers(rawTiers.map(parseQualityTierId));
  if (!tiers.includes("economy")) throw new Error("Paid quality evaluation tiers must include economy as the cost baseline.");
  if (!seed) throw new Error("Paid quality evaluation requires an explicit seed.");
  return { provider, model, tiers, seed };
}

export function assertQualityFixtureTreeClean(status: string): void {
  if (status.trim()) throw new Error("Paid quality evaluation refused a dirty fixture tree. Commit or restore evals/quality/fixtures first.");
}

export function qualityEvalFixture(input: {
  id: string;
  profile: ProfileId;
  chapter: number;
  projectHash: string;
  packet: ChapterPacket;
  context: string;
  protectedConstraints?: string[];
}): QualityEvalFixture {
  return validateFixture({
    schema_version: "1.0.0",
    id: input.id,
    profile: input.profile,
    chapter: input.chapter,
    project_hash: input.projectHash,
    packet: input.packet,
    context: input.context,
    protected_constraints: input.protectedConstraints ?? [],
  }, input.id);
}
