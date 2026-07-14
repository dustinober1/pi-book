import YAML from "yaml";
import type { TSchema } from "@sinclair/typebox";
import { assertSchema } from "../domain/schemas.js";

export function parseYaml<T>(text: string, schema?: TSchema, label = "YAML"): T {
  let value: unknown;
  try {
    value = YAML.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (schema) assertSchema<T>(schema, value, label);
  return value as T;
}

export function stringifyYaml(value: unknown): string {
  return YAML.stringify(value, { lineWidth: 120, sortMapEntries: false });
}
