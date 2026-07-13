import type { ChapterPacket, GenreConfig } from "../domain/schemas.js";
import type { NovelProfile, ProfileFinding } from "./types.js";

const requiredProfileFields = ["threat_delta", "evidence_delta", "reader_forecast_change", "protagonist_choice"] as const;

export const thrillerProfile: NovelProfile = {
  id: "thriller",
  label: "Thriller",
  defaultGenreConfig(): GenreConfig {
    return {
      schema_version: "1.0.0",
      profile: "thriller",
      settings: {
        thriller_type: "techno",
        suspense_style: "escalating",
        violence_level: "moderate",
        procedural_detail: "high",
        series_model: "recurring-protagonist",
      },
      requirements: {
        visible_external_pressure: true,
        protagonist_agency: "required",
        opposition_positive_case: "required",
        midpoint_state_change: "required",
        climax_reader_legibility: "required",
      },
    };
  },
  planningQuestions: [
    "What is the threat, target, capability, escalation path, and consequence of delay?",
    "What can the opposition plausibly observe, authorize, execute, and conceal?",
    "What evidence exists, who controls it, what does it prove, and what does it not prove?",
    "What false interpretation can a reasonable protagonist or reader hold?",
    "What irreversible choice gives the protagonist ownership of the plot?",
    "What state changes at the midpoint beyond discovering another fact?",
    "What closes in this book and what pressure legitimately continues into the next?",
  ],
  chapterPacketRequirements: requiredProfileFields,
  milestoneReviewLanes: [
    "suspense and pacing",
    "evidence, clues, red herrings, and reveals",
    "protagonist agency and opposition logic",
    "technical and institutional plausibility",
    "continuity and chronology",
    "voice and line quality",
  ],
  draftingRules: [
    "Make threat movement visible in the lived world, not only on screens.",
    "Give discoveries provenance and limits.",
    "Vary scene engines across consecutive chapters.",
    "Make the protagonist choose, risk, sacrifice, or make a costly mistake.",
    "Keep the opposition capable and attached to a defensible value.",
    "Seed the climax mechanism before it becomes operational.",
  ],
  validatePacket(packet: ChapterPacket): ProfileFinding[] {
    const findings: ProfileFinding[] = [];
    for (const field of requiredProfileFields) {
      if (!(field in packet.profile_fields) || packet.profile_fields[field] === "") {
        findings.push({ severity: "blocker", category: "thriller-packet", message: `Missing thriller packet field: ${field}` });
      }
    }
    if (!packet.pressure_movement.trim()) findings.push({ severity: "blocker", category: "pressure", message: "Thriller chapter has no pressure movement." });
    if (!packet.ending_hook.trim()) findings.push({ severity: "high", category: "hook", message: "Thriller chapter has no honest forward hook." });
    return findings;
  },
  endingRules: [
    "Close the immediate battle with decisive external consequence.",
    "Do not let a next-book hook invalidate the present resolution.",
    "Ensure the reader can track the final mechanism and evidence chain.",
    "Let protagonist action, not coincidence, drive the climax.",
  ],
};
