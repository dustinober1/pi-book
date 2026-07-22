import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderQualityJobPlanManifest,
  type QualityJobPlan,
} from "../application/quality/job-plan.js";

function safeRunId(runId: string): string {
  const normalized = runId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized) || normalized.includes("..")) {
    throw new Error("Quality job plan run ID is invalid.");
  }
  return normalized;
}

export function qualityJobPlanManifestRelativePath(runId: string): string {
  return `.pi-book/runs/${safeRunId(runId)}/quality-job-plan.json`;
}

export function writeQualityJobPlanManifest(root: string, runId: string, plan: QualityJobPlan): string {
  const safeId = safeRunId(runId);
  const directory = join(root, ".pi-book", "runs", safeId);
  const path = join(directory, "quality-job-plan.json");
  const temporary = join(directory, `.quality-job-plan.${process.pid}.${randomUUID()}.tmp`);
  const content = renderQualityJobPlanManifest(plan);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return qualityJobPlanManifestRelativePath(safeId);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write the quality job plan manifest.", { cause: error });
  }
}
