from pathlib import Path

root = Path('.')

events_path = root / 'src/application/events.ts'
prompts_path = root / 'src/application/prompts.ts'
events = events_path.read_text(encoding='utf-8')
prompts = prompts_path.read_text(encoding='utf-8')

if 'import { compactPacketWindow, packetWindowDecision, packetWindowFindings } from "./packet-window.js";' not in events:
    events = events.replace(
        'import { researchEvidenceFindings } from "./research-evidence.js";\n',
        'import { researchEvidenceFindings } from "./research-evidence.js";\nimport { compactPacketWindow, packetWindowDecision, packetWindowFindings } from "./packet-window.js";\n',
        1,
    )

if 'Packet-window validation blocked' not in events:
    marker = '  if (event === "book-plan") {\n    const strategy = parseOverlay<BookStrategyPhase5>'
    index = events.index(marker)
    block = '''  if (event === "book-plan" || event === "chapter-queue") {
    const drafted = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
    const windowBlockers = packetWindowFindings(queue, plot, drafted).filter((finding) => finding.severity === "blocker");
    if (windowBlockers.length) throw new Error(`Packet-window validation blocked ${event}:\n${windowBlockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
'''
    events = events[:index] + block + events[index:]

if 'queue = compactPacketWindow(queue);' not in events:
    events = events.replace(
        '      packet.status = "drafted";\n      setChange(changes, `books/${book.book_id}/chapter-queue.yaml`, stringifyYaml(queue));',
        '      packet.status = "drafted";\n      queue = compactPacketWindow(queue);\n      setChange(changes, `books/${book.book_id}/chapter-queue.yaml`, stringifyYaml(queue));',
        1,
    )

if 'const window = packetWindowDecision(queue, plot, manuscriptNumbers);' not in events:
    start = events.index('        const remaining = queue.packets.some((item) => item.status === "ready");')
    end_marker = '        project.next_gate = null;\n'
    end = events.index(end_marker, start) + len(end_marker)
    replacement = '''        const manuscriptNumbers = new Set(listChapterFiles(join(root, "books", book.book_id)).map(chapterNumber).filter((item): item is number => item !== null));
        manuscriptNumbers.add(input.chapter);
        const window = packetWindowDecision(queue, plot, manuscriptNumbers);
        project.current_stage = window.allPlannedComplete ? "manuscript-review" : window.needsRefill ? "chapter-queue" : "drafting";
        project.next_gate = null;
'''
    events = events[:start] + replacement + events[end:]

events_path.write_text(events, encoding='utf-8')

prompts = prompts.replace('import { join } from "node:path";', 'import { basename, join } from "node:path";', 1)
prompts = prompts.replace(
    'import type { RevisionTicket, Stage } from "../domain/schemas.js";',
    'import { ChapterQueueSchema, type ChapterQueueState, type RevisionTicket, type Stage } from "../domain/schemas.js";',
    1,
)
prompts = prompts.replace('import { readText } from "../infrastructure/files.js";', 'import { listChapterFiles, readText } from "../infrastructure/files.js";', 1)
if 'import { PlotGridPhase4Schema, type PlotGridPhase4 }' not in prompts:
    prompts = prompts.replace(
        'import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";\n',
        'import { PremiseLabSchema, type PremiseLab } from "../domain/v1-4-schemas.js";\nimport { PlotGridPhase4Schema, type PlotGridPhase4 } from "../domain/v1-3-architecture-schemas.js";\nimport { packetWindowDecision } from "./packet-window.js";\n',
        1,
    )

if 'Maintain a rolling active window of at most six ready chapter packets.' not in prompts:
    start = prompts.index('export function queuePrompt(root: string): string {')
    end = prompts.index('export function draftPrompt', start)
    replacement = '''export function queuePrompt(root: string): string {
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
    prompts = prompts[:start] + replacement + prompts[end:]

prompts_path.write_text(prompts, encoding='utf-8')
