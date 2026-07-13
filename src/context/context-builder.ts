import { join } from "node:path";
import { CanonSchema, ChapterQueueSchema, PlotGridSchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type PlotGridState, type StoryThreadsState } from "../domain/schemas.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";

export interface ChapterContext {
  root: string;
  bookId: string;
  packet: ChapterPacket;
  text: string;
  report: {
    estimatedTokens: number;
    included: string[];
    excluded: string[];
  };
}

function excerpt(text: string, maxChars: number, fromEnd = false): string {
  if (text.length <= maxChars) return text;
  return fromEnd ? text.slice(-maxChars) : text.slice(0, maxChars);
}

function selectPacket(queue: ChapterQueueState, requestedChapter?: number): ChapterPacket {
  const packet = requestedChapter
    ? queue.packets.find((item) => item.chapter === requestedChapter)
    : queue.packets.find((item) => item.status === "ready");
  if (!packet) throw new Error(requestedChapter ? `No packet found for Chapter ${requestedChapter}.` : "No ready chapter packet found.");
  return packet;
}

export function buildChapterContext(root: string, requestedChapter?: number, maxChars = 72000): ChapterContext {
  const project = readProject(root);
  const book = readBook(root);
  const bookRoot = join(root, "books", book.book_id);
  const queueText = readText(join(bookRoot, "chapter-queue.yaml"));
  const canonText = readText(join(root, "series", "canon.yaml"));
  const threadsText = readText(join(root, "series", "story-threads.yaml"));
  const plotText = readText(join(bookRoot, "plot-grid.yaml"));
  if (!queueText || !canonText || !threadsText || !plotText) throw new Error("Chapter context is missing queue, canon, thread, or plot-grid state.");

  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml");
  const canon = parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml");
  const threads = parseYaml<StoryThreadsState>(threadsText, StoryThreadsSchema, "story-threads.yaml");
  const plot = parseYaml<PlotGridState>(plotText, PlotGridSchema, "plot-grid.yaml");
  const packet = selectPacket(queue, requestedChapter);
  const profile = getProfile(book.profile);
  const packetFindings = profile.validatePacket(packet);
  const blockers = packetFindings.filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Chapter packet is not draftable:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);

  const relevantFacts = canon.facts.filter((fact) => packet.continuity_refs.includes(fact.id));
  const relevantRelationships = canon.relationships.filter((relationship) => packet.continuity_refs.includes(relationship.id) || relationship.characters.some((character) => packet.character_refs.includes(character)));
  const relevantThreads = threads.threads.filter((thread) => packet.story_thread_refs.includes(thread.id));
  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter) ?? null;
  const voiceText = excerpt(readText(join(root, "series", "voice-profile.md")) ?? "", 14000);
  const bookBible = excerpt(readText(join(bookRoot, "book-bible.md")) ?? "", 12000);
  const genreText = excerpt(readText(join(bookRoot, "genre.yaml")) ?? "", 8000);
  const chapterFiles = listChapterFiles(bookRoot);
  const previousPath = chapterFiles.length ? chapterFiles[chapterFiles.length - 1] : null;
  const previous = previousPath ? excerpt(readText(previousPath) ?? "", 12000, true) : "_No prior chapter exists._";

  const sections = [
    `# Drafting Context — Chapter ${packet.chapter}`,
    `\n## Approved chapter packet\n\n${JSON.stringify(packet, null, 2)}`,
    `\n## Profile rules\n\n${profile.draftingRules.map((rule) => `- ${rule}`).join("\n")}`,
    `\n## Relevant canon facts\n\n${JSON.stringify(relevantFacts, null, 2)}`,
    `\n## Relevant relationship state\n\n${JSON.stringify(relevantRelationships, null, 2)}`,
    `\n## Relevant story threads\n\n${JSON.stringify(relevantThreads, null, 2)}`,
    `\n## Plot-grid entry\n\n${JSON.stringify(plotEntry, null, 2)}`,
    `\n## Voice profile excerpt\n\n${voiceText}`,
    `\n## Active book bible excerpt\n\n${bookBible}`,
    `\n## Genre configuration\n\n${genreText}`,
    `\n## Previous chapter ending/context\n\n${previous}`,
  ];
  let text = sections.join("\n");
  if (text.length > maxChars) text = text.slice(0, maxChars) + "\n\n[Context truncated at configured budget.]";
  const included = [
    `chapter packet ${packet.chapter}`,
    ...relevantFacts.map((fact) => `canon ${fact.id}`),
    ...relevantRelationships.map((relationship) => `relationship ${relationship.id}`),
    ...relevantThreads.map((thread) => `thread ${thread.id}`),
    "voice profile excerpt",
    "active book bible excerpt",
    previousPath ? `previous chapter ${previousPath.slice(bookRoot.length + 1)}` : "no previous chapter",
  ];
  return {
    root,
    bookId: project.active_book,
    packet,
    text,
    report: {
      estimatedTokens: Math.ceil(text.length / 4),
      included,
      excluded: ["unreferenced canon", "unreferenced story threads", "future books", "packaging files", "legacy artifacts"],
    },
  };
}

export function manuscriptWordCount(root: string, bookId?: string): number {
  const project = readProject(root);
  const bookRoot = join(root, "books", bookId ?? project.active_book);
  return listChapterFiles(bookRoot).reduce((total, path) => total + countWords(readText(path) ?? ""), 0);
}
