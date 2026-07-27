import { dialogueVoiceFindings } from "../../dialogue-voice.js";
import type { LintFinding, LintRule, ProseLintInput } from "../types.js";

const VERSION = "1.0.0";

/**
 * Surfaces per-character dialogue uniformity through the same rule pipeline as
 * every other style tell, so it reaches both a draft-chapter event and act
 * review without a second delivery path.
 *
 * Reported under the existing `style-pattern` class: it is a property of how the
 * prose sounds, and reusing the class keeps report rendering, ordering and
 * evidence-budget selection unchanged.
 */
function firstLocation(input: ProseLintInput, speakers: readonly string[]): { path: string; line: number; excerpt: string } | null {
  for (const document of input.documents) {
    for (const paragraph of document.paragraphs) {
      if (!speakers.some((speaker) => paragraph.text.includes(speaker))) continue;
      return { path: document.path, line: paragraph.line, excerpt: paragraph.text.trim().slice(0, 160) };
    }
  }
  const document = input.documents[0];
  const paragraph = document?.paragraphs[0];
  if (document === undefined || paragraph === undefined) return null;
  return { path: document.path, line: paragraph.line, excerpt: paragraph.text.trim().slice(0, 160) };
}

export const dialogueVoiceRule: LintRule = {
  id: "style-pattern/character-voice-uniformity",
  version: VERSION,
  run(input) {
    const text = input.documents.map((document) => document.text).join("\n\n");
    const findings: LintFinding[] = [];
    for (const finding of dialogueVoiceFindings(text)) {
      const location = firstLocation(input, finding.speakers);
      if (location === null) continue;
      findings.push({
        ruleId: this.id,
        ruleVersion: VERSION,
        class: "style-pattern",
        confidence: "review",
        location: { path: location.path, line: location.line },
        excerpt: location.excerpt,
        message: finding.message,
        evidence: { speakers: finding.speakers.join(" / "), ...finding.metrics },
        reviewAction: "Read both characters' dialogue side by side. If they should sound different, give each a distinct register, rhythm, or vocabulary rather than distinct content alone.",
      });
    }
    return findings;
  },
};

export const dialogueVoiceRules: readonly LintRule[] = [dialogueVoiceRule];
