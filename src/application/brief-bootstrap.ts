import { basename, extname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { DecisionLedgerSchema, IntakeSchema, type DecisionLedger, type IntakeState } from "../domain/v1-4-schemas.js";
import { readText } from "../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../infrastructure/yaml.js";
import { readProject } from "../project/store.js";
import { applyNovelEvent, type NovelEventResult } from "./events.js";
import { inferAssumption, recordWriterDecision } from "./intake.js";
import { projectStateHash } from "./project-hash.js";

export interface ParsedAuthorBrief {
  originalIdea: string;
  language: string | null;
  audience: string | null;
  profile: string | null;
  targetWords: number | null;
  seedElements: string[];
  missing: string[];
}

export interface BriefBootstrapOptions {
  profile: string;
  targetWords: number;
  decidedAt?: string;
}

function field(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim() || null;
}

function section(text: string, label: string): string {
  const lines = text.split("\n");
  let collecting = false;
  const collected: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      if (collecting) break;
      collecting = heading[1]?.trim().toLocaleLowerCase() === label.trim().toLocaleLowerCase();
      continue;
    }
    if (collecting) collected.push(line);
  }
  return collected.join("\n").trim();
}

function firstParagraph(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .find((item) => item && !/^(?:language|audience|profile|target words)\s*:/im.test(item)) ?? "";
}

export function parseAuthorBrief(text: string): ParsedAuthorBrief {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("Author brief is empty.");
  const ideaSection = section(normalized, "Idea");
  const originalIdea = (ideaSection.split(/\n\s*\n/)[0] ?? "").trim() || firstParagraph(normalized);
  if (!originalIdea) throw new Error("Author brief must contain an idea.");
  const language = field(normalized, "Language");
  const audience = field(normalized, "Audience");
  const profile = field(normalized, "Profile");
  const targetRaw = field(normalized, "Target Words");
  const targetWords = targetRaw && /^\d+$/.test(targetRaw) ? Number.parseInt(targetRaw, 10) : null;
  const seedSection = section(normalized, "Seed Elements");
  const seedElements = [...new Set(seedSection.split("\n").map((item) => item.replace(/^\s*[-*+]\s*/, "").trim()).filter(Boolean))];
  const missing = [
    !language ? "language" : null,
    !audience ? "audience" : null,
    !profile ? "profile" : null,
    targetWords === null ? "target_words" : null,
  ].filter((item): item is string => Boolean(item));
  return { originalIdea, language, audience, profile, targetWords, seedElements, missing };
}

function nextBriefId(intake: IntakeState): string {
  const maximum = intake.authorized_briefs.reduce((current, item) => {
    const value = Number(item.id.match(/^BRIEF-(\d+)$/)?.[1] ?? 0);
    return Math.max(current, value);
  }, 0);
  return `BRIEF-${String(maximum + 1).padStart(3, "0")}`;
}

function activeDecisionId(ledger: DecisionLedger, subject: string): string | null {
  const replaced = new Set(ledger.decisions.map((item) => item.replaces).filter((item): item is string => Boolean(item)));
  return ledger.decisions.find((item) => item.scope === "project" && item.subject === subject && !replaced.has(item.id))?.id ?? null;
}

function writeDecision(ledger: DecisionLedger, subject: string, choice: string, decidedAt: string, evidenceRef: string): DecisionLedger {
  return recordWriterDecision(ledger, {
    scope: "project",
    subject,
    choice,
    decidedAt,
    evidenceRefs: [evidenceRef],
    replaces: activeDecisionId(ledger, subject),
  });
}

export function bootstrapProjectFromBrief(root: string, sourcePath: string, options: BriefBootstrapOptions): NovelEventResult {
  const absolute = resolve(sourcePath);
  const extension = extname(absolute).toLowerCase();
  if (!new Set([".md", ".markdown", ".txt"]).has(extension)) throw new Error("Brief source must be Markdown or text.");
  const source = readFileSync(absolute, "utf8");
  const parsed = parseAuthorBrief(source);
  const intakePath = join(root, "series", "intake.yaml");
  const ledgerPath = join(root, "series", "decision-ledger.yaml");
  const intake = parseYaml<IntakeState>(readText(intakePath) ?? "", IntakeSchema, "series/intake.yaml");
  let ledger = parseYaml<DecisionLedger>(readText(ledgerPath) ?? "", DecisionLedgerSchema, "series/decision-ledger.yaml");
  const briefId = nextBriefId(intake);
  const evidenceRef = `authorized-brief:${briefId}`;
  const decidedAt = options.decidedAt ?? new Date().toISOString();

  intake.original_idea = parsed.originalIdea;
  intake.authorized_briefs.push({ id: briefId, path: absolute, label: basename(absolute) });
  intake.unresolved_blockers = [];

  ledger = writeDecision(ledger, "profile", parsed.profile ?? options.profile, decidedAt, evidenceRef);
  ledger = writeDecision(ledger, "target_words", String(parsed.targetWords ?? options.targetWords), decidedAt, evidenceRef);

  if (parsed.language) ledger = writeDecision(ledger, "language", parsed.language, decidedAt, evidenceRef);
  else {
    ledger = inferAssumption(ledger, {
      scope: "project", subject: "language", value: "English", source: { type: "inference", path: evidenceRef }, confidence: "low", affects: ["voice-profile", "book-plan"],
    });
    const assumption = ledger.assumptions.at(-1)!;
    intake.inferred.language = { value: String(assumption.value), assumption_id: assumption.id };
    intake.unresolved_blockers.push("Confirm manuscript language.");
  }

  if (parsed.audience) ledger = writeDecision(ledger, "audience", parsed.audience, decidedAt, evidenceRef);
  else {
    ledger = inferAssumption(ledger, {
      scope: "project", subject: "audience", value: `${options.profile} readers`, source: { type: "inference", path: evidenceRef }, confidence: "low", affects: ["book-plan", "reader-strategy"],
    });
    const assumption = ledger.assumptions.at(-1)!;
    intake.inferred.audience = { value: String(assumption.value), assumption_id: assumption.id };
    intake.unresolved_blockers.push("Confirm target audience.");
  }

  const project = readProject(root);
  return applyNovelEvent(root, {
    eventType: "intake-update",
    expectedStage: project.current_stage,
    expectedProjectHash: projectStateHash(root),
    files: [
      { path: "series/intake.yaml", content: stringifyYaml(intake) },
      { path: "series/decision-ledger.yaml", content: stringifyYaml(ledger) },
    ],
    scope: "authorized-brief-bootstrap",
  });
}
