import type { ProjectState } from "../domain/schemas.js";

export const NOVEL_FORGE_VERSION = "1.6.1" as const;

export interface VersionFinding {
  severity: "blocker" | "warning";
  message: string;
}

function parts(value: string): [number, number, number] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    const difference = leftPart - rightPart;
    if (difference !== 0) return difference;
  }
  return 0;
}

export function versionFindings(project: ProjectState): VersionFinding[] {
  const installed = parts(NOVEL_FORGE_VERSION)!;
  if (!project.novel_forge_version) {
    return [{ severity: "warning", message: "PROJECT.yaml is missing novel_forge_version; run /novel and choose Upgrade project metadata." }];
  }
  const recorded = parts(project.novel_forge_version);
  if (!recorded) {
    return [{ severity: "warning", message: `PROJECT.yaml has malformed novel_forge_version ${project.novel_forge_version}; run the metadata upgrade.` }];
  }
  const order = compare(recorded, installed);
  if (order > 0) {
    return [{ severity: "blocker", message: `This project was written by newer Novel Forge ${project.novel_forge_version}; installed version is ${NOVEL_FORGE_VERSION}.` }];
  }
  if (order < 0) {
    return [{ severity: "warning", message: `This project records older Novel Forge ${project.novel_forge_version}; upgrade metadata to ${NOVEL_FORGE_VERSION}.` }];
  }
  return [];
}
