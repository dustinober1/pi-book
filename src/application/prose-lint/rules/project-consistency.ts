import { basename } from "node:path";
import type { LintFinding, LintRule, ManuscriptDocument, ProjectLintContext, ProseLintInput } from "../types.js";

const VERSION = "1.0.0";
const EXCERPT_LIMIT = 160;
const spellingPairs = [["color", "colour"], ["favor", "favour"], ["center", "centre"], ["theater", "theatre"], ["defense", "defence"], ["license", "licence"], ["practice", "practise"], ["gray", "grey"], ["analyze", "analyse"], ["traveler", "traveller"]] as const;
const temporalPattern = /\b(tomorrow|yesterday|tonight|next (?:morning|week|month|year)|last (?:night|week|month|year)|soon|in \d+ (?:minutes|hours|days|weeks)|when the time came)\b/gi;
const headingPattern = /^\s{0,3}#{1,6}(?:\s|$)/;
const sceneBreaks = new Set(["***", "---", "___"]);

interface LocatedLine { document: ManuscriptDocument; line: string; number: number }

function excerpt(text: string): string {
  return text.trim().slice(0, EXCERPT_LIMIT);
}

function proseLines(document: ManuscriptDocument): LocatedLine[] {
  return document.scanText.split("\n").flatMap((line, index) => {
    const trimmed = line.trim();
    return trimmed === "" || headingPattern.test(line) || sceneBreaks.has(trimmed)
      ? []
      : [{ document, line, number: index + 1 }];
  });
}

function allLines(input: ProseLintInput): LocatedLine[] {
  return input.documents.flatMap(proseLines);
}

function location(line: LocatedLine): { path: string; line: number } {
  return { path: line.document.path, line: line.number };
}

function finding(
  ruleId: string,
  confidence: LintFinding["confidence"],
  at: { path: string; line?: number },
  text: string,
  message: string,
  evidence: LintFinding["evidence"],
  reviewAction: string,
): LintFinding {
  return { ruleId, ruleVersion: VERSION, class: "consistency", confidence, location: at, excerpt: excerpt(text), message, evidence, reviewAction };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(value: string, flags = "iu"): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, flags);
}

const spellingRule: LintRule = {
  id: "consistency/spelling",
  version: VERSION,
  run(input) {
    const lines = allLines(input);
    const findings: LintFinding[] = [];
    for (const [first, second] of spellingPairs) {
      const firstUses = lines.filter((item) => phrasePattern(first).test(item.line));
      const secondUses = lines.filter((item) => phrasePattern(second).test(item.line));
      if (firstUses.length === 0 || secondUses.length === 0) continue;
      const at = firstUses[0] as LocatedLine;
      findings.push(finding(this.id, "medium", location(at), at.line, `Mixed spelling variants ${first}/${second} appear in this manuscript scope.`, {
        pair: `${first}/${second}`,
        firstLocations: firstUses.map((item) => `${item.document.path}:${item.number}`).join(", "),
        secondLocations: secondUses.map((item) => `${item.document.path}:${item.number}`).join(", "),
      }, "Confirm the intended spelling system and preserve intentional quoted or character-specific variants."));
    }
    return findings;
  },
};

const temporalRule: LintRule = {
  id: "consistency/temporal-reference",
  version: VERSION,
  run(input) {
    const findings: LintFinding[] = [];
    for (const item of allLines(input)) {
      for (const match of item.line.matchAll(temporalPattern)) {
        findings.push(finding(this.id, "review", location(item), item.line, "Relative temporal marker requires chronology review.", {
          marker: match[0],
        }, "Verify this marker against the manuscript chronology; its presence alone is not an error."));
      }
    }
    return findings;
  },
};

