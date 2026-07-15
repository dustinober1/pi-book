import type { TSchema } from "@sinclair/typebox";
import {
  AdoptionMapSchema,
  InheritedContextSchema,
  MarketingMetadataSchema,
  PackageManifestSchema,
  PublishingMetadataSchema,
  ReaderExperimentFileSchema,
  ReaderExperimentIndexSchema,
} from "./v1-2-schemas.js";

const registry: Array<[RegExp, TSchema]> = [
  [/(^|\/)publishing\.yaml$/, PublishingMetadataSchema],
  [/(^|\/)marketing\.yaml$/, MarketingMetadataSchema],
  [/(^|\/)adoption-map\.yaml$/, AdoptionMapSchema],
  [/(^|\/)reader-kits\/index\.yaml$/, ReaderExperimentIndexSchema],
  [/(^|\/)reader-kits\/RE-[0-9]{3}\/experiment\.yaml$/, ReaderExperimentFileSchema],
  [/(^|\/)inherited-context\.yaml$/, InheritedContextSchema],
  [/(^|\/)package-manifest\.yaml$/, PackageManifestSchema],
];

export function v12SchemaForPath(path: string): TSchema | null {
  return registry.find(([pattern]) => pattern.test(path.replace(/\\/g, "/")))?.[1] ?? null;
}
