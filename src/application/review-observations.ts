import type { BookStrategy } from "../domain/v1-3-schemas.js";

export type FrictionObservation = BookStrategy["reader_friction"]["observations"][number];
export type FrictionCluster = BookStrategy["reader_friction"]["clusters"][number];
export type FrictionCategory = FrictionObservation["category"];
export type Relevance = FrictionObservation["genre_relevance"];
export type ReviewSentiment = FrictionObservation["sentiment"];

export interface RawReviewObservation {
  title: string;
  sourceLocation: string;
  observedOn: string;
  rating: number | null;
  paraphrase: string;
  shortExcerpt?: string | undefined;
  category: FrictionCategory;
  genreRelevance: Relevance;
  executionRelevance: Relevance;
  sentiment?: ReviewSentiment | undefined;
  reviewerName?: string | undefined;
  reviewerHandle?: string | undefined;
  reviewerProfileUrl?: string | undefined;
}

export interface ReviewImportResult {
  observations: FrictionObservation[];
  discardedIdentityFields: number;
  warnings: string[];
}

export interface ReaderFrictionFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
}

interface CsvRecord { [key: string]: string }

const CSV_HEADERS = [
  "title", "source_location", "observed_on", "rating", "paraphrase", "short_excerpt", "category",
  "genre_relevance", "execution_relevance", "sentiment", "reviewer_name", "reviewer_handle", "reviewer_profile_url",
] as const;

const CATEGORIES = new Set<FrictionCategory>([
  "genre-mismatch", "genre-promise-failure", "execution-problem", "character-friction",
  "pacing-problem", "style-preference", "production-problem", "content-or-ideological-objection",
]);
const RELEVANCE = new Set<Relevance>(["low", "medium", "high"]);
const SENTIMENTS = new Set<ReviewSentiment>(["negative", "mixed", "positive"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanIdentity(text: string, values: readonly string[]): string {
  let result = text;
  for (const value of values.map((item) => item.trim()).filter(Boolean).sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(escapeRegExp(value), "giu"), "");
  }
  return result
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function deriveReviewSentiment(rating: number | null, explicit?: ReviewSentiment): ReviewSentiment {
  if (rating !== null) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Review rating must be an integer from 1 to 5 or blank.");
    if (rating <= 2) return "negative";
    if (rating === 3) return "mixed";
    return "positive";
  }
  if (!explicit) throw new Error("An unrated review observation requires an explicit sentiment.");
  return explicit;
}

export function sanitizeReviewObservation(id: string, input: RawReviewObservation): FrictionObservation {
  if (!/^OBS-[0-9]{3}$/.test(id)) throw new Error(`Review observation id must match OBS-NNN; received ${id}.`);
  if (!input.title.trim()) throw new Error(`${id} requires a title.`);
  if (!input.observedOn.trim()) throw new Error(`${id} requires observedOn.`);
  if (!input.paraphrase.trim()) throw new Error(`${id} requires a paraphrase.`);
  if (!CATEGORIES.has(input.category)) throw new Error(`${id} has unsupported category ${input.category}.`);
  if (!RELEVANCE.has(input.genreRelevance) || !RELEVANCE.has(input.executionRelevance)) throw new Error(`${id} has invalid relevance.`);

  const identities = [input.reviewerName ?? "", input.reviewerHandle ?? ""];
  const profile = (input.reviewerProfileUrl ?? "").trim();
  const source = input.sourceLocation.trim() === profile ? "" : input.sourceLocation.trim();
  return {
    id,
    title: input.title.trim(),
    source_location: source,
    observed_on: input.observedOn.trim(),
    rating: input.rating,
    paraphrase: cleanIdentity(input.paraphrase, identities),
    short_excerpt: cleanIdentity(input.shortExcerpt ?? "", identities),
    genre_relevance: input.genreRelevance,
    execution_relevance: input.executionRelevance,
    category: input.category,
    sentiment: deriveReviewSentiment(input.rating, input.sentiment),
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("Review observation CSV contains an unterminated quoted field.");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.length)) rows.push(row);
  }
  return rows;
}

function csvRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  const header = rows.shift();
  if (!header) throw new Error("Review observation CSV is empty.");
  if (header.length !== CSV_HEADERS.length) throw new Error(`Review observation CSV header expected ${CSV_HEADERS.length} columns but received ${header.length}.`);
  for (const required of CSV_HEADERS) if (!header.includes(required)) throw new Error(`Review observation CSV is missing column ${required}.`);
  return rows.map((row, index) => {
    if (row.length !== header.length) throw new Error(`Review observation CSV row ${index + 2} expected ${header.length} columns but received ${row.length}.`);
    return Object.fromEntries(header.map((name, column) => [name, row[column] ?? ""]));
  });
}

function parseRating(value: string): number | null {
  if (!value.trim()) return null;
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`Review rating must be an integer from 1 to 5 or blank; received ${value}.`);
  return rating;
}

function category(value: string): FrictionCategory {
  const normalized = value.trim().toLowerCase().replace(/[ _]+/g, "-") as FrictionCategory;
  if (!CATEGORIES.has(normalized)) throw new Error(`Unsupported review category: ${value || "blank"}.`);
  return normalized;
}

function relevance(value: string, label: string): Relevance {
  const normalized = value.trim().toLowerCase() as Relevance;
  if (!RELEVANCE.has(normalized)) throw new Error(`${label} must be low, medium, or high.`);
  return normalized;
}

function explicitSentiment(value: string): ReviewSentiment | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (!SENTIMENTS.has(normalized as ReviewSentiment)) throw new Error("Sentiment must be negative, mixed, positive, or blank.");
  return normalized as ReviewSentiment;
}

