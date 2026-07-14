import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import YAML from "yaml";
import { read, resolveInput, printReport } from "./lib/audit-utils.mjs";

const { projectRoot, files } = resolveInput(process.argv[2] || process.cwd());
const findings = [];
if (!projectRoot) {
  findings.push("No Novel Forge PROJECT.yaml found; structured integrity checks were not available.");
} else {
  const project = YAML.parse(read(join(projectRoot, "PROJECT.yaml")));
  const bookId = project.active_book || "book-01";
  const bookRoot = join(projectRoot, "books", bookId);
  const load = (path, fallback) => existsSync(path) ? YAML.parse(read(path)) : fallback;
  const canon = load(join(projectRoot, "series", "canon.yaml"), { facts: [], relationships: [] });
  const threads = load(join(projectRoot, "series", "story-threads.yaml"), { threads: [] });
  const queue = load(join(bookRoot, "chapter-queue.yaml"), { packets: [] });
  const plot = load(join(bookRoot, "plot-grid.yaml"), { chapters: [] });
  const sources = load(join(projectRoot, "research", "source-register.yaml"), { sources: [] });
  const duplicateIds = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (!item?.id) findings.push(`${label} entry is missing an id.`);
      else if (seen.has(item.id)) findings.push(`Duplicate ${label} id: ${item.id}.`);
      else seen.add(item.id);
    }
    return seen;
  };
  const canonIds = duplicateIds([...(canon.facts || []), ...(canon.relationships || [])], "canon");
  const threadIds = duplicateIds(threads.threads || [], "story-thread");
  const sourceIds = duplicateIds(sources.sources || [], "research-source");
  const byThread = new Map((threads.threads || []).map((thread) => [thread.id, thread]));
  for (const relationship of canon.relationships || []) {
    if (new Set(relationship.characters || []).size !== (relationship.characters || []).length) findings.push(`Relationship ${relationship.id} repeats a character id.`);
  }
  for (const packet of queue.packets || []) {
    for (const id of packet.continuity_refs || []) if (!canonIds.has(id)) findings.push(`Chapter ${packet.chapter} references missing canon ${id}.`);
    for (const id of packet.story_thread_refs || []) {
      if (!threadIds.has(id)) findings.push(`Chapter ${packet.chapter} references missing story thread ${id}.`);
      else if (["paid-off", "abandoned"].includes(byThread.get(id)?.status) && packet.status === "ready") findings.push(`Ready Chapter ${packet.chapter} references ${byThread.get(id).status} thread ${id}.`);
    }
    for (const id of packet.required_research || []) if (!sourceIds.has(id)) findings.push(`Chapter ${packet.chapter} references missing research ${id}.`);
  }
  for (const chapter of plot.chapters || []) {
    for (const id of [...(chapter.setup_ids || []), ...(chapter.payoff_ids || [])]) if (!threadIds.has(id)) findings.push(`Plot Chapter ${chapter.chapter} references missing thread ${id}.`);
  }
  const numbers = files.map((file) => Number.parseInt(basename(file).match(/^0*(\d+)(?:[-_ .]|$)/)?.[1] || "", 10)).filter(Number.isFinite);
  const seenNumbers = new Set();
  for (const number of numbers) { if (seenNumbers.has(number)) findings.push(`Duplicate manuscript Chapter ${number}.`); seenNumbers.add(number); }
  const max = Math.max(0, ...numbers);
  for (let number = 1; number <= max; number += 1) if (!seenNumbers.has(number)) findings.push(`Missing manuscript Chapter ${number}.`);
}
printReport("Novel Forge structured-integrity audit", [["Integrity findings", findings]]);
