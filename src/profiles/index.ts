import type { ProfileId } from "../domain/schemas.js";
import type { NovelProfile } from "./types.js";
import { thrillerProfile } from "./thriller.js";
import { romantasyProfile } from "./romantasy.js";

const profiles: Record<ProfileId, NovelProfile> = {
  thriller: thrillerProfile,
  romantasy: romantasyProfile,
};

export function getProfile(id: ProfileId): NovelProfile {
  return profiles[id];
}

export function listProfiles(): NovelProfile[] {
  return Object.values(profiles);
}
