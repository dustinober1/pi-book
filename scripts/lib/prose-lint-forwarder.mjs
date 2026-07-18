import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tsxImport = pathToFileURL(require.resolve("tsx")).href;

export function forwardProseLint({ title, rulePrefixes, legacyReport, supportsMinCount = false }) {
  const cli = fileURLToPath(new URL("../prose-lint.ts", import.meta.url));
  const forwarded = process.argv.slice(2);
  const internal = ["--title", title, "--rules", rulePrefixes.join(","), "--legacy-report", legacyReport];
  if (supportsMinCount) {
    const minCountIndex = forwarded.indexOf("--min-count");
    const parsed = minCountIndex >= 0 ? Number(forwarded[minCountIndex + 1]) || 2 : 2;
    if (minCountIndex >= 0) forwarded.splice(minCountIndex, 2);
    internal.push("--ngram-min-count", String(parsed));
  }
  const result = spawnSync(process.execPath, [
    "--import", tsxImport, cli, ...forwarded, ...internal,
  ], {
    stdio: "inherit",
    env: { ...process.env, NOVEL_FORGE_PROSE_LINT_FORWARDER: "1" },
  });
  if (result.error !== undefined) throw result.error;
  process.exitCode = result.status ?? 1;
}
