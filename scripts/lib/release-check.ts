import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ReleaseCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export function check(id: string, passed: boolean, detail: string): ReleaseCheck {
  return { id, passed, detail };
}

export function text(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

export function runChecklist(checks: ReleaseCheck[]): void {
  for (const item of checks) console.log(`- ${item.id}: ${item.passed ? "PASS" : `FAIL (${item.detail})`}`);
  const failures = checks.filter((item) => !item.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} release checks passed.`);
  if (failures.length) process.exitCode = 1;
}
