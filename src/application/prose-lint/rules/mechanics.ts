import type { LintFinding, LintRule, ManuscriptDocument, ProseLintInput } from "../types.js";

const VERSION = "1.0.0";
const excerptLimit = 160;
const headingPattern = /^\s{0,3}#{1,6}(?:\s|$)/;
const sceneBreaks = new Set(["***", "---", "___"]);

function excerpt(line: string): string {
  return line.trim().slice(0, excerptLimit);
}

function eligibleLines(document: ManuscriptDocument): Array<{ line: string; number: number }> {
  return document.scanText.split("\n").flatMap((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "" || headingPattern.test(line) || sceneBreaks.has(trimmed)) return [];
    return [{ line, number: index + 1 }];
  });
}

function finding(
  ruleId: string,
  document: ManuscriptDocument,
  line: string,
  lineNumber: number,
  message: string,
  evidence: LintFinding["evidence"],
): LintFinding {
  return {
    ruleId,
    ruleVersion: VERSION,
    class: "mechanical",
    confidence: "high",
    location: { path: document.path, line: lineNumber },
    excerpt: excerpt(line),
    message,
    evidence,
    reviewAction: "Review the marked manuscript text and repair it if it is unintended.",
  };
}

const doubledWordRule: LintRule = {
  id: "mechanics/doubled-word",
  version: VERSION,
  run(input: ProseLintInput): LintFinding[] {
    const findings: LintFinding[] = [];
    for (const document of input.documents) {
      for (const { line, number } of eligibleLines(document)) {
        const match = /(?<![\p{L}\p{N}'’-])([\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*)\s+\1(?![\p{L}\p{N}'’-])/iu.exec(line);
        if (match?.[1] !== undefined) {
          findings.push(finding(this.id, document, line, number, "Adjacent word is repeated.", { word: match[1] }));
        }
      }
    }
    return findings;
  },
};

const punctuationSpacingRule: LintRule = {
  id: "mechanics/punctuation-spacing",
  version: VERSION,
  run(input: ProseLintInput): LintFinding[] {
    const findings: LintFinding[] = [];
    for (const document of input.documents) {
      for (const { line, number } of eligibleLines(document)) {
        const match = /\s+([,.;!?;:])/.exec(line);
        if (match?.[1] !== undefined) {
          findings.push(finding(this.id, document, line, number, "Whitespace appears before punctuation.", { punctuation: match[1] }));
        }
      }
    }
    return findings;
  },
};

const repeatedPunctuationRule: LintRule = {
  id: "mechanics/repeated-punctuation",
  version: VERSION,
  run(input: ProseLintInput): LintFinding[] {
    const findings: LintFinding[] = [];
    for (const document of input.documents) {
      for (const { line, number } of eligibleLines(document)) {
        const match = /[!?]{4,}/.exec(line);
        if (match?.[0] !== undefined) {
          findings.push(finding(this.id, document, line, number, "Repeated question or exclamation punctuation exceeds three marks.", { marks: match[0], count: match[0].length }));
        }
      }
    }
    return findings;
  },
};

const draftingMarkerRule: LintRule = {
  id: "mechanics/drafting-marker",
  version: VERSION,
  run(input: ProseLintInput): LintFinding[] {
    const findings: LintFinding[] = [];
    for (const document of input.documents) {
      for (const { line, number } of eligibleLines(document)) {
        const marker = /\[\[(?:TODO|FIXME):[^\]\r\n]+\]\]/.exec(line);
        const markerText = marker?.[0] ?? (line.trim() === "TKTK" ? "TKTK" : undefined);
        if (markerText !== undefined) {
          findings.push(finding(this.id, document, line, number, "Unresolved drafting marker remains.", { marker: markerText }));
        }
      }
    }
    return findings;
  },
};

const unbalancedPunctuationRule: LintRule = {
  id: "mechanics/unbalanced-punctuation",
  version: VERSION,
  run(input: ProseLintInput): LintFinding[] {
    const findings: LintFinding[] = [];
    for (const document of input.documents) {
      for (const { line, number } of eligibleLines(document)) {
        const pairs = [
          { open: "(", close: ")", label: "parenthesis" },
          { open: "[", close: "]", label: "bracket" },
        ];
        const imbalanced = pairs.filter(({ open, close }) => {
          const opens = [...line].filter((character) => character === open).length;
          const closes = [...line].filter((character) => character === close).length;
          return opens !== closes;
        });
        if (imbalanced.length > 0) {
          findings.push(finding(this.id, document, line, number, "Paired punctuation is unbalanced on this line.", {
            pairs: imbalanced.map((pair) => pair.label).join(", "),
          }));
        }
      }
    }
    return findings;
  },
};

export const mechanicalRules: readonly LintRule[] = [
  doubledWordRule,
  punctuationSpacingRule,
  repeatedPunctuationRule,
  draftingMarkerRule,
  unbalancedPunctuationRule,
];
