import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapProjectFromBrief, parseAuthorBrief } from "../src/application/brief-bootstrap.js";
import { initializeProject } from "../src/project/store.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { IntakeSchema, DecisionLedgerSchema, type IntakeState, type DecisionLedger } from "../src/domain/v1-4-schemas.js";

test("complete Markdown brief parses explicit author evidence", () => {
  const parsed = parseAuthorBrief(`# The Signal\n\n## Idea\nMara follows a signal no one else can hear.\n\nLanguage: English\nAudience: Adult thriller readers\nProfile: thriller\nTarget Words: 110000\n\n## Seed Elements\n- Mara\n- signal\n`);
  assert.equal(parsed.originalIdea, "Mara follows a signal no one else can hear.");
  assert.equal(parsed.language, "English");
  assert.equal(parsed.audience, "Adult thriller readers");
  assert.equal(parsed.profile, "thriller");
  assert.equal(parsed.targetWords, 110000);
  assert.deepEqual(parsed.seedElements, ["Mara", "signal"]);
  assert.deepEqual(parsed.missing, []);
});

test("brief bootstrap records explicit decisions and leaves the source unchanged", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-brief-bootstrap-"));
  try {
    const root = initializeProject(parent, { projectName: "Brief Bootstrap", projectType: "planned-series", profile: "thriller", targetWords: 110000 });
    const source = join(parent, "author-brief.md");
    const content = `# Brief\n\n## Idea\nMara follows a signal no one else can hear.\n\nLanguage: English\nAudience: Adult thriller readers\nProfile: thriller\nTarget Words: 110000\n`;
    writeFileSync(source, content, "utf8");
    const before = readFileSync(source, "utf8");
    const result = bootstrapProjectFromBrief(root, source, { profile: "thriller", targetWords: 110000, decidedAt: "2026-07-16T12:00:00Z" });
    assert.match(result.gitMessage, /intake-update/);
    assert.equal(readFileSync(source, "utf8"), before);
    const intake = parseYaml<IntakeState>(readFileSync(join(root, "series", "intake.yaml"), "utf8"), IntakeSchema, "intake.yaml");
    const ledger = parseYaml<DecisionLedger>(readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8"), DecisionLedgerSchema, "decision-ledger.yaml");
    assert.equal(intake.original_idea, "Mara follows a signal no one else can hear.");
    assert.equal(intake.authorized_briefs.length, 1);
    assert.ok(ledger.decisions.some((item) => item.subject === "profile" && item.choice === "thriller"));
    assert.ok(ledger.decisions.some((item) => item.subject === "target_words" && item.choice === "110000"));
    assert.ok(ledger.decisions.some((item) => item.subject === "audience"));
    assert.equal(readFileSync(source, "utf8"), content);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("one-sentence idea keeps inferred gaps visible instead of promoting them", () => {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-one-sentence-"));
  try {
    const root = initializeProject(parent, { projectName: "One Sentence", projectType: "standalone", profile: "thriller" });
    const source = join(parent, "idea.txt");
    writeFileSync(source, "Mara hears tomorrow's emergency calls.", "utf8");
    bootstrapProjectFromBrief(root, source, { profile: "thriller", targetWords: 100000, decidedAt: "2026-07-16T12:00:00Z" });
    const intake = parseYaml<IntakeState>(readFileSync(join(root, "series", "intake.yaml"), "utf8"), IntakeSchema, "intake.yaml");
    const ledger = parseYaml<DecisionLedger>(readFileSync(join(root, "series", "decision-ledger.yaml"), "utf8"), DecisionLedgerSchema, "decision-ledger.yaml");
    assert.equal(intake.original_idea, "Mara hears tomorrow's emergency calls.");
    assert.ok(ledger.assumptions.some((item) => item.status === "inferred"));
    assert.ok(intake.unresolved_blockers.length > 0);
    assert.equal(ledger.decisions.some((item) => item.subject === "audience"), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
