import type { ChapterPacket, GenreConfig } from "../domain/schemas.js";
import type { NovelProfile, ProfileFinding } from "./types.js";

const requiredProfileFields = ["fantasy_movement", "romance_movement", "trust_delta", "desire_conflict", "power_balance", "consent_state"] as const;

export const romantasyProfile: NovelProfile = {
  id: "romantasy",
  label: "Romantasy",
  defaultGenreConfig(): GenreConfig {
    return {
      schema_version: "1.0.0",
      profile: "romantasy",
      settings: {
        story_balance: "balanced",
        romance_contract: "central",
        ending_contract: "series-progress",
        heat_level: "open-door",
        fantasy_scale: "epic",
        point_of_view: "dual",
        relationship_structure: "monogamous",
      },
      requirements: {
        protagonist_independent_goal: true,
        character_specific_attraction: true,
        explicit_consent_logic: true,
        magic_cost: true,
        fantasy_conflict_resolution: true,
        declared_ending_contract: true,
      },
    };
  },
  planningQuestions: [
    "Is the book romance-primary, balanced, or fantasy-primary?",
    "What ending contract applies: HEA, HFN, series-progress, or tragic-by-design?",
    "Why are these characters specifically attracted to each other beyond appearance or destiny?",
    "What values, secrets, duties, or wounds make them genuinely incompatible?",
    "How do trust, intimacy, allegiance, and power balance change through the book?",
    "What are the rules, costs, and limits of magic, especially where magic touches intimacy or bonding?",
    "How does the romantic rupture alter the fantasy plot, and how does the fantasy climax test the relationship?",
  ],
  chapterPacketRequirements: requiredProfileFields,
  milestoneReviewLanes: [
    "romantic arc and emotional causality",
    "fantasy plot and worldbuilding",
    "magic continuity and cost",
    "consent, power, and intimacy logic",
    "character independence and relationship differentiation",
    "voice, chemistry, dialogue, and line quality",
    "romance/fantasy pacing balance",
  ],
  draftingRules: [
    "Keep both protagonists active outside the relationship.",
    "Build attraction from observation, friction, competence, vulnerability, and values.",
    "Treat consent and power asymmetry as scene logic, not a late disclaimer.",
    "Do not let magic automatically solve emotional conflict.",
    "Make rupture follow established choices or values rather than a removable misunderstanding.",
    "Advance fantasy and romance arcs in relation, without requiring every scene to advance both equally.",
  ],
  validatePacket(packet: ChapterPacket): ProfileFinding[] {
    const findings: ProfileFinding[] = [];
    for (const field of requiredProfileFields) {
      if (!(field in packet.profile_fields) || packet.profile_fields[field] === "") {
        findings.push({ severity: "blocker", category: "romantasy-packet", message: `Missing romantasy packet field: ${field}` });
      }
    }
    if (!packet.relationship_movement.trim() && !packet.profile_fields["romance_movement"]) {
      findings.push({ severity: "high", category: "romance-arc", message: "Romantasy packet does not define relationship movement." });
    }
    return findings;
  },
  endingRules: [
    "Honor the declared romance ending contract.",
    "Resolve the fantasy conflict on its own causal terms.",
    "Do not use intimacy as a substitute for trust repair.",
    "Preserve earned emotional payoff even when a series pressure remains open.",
  ],
};
