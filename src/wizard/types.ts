export type WizardWorkflow = "adoption" | "readers" | "packaging" | "next-book" | "research" | "premise";

export interface WizardProposalEnvelope<T = unknown> {
  proposal_id: string;
  workflow: WizardWorkflow;
  action: string;
  expected_stage: string;
  expected_project_hash: string;
  payload: T;
}

export interface WizardActionRegistry {
  snapshot(workflow: WizardWorkflow): Promise<unknown> | unknown;
  preview(workflow: WizardWorkflow, action: string, payload: unknown): Promise<unknown> | unknown;
  apply(envelope: WizardProposalEnvelope): Promise<unknown> | unknown;
}

export interface WizardSource {
  sourceId: string;
  absolutePath: string;
  originalName: string;
  mediaType: string;
  byteSize: number;
}

export interface WizardInitialSource {
  absolutePath: string;
  originalName?: string;
  mediaType?: string;
}

export interface WizardSessionOptions {
  projectRoot: string;
  registry: WizardActionRegistry;
  workflow?: WizardWorkflow;
  idleTimeoutMs?: number;
  uploadLimitBytes?: number;
  openBrowser?: boolean;
  initialSources?: WizardInitialSource[];
}

export interface WizardSessionHandle {
  url: string;
  port: number;
  token: string;
  uploadRoot: string;
  resolveSource(sourceId: string): WizardSource | null;
  close(): Promise<void>;
}
