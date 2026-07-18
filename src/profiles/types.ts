import type { TSchema } from "@sinclair/typebox";
import type { ChapterPacket, GenreConfig, PlotGridState, ProfileId } from "../domain/schemas.js";
export interface ProfileFinding { severity: "blocker" | "high" | "medium" | "low"; category: string; message: string }
export interface NovelProfile {
  id: ProfileId; label: string; profileFieldsSchema: TSchema; genreSettingsSchema: TSchema; genreRequirementsSchema: TSchema;
  defaultGenreConfig(): GenreConfig; planningQuestions: readonly string[]; chapterPacketRequirements: readonly string[];
  bookPlanRules: readonly string[]; bookPlanOutputs: readonly string[];
  milestoneReviewLanes: readonly string[]; draftingRules: readonly string[];
  validatePacket(packet: ChapterPacket): ProfileFinding[]; validateGenreConfig(config: GenreConfig): ProfileFinding[];
  validatePlot(plot: PlotGridState): ProfileFinding[]; endingRules: readonly string[];
}
