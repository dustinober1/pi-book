import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const QualityEventFileSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export const QualityEventOutputSchema = Type.Object({
  schema_version: Type.Literal("1.0.0"),
  chapter: Type.Integer({ minimum: 1 }),
  files: Type.Array(QualityEventFileSchema, { minItems: 1 }),
  summary: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type QualityEventOutput = Static<typeof QualityEventOutputSchema>;

function exactJsonObject(text: string, label: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error(`${label} must be one exact JSON object without Markdown fences.`);
  }
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} must be valid JSON.`);
    throw new Error(`${label} must be one exact JSON object.`);
  }
}

function schemaIssues(schema: TSchema, value: unknown): string[] {
  return [...Value.Errors(schema, value)].slice(0, 8).map((error) => `${error.path || "/"}: ${error.message}`);
}

export class QualityOutputValidationError extends Error {
  constructor(label: string, readonly issues: string[]) {
    super(`Invalid ${label}: ${issues.join("; ")}`);
    this.name = "QualityOutputValidationError";
  }
}

export function parseStructuredQualityArtifact<TSchemaValue extends TSchema>(
  text: string,
  schema: TSchemaValue,
  label: string,
): Static<TSchemaValue> {
  const value = exactJsonObject(text, label);
  if (!Value.Check(schema, value)) throw new QualityOutputValidationError(label, schemaIssues(schema, value));
  return value as Static<TSchemaValue>;
}

function normalizedPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function allowedFinalPath(path: string, bookId: string, chapter: number): "manuscript" | "control" | null {
  if (path.includes("\0") || path.startsWith("/") || path.split("/").includes("..")) return null;
  const base = `books/${bookId}`;
  if ([`${base}/continuity-delta.yaml`, `${base}/revision-tickets.yaml`, "series/story-threads.yaml"].includes(path)) return "control";
  if (!path.startsWith(`${base}/manuscript/chapters/`) || !/\.md$/i.test(path)) return null;
  const filename = path.slice(`${base}/manuscript/chapters/`.length);
  const match = filename.match(/^0*(\d+)(?:[-_ .]|$)/);
  return match && Number(match[1]) === chapter ? "manuscript" : null;
}

export function parseQualityEventOutput(
  text: string,
  expected: { bookId: string; chapter: number },
): QualityEventOutput {
  const output = parseStructuredQualityArtifact(text, QualityEventOutputSchema, "quality event output");
  if (output.chapter !== expected.chapter) throw new Error(`Quality event output must target Chapter ${expected.chapter}.`);
  const seen = new Set<string>();
  let manuscript = false;
  for (const file of output.files) {
    file.path = normalizedPath(file.path);
    if (seen.has(file.path)) throw new Error(`Quality event output contains duplicate path ${file.path}.`);
    seen.add(file.path);
    const kind = allowedFinalPath(file.path, expected.bookId, expected.chapter);
    if (!kind) {
      const looksLikeChapter = file.path.includes("/manuscript/chapters/");
      throw new Error(looksLikeChapter
        ? `Quality event output manuscript path must target Chapter ${expected.chapter}.`
        : `Quality event output path ${file.path} is not allowed.`);
    }
    if (kind === "manuscript") manuscript = true;
  }
  if (!manuscript) throw new Error(`Quality event output must include the Chapter ${expected.chapter} manuscript file.`);
  return output;
}
