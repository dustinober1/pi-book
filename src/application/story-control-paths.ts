import type { NovelEventType } from "./events.js";

const ENTITY_PATH = "series/entity-registry.yaml";
const KNOWLEDGE_PATH = "series/knowledge-ledger.yaml";
const STATE_PATH = "series/state-ledger.yaml";
const SERIES_CONTROL_PATHS = [ENTITY_PATH, KNOWLEDGE_PATH, STATE_PATH] as const;

export function storyControlPathsForEvent(eventType: NovelEventType, bookId: string): string[] {
  if (!/^book-[0-9]{2}$/.test(bookId)) throw new Error("Book ID must use book-NN format.");
  if (["series-plan", "book-plan", "canon-lock"].includes(eventType)) return [...SERIES_CONTROL_PATHS];
  if (eventType === "draft-chapter") return [STATE_PATH];
  if (eventType === "chapter-queue") return [`books/${bookId}/contracts/chapters/*.yaml`];
  return [];
}

export function isStoryControlPathAllowed(eventType: NovelEventType, path: string, bookId: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized === STATE_PATH && eventType === "draft-chapter") return true;
  if (SERIES_CONTROL_PATHS.includes(normalized as typeof SERIES_CONTROL_PATHS[number])) {
    return ["series-plan", "book-plan", "canon-lock"].includes(eventType);
  }
  if (eventType === "chapter-queue") {
    const escapedBookId = bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^books/${escapedBookId}/contracts/chapters/CH-[0-9]{3}\\.yaml$`).test(normalized);
  }
  return false;
}
