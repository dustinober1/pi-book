import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeProject } from "../src/project/store.js";
import { schemaForPath, assertSchema } from "../src/domain/schemas.js";
import { parseYaml } from "../src/infrastructure/yaml.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-remarkability-")); }

test("new books scaffold typed remarkability and reader experiment artifacts", () => {
  const parent = temp();
  try {
    const root = initializeProject(parent, { projectName: "Memorable Book", projectType: "standalone", profile: "thriller" });
    const bookRoot = join(root, "books", "book-01");
    for (const name of ["remarkability.yaml", "reader-experiments.yaml"]) {
      const path = join(bookRoot, name);
      assert.equal(existsSync(path), true, `${name} should be scaffolded`);
      const schema = schemaForPath(path);
      assert.ok(schema, `${name} should have a registered schema`);
      const value = parseYaml(readFileSync(path, "utf8"));
      assert.doesNotThrow(() => assertSchema(schema, value, name));
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
