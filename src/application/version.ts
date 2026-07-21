import { defaultQualityProjectState } from "../domain/quality-profile.js";
import { stringifyYaml } from "../infrastructure/yaml.js";
import { readProject } from "../project/store.js";
import { applyGuidedProjectEvent } from "./handoff.js";
import { NOVEL_FORGE_VERSION, versionFindings, type VersionFinding } from "./version-core.js";

export { NOVEL_FORGE_VERSION, versionFindings, type VersionFinding };

export function upgradeProjectVersion(root: string): string {
  const project = structuredClone(readProject(root));
  project.novel_forge_version = NOVEL_FORGE_VERSION;
  project.quality ??= defaultQualityProjectState();
  applyGuidedProjectEvent(root, [{ path: "PROJECT.yaml", content: stringifyYaml(project) }], "Novel Forge: upgrade project metadata", { lastAction: `Upgraded project metadata to ${NOVEL_FORGE_VERSION}` });
  return NOVEL_FORGE_VERSION;
}