const structureRule: LintRule = {
  id: "consistency/chapter-structure",
  version: VERSION,
  run(input) {
    const findings: LintFinding[] = [];
    const totalWords = input.documents.reduce((total, document) => total + document.wordCount, 0);
    for (const document of input.documents) {
      if (/\b(?:part|chapter)[-_ ]?\d+[abc]\b/i.test(basename(document.path))) {
        findings.push(finding(this.id, "review", { path: document.path }, document.path, "Filename resembles unresolved A/B/C assembly scaffolding.", {
          wordCount: document.wordCount,
        }, "Confirm that the split chapter filename is intentional."));
      }
      if (document.wordCount < 500) {
        findings.push(finding(this.id, "review", { path: document.path }, document.path, `Chapter file is very short at ${document.wordCount} words.`, {
          wordCount: document.wordCount,
          threshold: 500,
        }, "Confirm that this chapter length is intentional."));
      }
      const share = totalWords === 0 ? 0 : document.wordCount / totalWords;
      if (input.documents.length > 4 && share > 0.2) {
        findings.push(finding(this.id, "review", { path: document.path }, document.path, "Chapter holds more than 20% of manuscript words.", {
          wordCount: document.wordCount,
          manuscriptShare: Math.round(share * 10_000) / 10_000,
        }, "Review the chapter's structural weight in manuscript context."));
      }
    }
    return findings;
  },
};

function contextLocation(context: ProjectLintContext, chapter?: number): { path: string } {
  const path = chapter === undefined
    ? context.chapterFiles[0]?.path
    : context.chapterFiles.find((item) => item.number === chapter)?.path;
  return { path: path ?? "." };
}

const chapterSequenceRule: LintRule = {
  id: "consistency/chapter-sequence",
  version: VERSION,
  requirements: { projectContext: [] },
  run(input) {
    const context = input.projectContext;
    if (context === undefined) return [];
    const findings: LintFinding[] = [];
    const counts = new Map<number, number>();
    for (const chapter of context.chapterFiles) {
      if (chapter.number === null) continue;
      counts.set(chapter.number, (counts.get(chapter.number) ?? 0) + 1);
      if ((counts.get(chapter.number) ?? 0) === 2) findings.push(finding(this.id, "high", { path: chapter.path }, chapter.path, `Duplicate manuscript Chapter ${chapter.number}.`, {
        chapter: chapter.number,
      }, "Resolve the duplicate numbered chapter files before relying on sequence-based review."));
    }
    const maximum = Math.max(0, ...counts.keys());
    for (let number = 1; number <= maximum; number += 1) {
      if (!counts.has(number)) findings.push(finding(this.id, "high", contextLocation(context, number), "", `Missing manuscript Chapter ${number}.`, {
        chapter: number,
      }, "Confirm the manuscript sequence or restore the missing numbered chapter."));
    }
    return findings;
  },
};

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) seen.has(value) ? repeated.add(value) : seen.add(value);
  return [...repeated];
}

const duplicateIdRule: LintRule = {
  id: "consistency/duplicate-id",
  version: VERSION,
  requirements: { projectContext: ["canon", "threads", "sources", "research"] },
  run(input) {
    const context = input.projectContext;
    if (context === undefined) return [];
    return [
      ...duplicates(context.canonIds).map((id) => ({ id, kind: "canon", path: "series/canon.yaml" })),
      ...duplicates(context.threadIds).map((id) => ({ id, kind: "story thread", path: "series/story-threads.yaml" })),
      ...duplicates(context.sourceIds).map((id) => ({ id, kind: "research source", path: "research/source-register.yaml" })),
      ...duplicates(context.researchIds).map((id) => ({ id, kind: "research ledger", path: `books/${context.bookId}/research-ledger.yaml` })),
    ].map((item) => finding(this.id, "high", { path: item.path }, item.id, `Duplicate ${item.kind} id: ${item.id}.`, {
      id: item.id,
      kind: item.kind,
    }, "Give every structured record a unique stable identifier."));
  },
};

const relationshipCharactersRule: LintRule = {
  id: "consistency/relationship-characters",
  version: VERSION,
  requirements: { projectContext: ["canon"] },
  run(input) {
    const relationships = input.projectContext?.relationships ?? [];
    return relationships.flatMap((relationship) => {
      const repeated = duplicates(relationship.characters);
      return repeated.length === 0 ? [] : [
        finding(this.id, "high", { path: "series/canon.yaml" }, relationship.id, `Relationship ${relationship.id} repeats a character id.`, {
          relationshipId: relationship.id,
          repeatedCharacters: repeated.join(", "),
        }, "Remove duplicate character identifiers from the structured relationship record."),
      ];
    });
  },
};

