from pathlib import Path

root = Path('.')

# Wire explicit recalibration through the guarded research-update event.
events = root / 'src/application/events.ts'
text = events.read_text(encoding='utf-8')
old = '''    case "reader-test":
    case "research-update":
      break;
'''
new = '''    case "reader-test":
      break;
    case "research-update":
      appendMilestoneVoiceAudit(root, changes, book, { eventType: "research-update", scope: input.scope });
      break;
'''
if new not in text:
    if old not in text:
        raise RuntimeError('events.ts research-update switch anchor missing')
    events.write_text(text.replace(old, new, 1), encoding='utf-8')

# Add an end-to-end recalibration assertion.
integration = root / 'tests/phase5-integration.test.ts'
text = integration.read_text(encoding='utf-8')
recalibration_test = '''

test("explicit recalibration through research-update appends evidence without changing stage", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-recalibration-"));
  try {
    const root = setup(parent);
    writeFileSync(join(root, "books", "book-01", "manuscript", "chapters", "01-existing.md"), "# Existing\\n\\nMara watched the door.\\n\\n\\\"Move,\\\" Jonah said.", "utf8");
    const beforeStage = readProject(root).current_stage;
    applyNovelEvent(root, {
      eventType: "research-update",
      expectedStage: "drafting",
      expectedProjectHash: projectStateHash(root),
      scope: "recalibration",
      files: [{
        path: "books/book-01/voice-audits.yaml",
        content: stringifyYaml({ schema_version: "1.0.0", audits: [] }),
      }],
    });
    const audits = readFileSync(join(root, "books", "book-01", "voice-audits.yaml"), "utf8");
    assert.match(audits, /scope: recalibration/);
    assert.equal(readProject(root).current_stage, beforeStage);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
'''
if 'explicit recalibration through research-update appends evidence' not in text:
    integration.write_text(text + recalibration_test, encoding='utf-8')

# Add a CLI smoke test proving no-baseline output and no project mutation.
(root / 'tests/voice-audit-command.test.ts').write_text('''import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeProject } from "../src/project/store.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("audit:voice reports no baseline and does not mutate the project", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-phase5-cli-"));
  try {
    const root = initializeProject(parent, { projectName: "Phase 5 CLI", projectType: "standalone", profile: "thriller" });
    const projectPath = join(root, "PROJECT.yaml");
    const auditPath = join(root, "books", "book-01", "voice-audits.yaml");
    const beforeProject = readFileSync(projectPath, "utf8");
    const beforeAudits = readFileSync(auditPath, "utf8");
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/voice-audit.ts", root], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout) as { status: string; message: string };
    assert.equal(output.status, "no-baseline");
    assert.match(output.message, /baseline/i);
    assert.equal(readFileSync(projectPath, "utf8"), beforeProject);
    assert.equal(readFileSync(auditPath, "utf8"), beforeAudits);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
''', encoding='utf-8')