function nextObservationNumber(existingIds: readonly string[]): number {
  return existingIds
    .map((id) => id.match(/^OBS-(\d+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .reduce((maximum, value) => Math.max(maximum, value), 0) + 1;
}

export function importReviewObservationCsv(csv: string, existingIds: readonly string[] = []): ReviewImportResult {
  const records = csvRecords(csv);
  const ids = new Set(existingIds);
  let next = nextObservationNumber(existingIds);
  let discardedIdentityFields = 0;
  const observations: FrictionObservation[] = [];
  for (const record of records) {
    const id = `OBS-${String(next).padStart(3, "0")}`;
    next += 1;
    if (ids.has(id)) throw new Error(`Duplicate review observation id ${id}.`);
    ids.add(id);
    discardedIdentityFields += [record.reviewer_name, record.reviewer_handle, record.reviewer_profile_url].filter((value) => Boolean(value?.trim())).length;
    observations.push(sanitizeReviewObservation(id, {
      title: record.title ?? "",
      sourceLocation: record.source_location ?? "",
      observedOn: record.observed_on ?? "",
      rating: parseRating(record.rating ?? ""),
      paraphrase: record.paraphrase ?? "",
      shortExcerpt: record.short_excerpt ?? "",
      category: category(record.category ?? ""),
      genreRelevance: relevance(record.genre_relevance ?? "", "genre_relevance"),
      executionRelevance: relevance(record.execution_relevance ?? "", "execution_relevance"),
      sentiment: explicitSentiment(record.sentiment ?? ""),
      reviewerName: record.reviewer_name,
      reviewerHandle: record.reviewer_handle,
      reviewerProfileUrl: record.reviewer_profile_url,
    }));
  }
  return { observations, discardedIdentityFields, warnings: [] };
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function maximumClusterConfidence(
  observations: readonly FrictionObservation[],
  positiveCounterweightIds: readonly string[],
): "weak" | "moderate" | "strong" {
  const titles = distinct(observations.map((item) => item.title));
  if (observations.length < 3 || titles.length < 2) return "weak";
  const oneStarOnly = observations.length > 0 && observations.every((item) => item.rating === 1);
  const executionSpecific = observations.some((item) => item.execution_relevance === "high");
  if (!oneStarOnly && observations.length >= 6 && titles.length >= 3 && executionSpecific && positiveCounterweightIds.length > 0) return "strong";
  return "moderate";
}

export function buildReviewCluster(
  input: { id: string; label: string; observationIds: string[] },
  observations: readonly FrictionObservation[],
): FrictionCluster {
  const byId = new Map(observations.map((item) => [item.id, item]));
  const selected = input.observationIds.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Review cluster ${input.id} references missing observation ${id}.`);
    return item;
  });
  if (!selected.length) throw new Error(`Review cluster ${input.id} requires at least one observation.`);
  const categories = new Set(selected.map((item) => item.category));
  if (categories.size !== 1) throw new Error(`Review cluster ${input.id} cannot mix review categories.`);
  const titles = distinct(selected.map((item) => item.title));
  const selectedIds = new Set(input.observationIds);
  const categoryValue = selected[0]!.category;
  const positiveCounterweights = observations
    .filter((item) => !selectedIds.has(item.id) && item.sentiment === "positive" && item.category === categoryValue && titles.includes(item.title))
    .map((item) => item.id)
    .sort();
  return {
    id: input.id,
    label: input.label.trim(),
    observation_ids: [...input.observationIds],
    titles_affected: titles,
    confidence: maximumClusterConfidence(selected, positiveCounterweights),
    positive_counterweights: positiveCounterweights,
    decision: null,
    guardrail: null,
  };
}

const CONFIDENCE_RANK = { weak: 0, moderate: 1, strong: 2 } as const;

function duplicateIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) { if (seen.has(value)) repeated.add(value); else seen.add(value); }
  return [...repeated].sort();
}

export function readerFrictionFindings(strategy: BookStrategy): ReaderFrictionFinding[] {
  const findings: ReaderFrictionFinding[] = [];
  const observations = strategy.reader_friction.observations;
  const clusters = strategy.reader_friction.clusters;
  const observationById = new Map(observations.map((item) => [item.id, item]));
  const clusterById = new Map(clusters.map((item) => [item.id, item]));
  for (const id of duplicateIds(observations.map((item) => item.id))) findings.push({ severity: "blocker", code: "duplicate-observation-id", message: `Duplicate review observation id: ${id}.` });
  for (const id of duplicateIds(clusters.map((item) => item.id))) findings.push({ severity: "blocker", code: "duplicate-cluster-id", message: `Duplicate review cluster id: ${id}.` });

  for (const cluster of clusters) {
    const selected: FrictionObservation[] = [];
    for (const id of cluster.observation_ids) {
      const item = observationById.get(id);
      if (!item) findings.push({ severity: "blocker", code: "missing-observation", message: `${cluster.id} references missing observation ${id}.` });
      else selected.push(item);
    }
    for (const id of cluster.positive_counterweights) {
      const item = observationById.get(id);
      if (!item || item.sentiment !== "positive") findings.push({ severity: "blocker", code: "invalid-counterweight", message: `${cluster.id} counterweight ${id} must reference a positive observation.` });
    }
    const maximum = maximumClusterConfidence(selected, cluster.positive_counterweights);
    if (CONFIDENCE_RANK[cluster.confidence] > CONFIDENCE_RANK[maximum]) {
      findings.push({ severity: "blocker", code: "confidence-inflation", message: `${cluster.id} records ${cluster.confidence} confidence but its evidence supports at most ${maximum}.` });
    }
    if (cluster.decision === "accept-as-tradeoff") {
      const linked = strategy.reader_friction.accepted_tradeoffs.some((tradeoff) => {
        const extended = tradeoff as typeof tradeoff & { source_cluster_ids?: string[] };
        return tradeoff.id === cluster.id || extended.source_cluster_ids?.includes(cluster.id);
      });
      if (!linked) findings.push({ severity: "blocker", code: "missing-tradeoff-link", message: `${cluster.id} is accepted as a tradeoff but has no linked accepted-tradeoff record.` });
    }
  }

  for (const guardrail of strategy.review_derived_guardrails) {
    if (guardrail.status !== "approved") continue;
    if (!guardrail.rule.trim()) findings.push({ severity: "blocker", code: "blank-approved-guardrail", message: `${guardrail.id} is approved but has no rule.` });
    for (const clusterId of guardrail.source_cluster_ids) {
      const cluster = clusterById.get(clusterId);
      if (!cluster || (cluster.decision !== "prevent" && cluster.decision !== "mitigate")) {
        findings.push({ severity: "blocker", code: "invalid-approved-guardrail", message: `${guardrail.id} may use only prevent or mitigate clusters; ${clusterId} is not eligible.` });
      }
    }
  }
  return findings;
}
