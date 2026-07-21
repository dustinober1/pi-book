import type { ModelCallReport, QualityPassKind } from "./run-report.js";

export type QualityThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface QualityWorkerRequest {
  callId: string;
  stage: string;
  chapter?: number;
  pass: QualityPassKind;
  prompt: string;
  context?: string;
  provider?: string;
  model?: string;
  thinking?: QualityThinkingLevel;
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
