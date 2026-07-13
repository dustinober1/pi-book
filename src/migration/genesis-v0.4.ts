import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ProjectSchema, type ProfileId, type ProjectState } from "../domain/schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { applyTransaction } from "../infrastructure/transaction.js";
import { projectTemplateFiles } from "../project/templates.js";

function copyIfExists(source: string, destination: string): boolean {
  if (!existsSync(source)) return false;
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
  return true;
}

function collectArtifact(root: string, names: string[]): string {
  return names
    .map((name) => readText(join(root, "artifacts", name)))
    .filter((value): value is string => Boolean(value))
    .join("\n\n---\n\n");
}

function projectNameFromLegacy(root: string): string {
  const state = readText(join(root, "PROJECT_STATE.yaml")) ?? "";
  return state.match(/^project_name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? basename(root);
}

export interface MigrationResult {
  root: string;
  preserved: string[];
  mapped: string[];
  reportPath: string;
}

export function migrateGenesisProject(root: string, profile: ProfileId): MigrationResult {
  if (!existsSync(join(root, "PROJECT_STATE.yaml"))) {
    throw new Error("This directory does not contain PROJECT_STATE.yaml and is not a Genesis v0.4 project.");
  }
  if (existsSync(join(root, "PROJECT.yaml"))) throw new Error("This project is already in Novel Forge format.");

  const projectName = projectNameFromLegacy(root);
  const legacyRoot = join(root, "legacy", "genesis-v0.4");
  mkdirSync(legacyRoot, { recursive: true });
  const preserved: string[] = [];
  for (const name of ["PROJECT_STATE.yaml", "ASSUMPTIONS.md", "STATUS.md", "artifacts", "evaluations", "delivery"]) {
    if (copyIfExists(join(root, name), join(legacyRoot, name))) preserved.push(name);
  }

  const templates = projectTemplateFiles({ projectName, projectType: "open-ended-series", profile });
  const voice = collectArtifact(root, [
    "author-intent.md", "taste-profile.md", "risk-budget.md", "voice-bible.md",
    "author-voice-fingerprint.md", "human-source-bank.md", "over-polish-audit.md",
  ]);
  if (voice) templates["series/voice-profile.md"] = `# Migrated Voice Profile\n\nstatus: pending\n\n${voice}`;

  const seriesBible = collectArtifact(root, [
    "series-bible.md", "series-arc-map.md", "series-timeline.md", "character-state-matrix.md", "canon-lock.md",
  ]);
  if (seriesBible) templates["series/series-bible.md"] = `# Migrated Series Material\n\n${seriesBible}`;

  const outline = collectArtifact(root, [
    "05-outline.md", "causality-chain.md", "05-subplot-map.md", "reader-promise-tracker.md",
    "publication-shape.md", "chapter-production-queue.md",
  ]);
  if (outline) templates["books/book-01/book-bible.md"] += `\n\n## Legacy architecture material\n\n${outline}`;

  const review = collectArtifact(root, [
    "08-adversarial-audit.md", "narrative-fingerprint-audit.md", "ai-tell-mitigation-audit.md",
    "subtext-audit.md", "ear-pass.md", "revision-tickets.md",
  ]);
  if (review) templates["books/book-01/review-report.md"] = `# Migrated Review Material\n\n${review}`;

  const project = parseYaml<ProjectState>(templates["PROJECT.yaml"] ?? "", ProjectSchema, "migrated PROJECT.yaml");
  project.migration_history.push(new Date().toISOString());
  templates["PROJECT.yaml"] = stringifyYaml(project);

  applyTransaction(
    root,
    Object.entries(templates).map(([path, content]) => ({ path, content })),
    { gitCheckpoint: false },
  );

  const oldChapters = join(root, "manuscript", "chapters");
  const newChapters = join(root, "books", "book-01", "manuscript", "chapters");
  mkdirSync(newChapters, { recursive: true });
  if (existsSync(oldChapters)) {
    for (const entry of readdirSync(oldChapters, { withFileTypes: true })) {
      if (entry.isFile()) cpSync(join(oldChapters, entry.name), join(newChapters, entry.name));
    }
  }
  mkdirSync(join(root, "research", "notes"), { recursive: true });

  const mapped = ["voice profile", "series material", "book architecture", "review material", "manuscript chapters"];
  const reportPath = join(root, "MIGRATION_REPORT.md");
  writeFileSync(
    reportPath,
    [
      "# Genesis v0.4 to Novel Forge Migration", "",
      `- Project: ${projectName}`,
      `- Profile: ${profile}`,
      `- Migrated: ${new Date().toISOString()}`,
      "", "## Preserved legacy paths", "", ...preserved.map((item) => `- legacy/genesis-v0.4/${item}`),
      "", "## Mapped material", "", ...mapped.map((item) => `- ${item}`),
      "", "## Required human review", "",
      "- Approve the consolidated voice profile.",
      "- Convert legacy prose notes into structured canon and story-thread entries.",
      "- Rebuild the active chapter queue before automated drafting.",
      "- Review migrated tickets before closing any issue.", "",
    ].join("\n"),
    "utf8",
  );
  return { root, preserved, mapped, reportPath };
}
