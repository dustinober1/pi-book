import type { ProfileId } from "../domain/schemas.js";
import type { NovelProfile } from "./types.js";
import { thrillerProfile } from "./thriller.js";
import { romantasyProfile } from "./romantasy.js";
import { historicalFictionProfile } from "./historical-fiction.js";

const profiles: Record<ProfileId, NovelProfile> = {
  thriller: thrillerProfile,
  romantasy: romantasyProfile,
  "historical-fiction": historicalFictionProfile,
};

export function getProfile(id: ProfileId): NovelProfile {
  return profiles[id];
}

export function listProfiles(): NovelProfile[] {
  return Object.values(profiles);
}
