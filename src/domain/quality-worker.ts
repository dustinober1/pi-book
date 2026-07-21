import type { DecodingPolicy } from "./model-execution-profile.js";
import type { ModelJobType } from "./model-job.js";
import type { ModelCallReport, QualityPassKind } from "./run-report.js";

export type QualityThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface QualityWorkerRequest {
  callId: string;
  stage: string;
  chapter?: number;
  pass: QualityPassKind;
  jobType?: ModelJobType;
  prompt: string;
  context?: string;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
  decoding?: DecodingPolicy;
  timeoutMs: number;
}

export interface QualityModelSelection {
  provider?: string;
  model: string;
}

export interface QualityModelCapacity {
  provider: string;
  model: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
}

export interface QualityWorkerResult {
  text: string;
  usage: ModelCallReport;
}

export interface QualityWorker {
  run(request: QualityWorkerRequest, signal?: AbortSignal): Promise<QualityWorkerResult>;
  resolveModelCapacity(selection: QualityModelSelection, signal?: AbortSignal): Promise<QualityModelCapacity | null>;
}
