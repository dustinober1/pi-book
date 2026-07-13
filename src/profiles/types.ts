import type { ChapterPacket, GenreConfig, ProfileId } from "../domain/schemas.js";

export interface ProfileFinding {
  severity: "blocker" | "high" | "medium" | "low";
  category: string;
  message: string;
}

export interface NovelProfile {
  id: ProfileId;
  label: string;
  defaultGenreConfig(): GenreConfig;
  planningQuestions: readonly string[];
  chapterPacketRequirements: readonly string[];
  milestoneReviewLanes: readonly string[];
  draftingRules: readonly string[];
  validatePacket(packet: ChapterPacket): ProfileFinding[];
  endingRules: readonly string[];
}
