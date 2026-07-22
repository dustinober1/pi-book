import type { NovelEventType } from "./events.js";

const SERIES_CONTROL_PATHS = [
  "series/entity-registry.yaml",
  "series/knowledge-ledger.yaml",
  "series/state-ledger.yaml",
] as const;

export function storyControlPathsForEvent(eventType: NovelEventType, bookId: string): string[] {
  if (!/^book-[0-9]{2}$/.test(bookId)) throw new Error("Book ID must use book-NN format.");
  if (["series-plan", "book-plan", "canon-lock"].includes(eventType)) return [...SERIES_CONTROL_PATHS];
  if (eventType === "chapter-queue") return [`books/${bookId}/contracts/chapters/*.yaml`];
  return [];
}

export function isStoryControlPathAllowed(eventType: NovelEventType, path: string, bookId: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (SERIES_CONTROL_PATHS.includes(normalized as typeof SERIES_CONTROL_PATHS[number])) {
    return ["series-plan", "book-plan", "canon-lock"].includes(eventType);
  }
  if (eventType === "chapter-queue") {
    const escapedBookId = bookId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^books/${escapedBookId}/contracts/chapters/CH-[0-9]{3}\\.yaml$`).test(normalized);
  }
  return false;
}
