import { safeSlug } from "../../infrastructure/files.js";
import type { AdoptionFinding, AdoptionMappingProposal, AdoptionPreview, AdoptionSection, MappedAdoption } from "./types.js";

function words(markdown: string): number {
  return markdown.replace(/[`*_>#\[\]()~-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function find(sections: AdoptionSection[], id: string): AdoptionSection {
  const section = sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Unknown adoption section: ${id}`);
  return section;
}

export function applyMapping(preview: AdoptionPreview, proposal: AdoptionMappingProposal): MappedAdoption {
  let sections = preview.sections.map((section) => ({ ...section, sourceRefs: [...section.sourceRefs] }));
  const assets = preview.assets.map((asset) => ({ ...asset, bytes: new Uint8Array(asset.bytes) }));
  for (const operation of proposal.operations) {
    if (operation.type === "rename") find(sections, operation.sectionId).title = operation.title.trim();
    else if (operation.type === "renumber") find(sections, operation.sectionId).number = operation.number;
    else if (operation.type === "classify") find(sections, operation.sectionId).kind = operation.kind;
    else if (operation.type === "exclude") find(sections, operation.sectionId).included = !operation.excluded;
    else if (operation.type === "reorder") {
      if (new Set(operation.sectionIds).size !== operation.sectionIds.length) throw new Error("Reorder contains duplicate section IDs.");
      const ordered = operation.sectionIds.map((id) => find(sections, id));
      const included = new Set(operation.sectionIds);
      sections = [...ordered, ...sections.filter((section) => !included.has(section.id))];
    } else if (operation.type === "split") {
      const index = sections.findIndex((section) => section.id === operation.sectionId);
      if (index < 0) throw new Error(`Unknown adoption section: ${operation.sectionId}`);
      const section = sections[index]!;
      const blocks = section.markdown.split(/\n\s*\n/);
      if (operation.blockIndex < 1 || operation.blockIndex >= blocks.length) throw new Error(`Split for ${operation.sectionId} must use a Markdown block boundary.`);
      const first = blocks.slice(0, operation.blockIndex).join("\n\n").trim();
      const second = blocks.slice(operation.blockIndex).join("\n\n").trim();
      const nextNumber = section.number === null ? null : section.number + 1;
      sections.splice(index, 1,
        { ...section, markdown: first, wordCount: words(first) },
        { ...section, id: `${section.id}-split-${operation.blockIndex}`, sourceOrder: section.sourceOrder + 0.5, title: operation.title.trim(), number: nextNumber, markdown: second, wordCount: words(second) },
      );
    } else if (operation.type === "combine") {
      const firstIndex = sections.findIndex((section) => section.id === operation.firstSectionId);
      const secondIndex = sections.findIndex((section) => section.id === operation.secondSectionId);
      if (firstIndex < 0 || secondIndex !== firstIndex + 1) throw new Error("Only adjacent sections may be combined.");
      const first = sections[firstIndex]!;
      const second = sections[secondIndex]!;
      const markdown = `${first.markdown.trim()}\n\n${second.markdown.trim()}`.trim();
      sections.splice(firstIndex, 2, { ...first, title: operation.title.trim(), markdown, wordCount: words(markdown), sourceRefs: [...first.sourceRefs, ...second.sourceRefs] });
    }
  }
  sections = sections.map((section, index) => ({ ...section, sourceOrder: index, wordCount: words(section.markdown) }));

  for (const edit of proposal.assetEdits ?? []) {
    const asset = assets.find((candidate) => candidate.id === edit.assetId);
    if (!asset) throw new Error(`Unknown adoption asset: ${edit.assetId}`);
    if (edit.caption !== undefined) asset.caption = edit.caption;
    if (edit.altText !== undefined) asset.altText = edit.altText;
    if (edit.placementAfterSectionId !== undefined) asset.placementAfterSectionId = edit.placementAfterSectionId;
  }

  const metadata: Record<string, string> = {};
  const metadataDecisions: Record<string, "accepted" | "edited" | "ignored"> = {};
  const warnings = preview.warnings.map((warning) => ({ ...warning }));
  for (const [key, candidate] of Object.entries(preview.metadataCandidates)) {
    const decision = proposal.metadata?.[key];
    if (!decision) {
      warnings.push({ code: "metadata-decision-missing", message: `Choose accept, edit, or ignore for discovered metadata field ${key}.`, severity: "blocker" });
      continue;
    }
    metadataDecisions[key] = decision.action === "accept" ? "accepted" : decision.action === "edit" ? "edited" : "ignored";
    if (decision.action === "accept") metadata[key] = candidate;
    else if (decision.action === "edit") metadata[key] = decision.value?.trim() ?? "";
  }
  return { sections, assets, metadata, metadataDecisions, warnings };
}

export function validateAdoptionMapping(mapped: MappedAdoption, bookId = "book-01"): AdoptionFinding[] {
  const findings: AdoptionFinding[] = mapped.warnings.map((warning) => ({ severity: warning.severity, message: warning.message }));
  const accepted = mapped.sections.filter((section) => section.included);
  const manuscript = accepted.filter((section) => section.kind === "chapter" || section.kind === "interlude");
  if (!manuscript.length) findings.push({ severity: "blocker", message: "Adoption must include at least one manuscript chapter or interlude." });
  const numbers = new Set<number>();
  const paths = new Set<string>();
  for (const section of accepted) {
    if (!section.title.trim()) findings.push({ severity: "blocker", message: `Section ${section.id} requires a title.` });
    if (!section.markdown.trim()) findings.push({ severity: "blocker", message: `Section ${section.title || section.id} is empty.` });
    if (section.number !== null && (section.kind === "chapter" || section.kind === "interlude")) {
      if (numbers.has(section.number)) findings.push({ severity: "blocker", message: `Duplicate imported chapter number ${section.number}.` });
      numbers.add(section.number);
      const path = `books/${bookId}/manuscript/chapters/${String(section.number).padStart(2, "0")}-${safeSlug(section.title) || `chapter-${section.number}`}.md`;
      if (paths.has(path)) findings.push({ severity: "blocker", message: `Duplicate adoption destination path ${path}.` });
      paths.add(path);
    }
    if (section.wordCount < 100 && (section.kind === "chapter" || section.kind === "interlude")) findings.push({ severity: "warning", message: `${section.title} is unusually short at ${section.wordCount} words.` });
  }
  const acceptedIds = new Set(accepted.map((section) => section.id));
  for (const asset of mapped.assets) if (asset.placementAfterSectionId && !acceptedIds.has(asset.placementAfterSectionId)) findings.push({ severity: "blocker", message: `Asset ${asset.originalName} is placed after an excluded or unknown section.` });
  return findings;
}
