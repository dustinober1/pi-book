import type { AdoptionWarning } from "../application/adoption/types.js";

export interface ConversionAsset {
  id: string;
  originalName: string;
  mediaType: string;
  bytes: Uint8Array;
  caption: string;
  altText: string;
  sourceRef: string;
}

export interface ConversionSection {
  headingLevel: number;
  title: string;
  markdown: string;
  sourceRef: string;
}

export interface ConversionDocument {
  markdown: string;
  sections: ConversionSection[];
  assets: ConversionAsset[];
  metadata: Record<string, string>;
  warnings: AdoptionWarning[];
  sourceWordCount: number;
}

export interface ConversionSource {
  absolutePath: string;
  originalName: string;
  extension: string;
  byteSize: number;
  sourceHash: string;
  isDirectory: boolean;
}

export interface ConversionEngine {
  name: "pandoc" | "node-docx" | "node-epub" | "plain-text";
  version: string;
  supports(source: ConversionSource): boolean;
  convert(source: ConversionSource): Promise<ConversionDocument>;
}