const canonNameCaseRule: LintRule = {
  id: "consistency/canon-name-case",
  version: VERSION,
  requirements: { projectContext: ["canon"] },
  run(input) {
    const names = input.projectContext?.canonNames.filter((name) => (name.match(/\p{L}/gu)?.length ?? 0) >= 2) ?? [];
    const findings: LintFinding[] = [];
    for (const item of allLines(input)) {
      for (const name of names) {
        for (const match of item.line.matchAll(phrasePattern(name, "giu"))) {
          if (match[0] === name) continue;
          findings.push(finding(this.id, "medium", location(item), item.line, `Canon-defined name appears with different casing from “${name}”.`, {
            canonName: name,
            observed: match[0],
          }, "Confirm whether the case variation is intentional in context."));
        }
      }
    }
    return findings;
  },
};

const canonNumberRule: LintRule = {
  id: "consistency/canon-number",
  version: VERSION,
  requirements: { projectContext: ["canon"] },
  run(input) {
    const entries = input.projectContext?.canonEntries.filter((entry) => entry.locked) ?? [];
    const findings: LintFinding[] = [];
    for (const entry of entries) {
      const expected: string[] = [...(entry.fact.match(/\b\d+(?:\.\d+)?\b/g) ?? [])];
      if (expected.length === 0) continue;
      const subject = phrasePattern(entry.subject);
      for (const item of allLines(input)) {
        if (!subject.test(item.line)) continue;
        const observed: string[] = [...(item.line.match(/\b\d+(?:\.\d+)?\b/g) ?? [])];
        const divergent = observed.filter((value) => !expected.includes(value));
        if (divergent.length === 0) continue;
        findings.push(finding(this.id, "medium", location(item), item.line, `Possible numeric divergence near locked canon ${entry.id}.`, {
          canonId: entry.id,
          expectedNumbers: expected.join(", "),
          observedNumbers: divergent.join(", "),
        }, "Compare the nearby number with locked canon; another number may be legitimate in context."));
      }
    }
    return findings;
  },
};

const missingReferenceRule: LintRule = {
  id: "consistency/missing-reference",
  version: VERSION,
  requirements: { projectContext: ["canon", "threads", "sources", "research", "queue", "plot"] },
  run(input) {
    const context = input.projectContext;
    if (context === undefined) return [];
    const known = {
      canon: new Set(context.canonIds),
      thread: new Set(context.threadIds),
      source: new Set([...context.sourceIds, ...context.researchIds]),
    };
    const packetFindings = context.packetReferences.flatMap((reference) => known[reference.kind].has(reference.id) ? [] : [
      finding(this.id, "high", contextLocation(context, reference.chapter), "", `Chapter ${reference.chapter} references missing ${reference.kind} ${reference.id}.`, {
        chapter: reference.chapter,
        kind: reference.kind,
        id: reference.id,
      }, "Repair the structured reference before using it as review or drafting context."),
    ]);
    const plotFindings = context.plotThreadReferences.flatMap((reference) => known.thread.has(reference.id) ? [] : [
      finding(this.id, "high", contextLocation(context, reference.chapter), "", `Plot Chapter ${reference.chapter} references missing thread ${reference.id}.`, {
        chapter: reference.chapter,
        kind: "thread",
        id: reference.id,
      }, "Repair the structured plot reference before using it as review or drafting context."),
    ]);
    return [...packetFindings, ...plotFindings];
  },
};

const threadStatusRule: LintRule = {
  id: "consistency/thread-status",
  version: VERSION,
  requirements: { projectContext: ["threads", "queue"] },
  run(input) {
    const context = input.projectContext;
    if (context === undefined) return [];
    const threads = new Map(context.threads.map((thread) => [thread.id, thread.status]));
    return context.packetReferences.flatMap((reference) => {
      if (reference.kind !== "thread" || reference.status !== "ready") return [];
      const status = threads.get(reference.id);
      if (status !== "paid-off" && status !== "abandoned") return [];
      return [finding(this.id, "high", contextLocation(context, reference.chapter), "", `Ready Chapter ${reference.chapter} references ${status} thread ${reference.id}.`, {
        chapter: reference.chapter,
        id: reference.id,
        packetStatus: reference.status,
        threadStatus: status,
      }, "Remove the terminal thread reference or explicitly reopen the structured story thread before drafting.")];
    });
  },
};

export const projectConsistencyRules: readonly LintRule[] = [
  spellingRule,
  temporalRule,
  structureRule,
  chapterSequenceRule,
  duplicateIdRule,
  relationshipCharactersRule,
  canonNameCaseRule,
  canonNumberRule,
  missingReferenceRule,
  threadStatusRule,
];
