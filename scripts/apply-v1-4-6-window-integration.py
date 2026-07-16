from pathlib import Path

root = Path('.')
# Triggered after workflow installation so the branch-only patch job can run.

# Event integration.
path = root / 'src/application/events.ts'
text = path.read_text(encoding='utf-8')
anchor = 'import { researchEvidenceFindings } from "./research-evidence.js";\n'
addition = 'import { compactPacketWindow, packetWindowDecision, packetWindowFindings } from "./packet-window.js";\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('events import anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
anchor = '''  if (event === "book-plan") {
    const strategy = parseOverlay<BookStrategyPhase5>(root, files, `${bookRoot}/book-strategy.yaml`, BookStrategyPhase5Schema);
'''
insert = '''  if (event === "book-plan" || event === "chapter-queue") {
    const drafted = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
    const windowBlockers = packetWindowFindings(queue, plot, drafted).filter((finding) => finding.severity === "blocker");
    if (windowBlockers.length) throw new Error(`Packet-window validation blocked ${event}:\n${windowBlockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
  if (event === "book-plan") {
    const strategy = parseOverlay<BookStrategyPhase5>(root, files, `${bookRoot}/book-strategy.yaml`, BookStrategyPhase5Schema);
'''
if anchor not in text:
    raise RuntimeError('architecture strategy anchor missing')
text = text.replace(anchor, insert, 1)
old = '''      packet.status = "drafted";
      setChange(changes, `books/${book.book_id}/chapter-queue.yaml`, stringifyYaml(queue));
'''
new = '''      packet.status = "drafted";
      queue = compactPacketWindow(queue);
      setChange(changes, `books/${book.book_id}/chapter-queue.yaml`, stringifyYaml(queue));
'''
if old not in text:
    raise RuntimeError('draft packet status anchor missing')
text = text.replace(old, new, 1)
old = '''        const remaining = queue.packets.some((item) => item.status === "ready");
        const manuscriptNumbers = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
        manuscriptNumbers.add(input.chapter);
        const allPlanned = plot.chapters.length > 0 && plot.chapters.every((item) => manuscriptNumbers.has(item.chapter));
        project.current_stage = remaining ? "drafting" : allPlanned ? "manuscript-review" : "chapter-queue";
        project.next_gate = null;
'''
new = '''        const manuscriptNumbers = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
        manuscriptNumbers.add(input.chapter);
        const window = packetWindowDecision(queue, plot, manuscriptNumbers);
        project.current_stage = window.allPlannedComplete ? "manuscript-review" : window.needsRefill ? "chapter-queue" : "drafting";
        project.next_gate = null;
'''
if old not in text:
    raise RuntimeError('draft stage decision anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Prompt integration.
path = root / 'src/application/prompts.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('import { join } from "node:path";', 'import { basename, join } from "node:path";')
text = text.replace('import type { RevisionTicket, Stage } from "../domain/schemas.js";', 'import { ChapterQueueSchema, type ChapterQueueState, type RevisionTicket, type Stage } from "../domain/schemas.js";')
text = text.replace('import { readText } from "../infrastructure/files.js";', 'import { listChapterFiles, readText } from "../infrastructure/files.js";')
anchor = 'import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";\n'
addition = 'import { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";\nimport { packetWindowDecision } from "./packet-window.js";\n'
if addition not in text:
    if anchor not in text:
        raise RuntimeError('prompts import anchor missing')
    text = text.replace(anchor, anchor + addition, 1)
old = '''export function queuePrompt(root: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nCreate a bounded draft window of no more than six ready chapter packets from the approved plot grid. Every packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook. Use remarkability.yaml to protect the retellable hook and planned signature moments without forcing every chapter to perform them. New required_research entries use only ready RES-NNN research-ledger IDs. Existing SRC-NNN references remain readable but are legacy advisories and should be migrated during the next plan rebuild. Carry approved book guardrails into drafting context through book-strategy.yaml; never copy raw public-review observations or excerpts into a chapter packet.\n\nRequired ${profile.label} profile fields:\n${profile.chapterPacketRequirements.map((item) => `- ${item}`).join("\n")}\n\n${eventRule(root, "chapter-queue", "chapter-queue")}`;
}
'''
new = '''export function queuePrompt(root: string): string {
  const book = readBook(root);
  const profile = getProfile(book.profile);
  const bookRoot = join(root, "books", book.book_id);
  const queue = parseYaml<ChapterQueueState>(readText(join(bookRoot, "chapter-queue.yaml")) ?? "", ChapterQueueSchema, "chapter-queue.yaml");
  const plot = parseYaml<PlotGridPhase4>(readText(join(bookRoot, "plot-grid.yaml")) ?? "", PlotGridPhase4Schema, "plot-grid.yaml");
  const drafted = new Set(listChapterFiles(bookRoot).map((path) => Number.parseInt(basename(path).match(/^0*(\\d+)/)?.[1] ?? "", 10)).filter(Number.isInteger));
  const window = packetWindowDecision(queue, plot, drafted);
  const preserve = window.queue.packets.map((packet) => packet.chapter).sort((left, right) => left - right);
  const refillInstruction = window.needsRefill
    ? `Create packets only for chapters ${window.candidateChapters.join(", ")}. Preserve the existing active packet${preserve.length === 1 ? "" : "s"} for chapter${preserve.length === 1 ? "" : "s"} ${preserve.join(", ")}. Return one complete replacement chapter-queue.yaml containing the preserved active packets plus the new packets.`
    : `No refill is required because ${window.readyCount} ready packets remain. Preserve the active window and do not regenerate packets.`;
  return `Use the novel-forge-for-pi skill.\n\nProject root: ${root}\nActive book: ${book.book_id}\n\nMaintain a rolling active window of at most six ready chapter packets. Refill only when fewer than two ready packets remain. Drafted, reviewed, and revised packets must not remain in the active window. ${refillInstruction}\n\nEvery new packet must define purpose, causality, state change, scene engine, relevant IDs, research needs, target words, and an honest ending hook. Use remarkability.yaml to protect the retellable hook and planned signature moments without forcing every chapter to perform them. New required_research entries use only ready RES-NNN research-ledger IDs. Carry approved book guardrails into drafting context; never copy raw public-review observations into a packet. Do not rebuild the entire book queue.\n\nRequired ${profile.label} profile fields:\n${profile.chapterPacketRequirements.map((item) => `- ${item}`).join("\n")}\n\n${eventRule(root, "chapter-queue", "chapter-queue")}`;
}
'''
if old not in text:
    raise RuntimeError('queuePrompt anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
