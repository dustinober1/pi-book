import { basename, join } from "node:path";
import { CanonSchema, ChapterQueueSchema, PlotGridSchema, SourceRegisterSchema, StoryThreadsSchema, type CanonState, type ChapterPacket, type ChapterQueueState, type PlotGridState, type SourceRegisterState, type StoryThreadsState } from "../domain/schemas.js";
import { countWords, listChapterFiles, readText } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { getProfile } from "../profiles/index.js";
import { readBook, readProject } from "../project/store.js";
import { packetReferenceFindings } from "../application/integrity.js";

export interface ChapterContext { root: string; bookId: string; packet: ChapterPacket; text: string; report: { estimatedTokens: number; included: string[]; excluded: string[] } }
function excerpt(text: string, maxChars: number, fromEnd = false): string { if (text.length <= maxChars) return text; return fromEnd ? text.slice(-maxChars) : text.slice(0, maxChars); }
function selectPacket(queue: ChapterQueueState, requestedChapter?: number): ChapterPacket {
  const packet = requestedChapter ? queue.packets.find((item) => item.chapter === requestedChapter) : queue.packets.find((item) => item.status === "ready");
  if (!packet) throw new Error(requestedChapter ? `No packet found for Chapter ${requestedChapter}.` : "No ready chapter packet found.");
  if (packet.status !== "ready") throw new Error(`Chapter ${packet.chapter} packet is ${packet.status}, not ready.`);
  return packet;
}
function chapterNumber(path: string): number | null { const match = basename(path).match(/^0*(\d+)(?:[-_ .]|$)/); return match ? Number.parseInt(match[1] ?? "", 10) : null; }
function previousChapterPath(files: string[], chapter: number): string | null { return files.find((path) => chapterNumber(path) === chapter - 1) ?? null; }
function buildBudgetedSections(sections: Array<{ title: string; body: string; required: boolean; cap: number }>, maxChars: number): string {
  let remaining = maxChars; const output: string[] = [];
  for (const section of sections) {
    const header = `\n## ${section.title}\n\n`; const minimum = section.required ? Math.min(300, section.body.length) : 0;
    if (remaining <= header.length + minimum) { if (section.required) throw new Error(`Context budget cannot fit required section: ${section.title}.`); continue; }
    const allowed = Math.min(section.cap, section.body.length, remaining - header.length);
    if (!section.required && allowed < 200) continue;
    output.push(header + excerpt(section.body, allowed, section.title === "Previous chapter ending/context")); remaining -= header.length + allowed;
  }
  return output.join("");
}

export function buildChapterContext(root: string, requestedChapter?: number, maxChars = 72000): ChapterContext {
  const project = readProject(root); const book = readBook(root); const bookRoot = join(root, "books", book.book_id);
  const queueText = readText(join(bookRoot, "chapter-queue.yaml")); const canonText = readText(join(root, "series", "canon.yaml"));
  const threadsText = readText(join(root, "series", "story-threads.yaml")); const plotText = readText(join(bookRoot, "plot-grid.yaml"));
  const sourcesText = readText(join(root, "research", "source-register.yaml"));
  if (!queueText || !canonText || !threadsText || !plotText || !sourcesText) throw new Error("Chapter context is missing queue, canon, thread, plot-grid, or research state.");
  const queue = parseYaml<ChapterQueueState>(queueText, ChapterQueueSchema, "chapter-queue.yaml");
  const canon = parseYaml<CanonState>(canonText, CanonSchema, "canon.yaml");
  const threads = parseYaml<StoryThreadsState>(threadsText, StoryThreadsSchema, "story-threads.yaml");
  const plot = parseYaml<PlotGridState>(plotText, PlotGridSchema, "plot-grid.yaml");
  const sources = parseYaml<SourceRegisterState>(sourcesText, SourceRegisterSchema, "source-register.yaml");
  const packet = selectPacket(queue, requestedChapter); const profile = getProfile(book.profile);
  const profileBlockers = profile.validatePacket(packet).filter((finding) => finding.severity === "blocker");
  const referenceBlockers = packetReferenceFindings(packet, canon, threads, sources, plot).filter((finding) => finding.severity === "blocker");
  const blockers = [...profileBlockers.map((item) => item.message), ...referenceBlockers.map((item) => item.message)];
  if (blockers.length) throw new Error(`Chapter packet is not draftable:\n${blockers.map((item) => `- ${item}`).join("\n")}`);
  const relevantFacts = canon.facts.filter((fact) => packet.continuity_refs.includes(fact.id));
  const relevantRelationships = canon.relationships.filter((relationship) => packet.continuity_refs.includes(relationship.id) || relationship.characters.some((character) => packet.character_refs.includes(character)));
  const relevantThreads = threads.threads.filter((thread) => packet.story_thread_refs.includes(thread.id));
  const plotEntry = plot.chapters.find((item) => item.chapter === packet.chapter) ?? null;
  const chapterFiles = listChapterFiles(bookRoot); const previousPath = previousChapterPath(chapterFiles, packet.chapter);
  const previous = previousPath ? readText(previousPath) ?? "" : "_No prior chapter exists._";
  const sections = [
    { title: "Approved chapter packet", body: JSON.stringify(packet, null, 2), required: true, cap: 12000 },
    { title: "Relevant canon facts", body: JSON.stringify(relevantFacts, null, 2), required: true, cap: 7000 },
    { title: "Relevant relationship state", body: JSON.stringify(relevantRelationships, null, 2), required: true, cap: 6000 },
    { title: "Relevant story threads", body: JSON.stringify(relevantThreads, null, 2), required: true, cap: 7000 },
    { title: "Plot-grid entry", body: JSON.stringify(plotEntry, null, 2), required: true, cap: 5000 },
    { title: "Previous chapter ending/context", body: previous, required: true, cap: 12000 },
    { title: "Profile rules", body: profile.draftingRules.map((rule) => `- ${rule}`).join("\n"), required: false, cap: 5000 },
    { title: "Voice profile excerpt", body: readText(join(root, "series", "voice-profile.md")) ?? "", required: false, cap: 14000 },
    { title: "Active book bible excerpt", body: readText(join(bookRoot, "book-bible.md")) ?? "", required: false, cap: 12000 },
    { title: "Genre configuration", body: readText(join(bookRoot, "genre.yaml")) ?? "", required: false, cap: 6000 },
  ];
  const text = `# Drafting Context — Chapter ${packet.chapter}` + buildBudgetedSections(sections, maxChars);
  const included = [`chapter packet ${packet.chapter}`, ...relevantFacts.map((fact) => `canon ${fact.id}`), ...relevantRelationships.map((relationship) => `relationship ${relationship.id}`), ...relevantThreads.map((thread) => `thread ${thread.id}`), previousPath ? `previous chapter ${previousPath.slice(bookRoot.length + 1)}` : "no previous chapter"];
  return { root, bookId: project.active_book, packet, text, report: { estimatedTokens: Math.ceil(text.length / 4), included, excluded: ["unreferenced canon", "unreferenced story threads", "non-adjacent chapters", "future books", "packaging files", "legacy artifacts"] } };
}
export function manuscriptWordCount(root: string, bookId?: string): number { const project = readProject(root); const bookRoot = join(root, "books", bookId ?? project.active_book); return listChapterFiles(bookRoot).reduce((total, path) => total + countWords(readText(path) ?? ""), 0); }
