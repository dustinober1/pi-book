import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidEntityRegistry,
  entityRegistryFindings,
  resolveEntityId,
} from "../src/application/entity-registry.js";
import type { EntityRegistry } from "../src/domain/entity-registry.js";

function registry(): EntityRegistry {
  return {
    schema_version: "1.0.0",
    entities: [
      {
        id: "CHAR-MARA",
        category: "character",
        display_name: "Mara Vale",
        aliases: ["Mara", "Captain Vale"],
        status: "locked-canon",
        source: "series-bible",
        introduced_in: "book-01",
      },
      {
        id: "LOC-ARCHIVE",
        category: "location",
        display_name: "Central Archive",
        aliases: ["the archive"],
        status: "locked-canon",
        source: "book-bible",
        introduced_in: "book-01",
      },
    ],
  };
}

test("entity aliases resolve case-insensitively to one stable ID", () => {
  const value = registry();
  assert.equal(resolveEntityId(value, "  captain VALE "), "CHAR-MARA");
  assert.equal(resolveEntityId(value, "Mara Vale"), "CHAR-MARA");
});

test("renaming an entity does not change its identity", () => {
  const value = registry();
  value.entities[0]!.display_name = "Mara O'Donnell";
  value.entities[0]!.aliases.push("Mara Vale");
  assert.equal(resolveEntityId(value, "Mara Vale"), "CHAR-MARA");
  assert.equal(resolveEntityId(value, "Mara O'Donnell"), "CHAR-MARA");
});

test("duplicate aliases across entities block the registry", () => {
  const value = registry();
  value.entities[1]!.aliases.push("Mara");
  assert.match(entityRegistryFindings(value).join("\n"), /alias Mara/i);
  assert.throws(() => assertValidEntityRegistry(value), /entity registry validation failed/i);
});
