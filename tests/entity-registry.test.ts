import test from "node:test";
import assert from "node:assert/strict";
import { Value } from "@sinclair/typebox/value";
import {
  entityRegistryFindings,
  resolveEntityReference,
} from "../src/application/story-state/entity-registry.js";
import {
  EntityRegistrySchema,
  type EntityRegistry,
} from "../src/domain/entity-registry.js";

function registry(): EntityRegistry {
  return {
    schema_version: "1.0.0",
    entities: [
      {
        id: "CHAR-MARA-001",
        category: "character",
        display_name: "Mara Vale",
        aliases: ["Mara", "M. Vale"],
        status: "active",
      },
      {
        id: "LOC-ARCHIVE-001",
        category: "location",
        display_name: "Central Archive",
        aliases: ["the archive"],
        status: "active",
      },
      {
        id: "ITEM-BADGE-001",
        category: "object",
        display_name: "Mara's Archive Badge",
        aliases: ["old badge"],
        status: "deprecated",
      },
    ],
  };
}

test("entity aliases resolve to stable IDs without exposing deprecated records", () => {
  const value = registry();
  assert.equal(Value.Check(EntityRegistrySchema, value), true);
  assert.equal(resolveEntityReference(value, "m. vale"), "CHAR-MARA-001");
  assert.equal(resolveEntityReference(value, "The Archive"), "LOC-ARCHIVE-001");
  assert.equal(resolveEntityReference(value, "old badge"), null);
  assert.equal(resolveEntityReference(value, "CHAR-MARA-001"), "CHAR-MARA-001");
});

test("registry findings reject duplicate IDs and normalized alias collisions", () => {
  const value = registry();
  value.entities.push({
    id: "CHAR-MARA-001",
    category: "organization",
    display_name: "Mara Office",
    aliases: ["Mara"],
    status: "active",
  });
  const codes = entityRegistryFindings(value).map((finding) => finding.code);
  assert.ok(codes.includes("duplicate-entity-id"));
  assert.ok(codes.includes("entity-alias-collision"));
});
