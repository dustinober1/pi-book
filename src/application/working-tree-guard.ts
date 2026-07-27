import { join } from "node:path";
import { readText } from "../infrastructure/files.js";
import { gitDirtyPaths } from "../infrastructure/git.js";
import type { FileChange } from "../infrastructure/transaction.js";

/**
 * Every guarded event carries its file contents inline, so the working tree
 * should never already hold an uncommitted version of a submitted path. In
 * practice author agents kept staging their work by writing the project tree
 * first and then submitting identical content, which leaves the canonical file
 * in an unvalidated state between the write and the apply — including, in one
 * observed session, a schema-invalid chapter-queue.yaml sitting on disk for a
 * full minute while validation failed and was repaired.
 *
 * `projectStateHash` cannot see any of this: it covers PROJECT.yaml, BOOK.yaml,
 * and a fixed evidence list, and deliberately excludes chapter-queue.yaml,
 * plot-grid.yaml, remarkability.yaml, and the manuscript tree — precisely the
 * files agents stage this way. Git is the only witness, so the guard reads it.
 *
 * A dirty submitted path whose content matches the submission is a staging
 * habit: harmless in outcome, still against the transaction rule, reported as
 * an advisory. A dirty submitted path whose content *differs* is a real hazard,
 * because applying the event would silently discard uncommitted work, so it is
 * a blocker.
 */
export interface WorkingTreeFinding {
  severity: "advisory" | "blocker";
  path: string;
  message: string;
}

const BOUNDARY_RULE = "Guarded events carry their file contents inline; never write, move, or delete a file inside the project root by any other means.";

export function outOfBandWriteFindings(root: string, changes: readonly FileChange[]): WorkingTreeFinding[] {
  const dirty = new Set(gitDirtyPaths(root, changes.map((change) => change.path)));
  if (!dirty.size) return [];
  const findings: WorkingTreeFinding[] = [];
  for (const change of changes) {
    if (!dirty.has(change.path)) continue;
    const onDisk = readText(join(root, change.path));
    // A submitted path that does not exist yet cannot have been written
    // out of band; Git reports the deletion of a tracked file the same way.
    if (onDisk === null) continue;
    if (onDisk === change.content) {
      findings.push({
        severity: "advisory",
        path: change.path,
        message: `${change.path} was already written into the project tree outside a guarded event. The submitted content matches, so nothing was lost, but the file was uncommitted and unvalidated until this event. ${BOUNDARY_RULE}`,
      });
      continue;
    }
    findings.push({
      severity: "blocker",
      path: change.path,
      message: `${change.path} holds uncommitted changes that differ from the content submitted with this event; applying it would discard that work. Submit the on-disk content if it is what you meant, or commit or discard the uncommitted change before resubmitting. ${BOUNDARY_RULE}`,
    });
  }
  return findings;
}
