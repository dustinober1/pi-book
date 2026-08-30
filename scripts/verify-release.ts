import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runChecklist, type ReleaseCheck } from "./lib/release-check.js";
import { RELEASE_REGISTRY } from "./lib/release-registry.js";

/**
 * Verifies the release set for the installed version. Adding a release means
 * adding one entry to RELEASE_REGISTRY — this file does not change.
 */
export function verifyCurrentRelease(root: string): ReleaseCheck[] {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  const entry = RELEASE_REGISTRY.find((item) => item.version === packageJson.version);
  if (!entry) {
    return [{ id: "release-registry-entry", passed: false, detail: `No release-registry entry for installed version ${packageJson.version}. Add one to scripts/lib/release-registry.ts.` }];
  }
  return entry.verify(root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runChecklist(verifyCurrentRelease(process.cwd()));
}
