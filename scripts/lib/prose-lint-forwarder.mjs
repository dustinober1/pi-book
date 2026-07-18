import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tsxImport = pathToFileURL(require.resolve("tsx")).href;

export function forwardProseLint({ title, rulePrefixes }) {
  const cli = fileURLToPath(new URL("../prose-lint.ts", import.meta.url));
  const result = spawnSync(process.execPath, [
    "--import", tsxImport, cli, ...process.argv.slice(2), "--title", title, "--rules", rulePrefixes.join(","),
  ], {
    stdio: "inherit",
    env: { ...process.env, NOVEL_FORGE_PROSE_LINT_FORWARDER: "1" },
  });
  if (result.error !== undefined) throw result.error;
  process.exitCode = result.status ?? 1;
}
