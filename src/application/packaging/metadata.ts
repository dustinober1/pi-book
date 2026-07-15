import { join } from "node:path";
import { MarketingMetadataSchema, PublishingMetadataSchema, type MarketingMetadata, type PublishingMetadata } from "../../domain/v1-2-schemas.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml } from "../../infrastructure/yaml.js";

export interface MetadataFinding { field: string; message: string; blocking: boolean }

export function readPublishingMetadata(root: string, bookId: string): PublishingMetadata {
  const relative = `books/${bookId}/publishing.yaml`;
  const text = readText(join(root, relative));
  if (!text) throw new Error(`${relative} is missing.`);
  return parseYaml<PublishingMetadata>(text, PublishingMetadataSchema, relative);
}

export function readMarketingMetadata(root: string, bookId: string): MarketingMetadata {
  const relative = `books/${bookId}/marketing.yaml`;
  const text = readText(join(root, relative));
  if (!text) throw new Error(`${relative} is missing.`);
  return parseYaml<MarketingMetadata>(text, MarketingMetadataSchema, relative);
}

export function publishingMetadataFindings(metadata: PublishingMetadata): MetadataFinding[] {
  const findings: MetadataFinding[] = [];
  const required: Array<[string, string]> = [
    ["title", metadata.title],
    ["author", metadata.author.pen_name || metadata.author.name],
    ["language", metadata.language],
    ["copyright holder", metadata.copyright.holder],
    ["copyright year", metadata.copyright.year],
    ["short description", metadata.descriptions.short],
    ["long description", metadata.descriptions.long],
  ];
  for (const [field, value] of required) if (!value.trim()) findings.push({ field, message: `${field} is required.`, blocking: true });
  if (!metadata.keywords.length) findings.push({ field: "keywords", message: "At least one keyword is required.", blocking: true });
  if (!metadata.categories.length) findings.push({ field: "categories", message: "At least one category is required.", blocking: true });
  if (!metadata.identifiers.paperback_isbn && !metadata.identifiers.hardcover_isbn && !metadata.identifiers.epub_isbn && !metadata.identifiers.audiobook_isbn) {
    findings.push({ field: "identifiers", message: "No ISBN is assigned; format identifiers remain placeholders.", blocking: false });
  }
  if (!metadata.accessibility.alt_text_complete && metadata.assets.length) findings.push({ field: "accessibility", message: "Alt text is incomplete for one or more assets.", blocking: false });
  return findings;
}

export function marketingMetadataFindings(metadata: MarketingMetadata): MetadataFinding[] {
  const findings: MetadataFinding[] = [];
  const required: Array<[string, { items: string[]; approval: { status: string } }]> = [
    ["positioning", metadata.positioning],
    ["audiences", metadata.audiences],
    ["hooks", metadata.hooks],
    ["retailer copy", metadata.retailer_copy],
    ["launch copy", metadata.launch],
    ["social posts", metadata.social],
    ["advertisements", metadata.advertisements],
    ["audiobook promotion", metadata.audiobook_promotion],
    ["series-page copy", metadata.series_page],
  ];
  for (const [field, group] of required) {
    if (!group.items.some((item) => item.trim())) findings.push({ field, message: `${field} has no draft content.`, blocking: true });
    else if (group.approval.status !== "approved") findings.push({ field, message: `${field} is present but remains ${group.approval.status}.`, blocking: false });
  }
  return findings;
}
