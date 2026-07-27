import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * TypeBox reports a failed union as a single "Expected union value" at the
 * union's own path, which tells an author agent that an item is wrong but not
 * which field is wrong. Guarded files use unions heavily (research ledger
 * items, plot-grid rows, remarkability entries), so an unexpanded union error
 * costs a whole rejection round.
 *
 * Union errors are therefore expanded against the closest-matching variant —
 * the one that fails on the fewest fields — so the report names real fields.
 */

const MAX_VARIANT_LINES = 6;
const MAX_DEPTH = 2;

interface Line {
  path: string;
  message: string;
}

function variants(schema: unknown): TSchema[] {
  const anyOf = (schema as { anyOf?: unknown } | null)?.anyOf;
  return Array.isArray(anyOf) ? (anyOf as TSchema[]) : [];
}

/**
 * A union of literals is an enumeration, so listing the allowed values is more
 * useful than reporting the closest literal as if it were a shape mismatch.
 */
function literalValues(options: TSchema[]): unknown[] | null {
  if (!options.length) return null;
  const values = options.map((option) => (option as { const?: unknown }).const);
  return values.every((value) => value !== undefined) ? values : null;
}

function closestVariant(options: TSchema[], value: unknown): { variant: TSchema; index: number } | null {
  let best: { variant: TSchema; index: number; count: number } | null = null;
  for (const [index, variant] of options.entries()) {
    const count = [...Value.Errors(variant, value)].length;
    if (!best || count < best.count) best = { variant, index, count };
  }
  return best ? { variant: best.variant, index: best.index } : null;
}

function collect(schema: TSchema, value: unknown, prefix: string, depth: number): Line[] {
  const lines: Line[] = [];
  for (const error of Value.Errors(schema, value)) {
    const path = `${prefix}${error.path}`;
    const options = variants(error.schema);
    const allowed = literalValues(options);
    if (allowed) {
      lines.push({ path, message: `expected one of ${allowed.map((item) => JSON.stringify(item)).join(", ")}` });
      continue;
    }
    if (options.length && depth < MAX_DEPTH) {
      const closest = closestVariant(options, error.value);
      if (closest) {
        const nested = collect(closest.variant, error.value, path, depth + 1).slice(0, MAX_VARIANT_LINES);
        lines.push({
          path,
          message: `does not match any allowed shape for this entry; against the closest of ${options.length} allowed shapes (#${closest.index + 1})`,
        });
        lines.push(...nested);
        continue;
      }
    }
    lines.push({ path, message: error.message });
  }
  return lines;
}

/**
 * Renders schema failures as `path: message` lines with real instance paths,
 * deduplicated and capped. The trailing count keeps a wide failure honest
 * instead of silently hiding the rest.
 */
export function schemaErrorLines(schema: TSchema, value: unknown, limit = 12): string[] {
  const rendered = collect(schema, value, "", 0).map((line) => `${line.path || "/"}: ${line.message}`);
  const unique = [...new Set(rendered)];
  if (unique.length <= limit) return unique;
  return [...unique.slice(0, limit), `... and ${unique.length - limit} more schema problems in this file.`];
}
