import { createHash } from "node:crypto";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readBook, readProject } from "../project/store.js";

export function projectStateHash(root: string): string {
  return createHash("sha256")
    .update(stringifyYaml(readProject(root)))
    .update("\0")
    .update(stringifyYaml(readBook(root)))
    .digest("hex");
}