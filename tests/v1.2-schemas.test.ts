import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml, stringifyYaml } from "../src/infrastructure/yaml.js";
import {
  MarketingMetadataSchema,
  PublishingMetadataSchema,
  ReaderExperimentIndexSchema,
  defaultMarketingMetadata,
  defaultPublishingMetadata,
} from "../src/domain/v1-2-schemas.js";

const book = {
  schema_version: "1.0.0" as const,
  book_id: "book-01",
  title: "The Clean Signal",
  profile: "thriller" as const,
  status: "planning" as const,
  current_chapter: 0,
  target_words: 100000,
  actual_words: 0,
  act_checkpoint: null,
  canon_locked: false,
};

test("publishing metadata is strict and leaves unknown values blank", () => {
  const value = defaultPublishingMetadata(book, 1);
  const parsed = parseYaml(stringifyYaml(value), PublishingMetadataSchema, "publishing.yaml");
  assert.equal(parsed.title, "The Clean Signal");
  assert.equal(parsed.series.number, 1);
  assert.equal(parsed.author.name, "");
  assert.equal(parsed.identifiers.epub_isbn, "");
  assert.throws(() => parseYaml(`${stringifyYaml(value)}unknown: true\n`, PublishingMetadataSchema, "publishing.yaml"), /schema validation/i);
});

test("marketing metadata requires explicit approval state for every group", () => {
  const value = defaultMarketingMetadata();
  const parsed = parseYaml(stringifyYaml(value), MarketingMetadataSchema, "marketing.yaml");
  assert.equal(parsed.social.approval.status, "draft");
  const invalid = structuredClone(value) as any;
  delete invalid.social.approval;
  assert.throws(() => parseYaml(stringifyYaml(invalid), MarketingMetadataSchema, "marketing.yaml"), /schema validation/i);
});

test("reader experiment index rejects unknown keys", () => {
  const text = stringifyYaml({ schema_version: "1.0.0", experiments: [], extra: true });
  assert.throws(() => parseYaml(text, ReaderExperimentIndexSchema, "reader-kits/index.yaml"), /schema validation/i);
});
