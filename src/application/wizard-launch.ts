import { resolve } from "node:path";
import { startWizardSession } from "../wizard/session.js";
import type { WizardSessionHandle, WizardWorkflow } from "../wizard/types.js";
import { createAdoptionWizardHandler } from "./adoption/wizard.js";
import { createNextBookWizardHandler } from "./next-book-wizard.js";
import { createPackagingWizardHandler } from "./packaging/wizard.js";
import { createReaderWizardHandler } from "./readers/wizard.js";
import { createResearchWizardHandler } from "./research/wizard.js";
import { createWizardRegistry } from "./wizard.js";

export interface LaunchNovelWizardOptions {
  openBrowser?: boolean;
  authorizedPaths?: string[];
  idleTimeoutMs?: number;
}

const activeSessions = new Map<string, WizardSessionHandle>();

export async function closeNovelWizard(root: string): Promise<void> {
  const key = resolve(root);
  const existing = activeSessions.get(key);
  if (!existing) return;
  activeSessions.delete(key);
  await existing.close();
}

export async function launchNovelWizard(root: string, workflow?: WizardWorkflow, options: LaunchNovelWizardOptions = {}): Promise<WizardSessionHandle> {
  const key = resolve(root);
  await closeNovelWizard(key);
  let session: WizardSessionHandle | null = null;
  const resolveUpload = (sourceId: string) => session?.resolveSource(sourceId) ?? null;
  const authorizedPaths = new Set((options.authorizedPaths ?? []).map((path) => resolve(path)));
  const registry = createWizardRegistry(key, {
    adoption: createAdoptionWizardHandler(key, { authorizedPaths, resolveUpload }),
    readers: createReaderWizardHandler(key, { resolveSource: resolveUpload }),
    packaging: createPackagingWizardHandler(key),
    "next-book": createNextBookWizardHandler(key),
    research: createResearchWizardHandler(key, { resolveSource: resolveUpload }),
  });
  session = await startWizardSession({
    projectRoot: key,
    registry,
    ...(workflow ? { workflow } : {}),
    ...(options.openBrowser !== undefined ? { openBrowser: options.openBrowser } : {}),
    ...(options.idleTimeoutMs !== undefined ? { idleTimeoutMs: options.idleTimeoutMs } : {}),
  });
  activeSessions.set(key, session);
  const originalClose = session.close;
  session.close = async () => {
    if (activeSessions.get(key) === session) activeSessions.delete(key);
    await originalClose();
  };
  return session;
}
