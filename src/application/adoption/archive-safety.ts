import { posix } from "node:path";
import { strFromU8, unzipSync } from "fflate";

export interface AdoptionLimits {
  maximumCompressedBytes: number;
  maximumExpandedBytes: number;
  maximumEntries: number;
  maximumMediaEntries: number;
  maximumCompressionRatio: number;
}

export interface SafeArchiveEntry {
  name: string;
  compressedSize: number;
  expandedSize: number;
}

export interface SafeArchiveManifest {
  entries: SafeArchiveEntry[];
  expandedBytes: number;
}

export const defaultAdoptionLimits: AdoptionLimits = {
  maximumCompressedBytes: 100 * 1024 * 1024,
  maximumExpandedBytes: 500 * 1024 * 1024,
  maximumEntries: 5000,
  maximumMediaEntries: 1000,
  maximumCompressionRatio: 200,
};

function normalizedEntryName(name: string): string {
  const normalized = posix.normalize(name.replace(/\\/g, "/"));
  if (!name || normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe archive path: ${name}`);
  }
  return normalized;
}

function centralDirectoryEntries(bytes: Uint8Array, limits: AdoptionLimits): SafeArchiveEntry[] {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: SafeArchiveEntry[] = [];
  const names = new Set<string>();
  for (let offset = 0; offset + 46 <= buffer.length; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const flags = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length) throw new Error("Corrupt ZIP central directory entry.");
    const name = normalizedEntryName(buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    if (flags & 0x1) throw new Error(`Encrypted archive entry is not supported: ${name}`);
    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0xf000) === 0xa000) throw new Error(`Archive symlink is not allowed: ${name}`);
    if (names.has(name)) throw new Error(`Duplicate normalized archive entry: ${name}`);
    names.add(name);
    if (compressedSize > 0 && expandedSize / compressedSize > limits.maximumCompressionRatio) throw new Error(`Archive entry exceeds compression-ratio limit: ${name}`);
    entries.push({ name, compressedSize, expandedSize });
    offset = end - 1;
  }
  if (!entries.length) throw new Error("Archive contains no readable central-directory entries.");
  return entries;
}

function inspectXml(entries: Record<string, Uint8Array>): void {
  for (const [name, data] of Object.entries(entries)) {
    if (!/\.(xml|rels|opf|xhtml|html)$/i.test(name)) continue;
    const text = strFromU8(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(`External XML declarations are not allowed: ${name}`);
    if (/\b(?:href|src|Target)\s*=\s*["'](?:https?:|file:|ftp:)/i.test(text)) throw new Error(`Remote resource reference is not allowed: ${name}`);
  }
}

export function inspectZipEntries(bytes: Uint8Array, limits: AdoptionLimits = defaultAdoptionLimits): SafeArchiveManifest {
  if (!bytes.length) throw new Error("Archive source is empty.");
  if (bytes.byteLength > limits.maximumCompressedBytes) throw new Error(`Archive exceeds ${limits.maximumCompressedBytes} compressed bytes.`);
  const entries = centralDirectoryEntries(bytes, limits);
  if (entries.length > limits.maximumEntries) throw new Error(`Archive exceeds ${limits.maximumEntries} entries.`);
  const expandedBytes = entries.reduce((sum, entry) => sum + entry.expandedSize, 0);
  if (expandedBytes > limits.maximumExpandedBytes) throw new Error(`Archive exceeds ${limits.maximumExpandedBytes} expanded bytes.`);
  const mediaEntries = entries.filter((entry) => /\.(png|jpe?g|gif|webp|svg|tiff?|bmp)$/i.test(entry.name)).length;
  if (mediaEntries > limits.maximumMediaEntries) throw new Error(`Archive exceeds ${limits.maximumMediaEntries} media entries.`);
  let unpacked: Record<string, Uint8Array>;
  try { unpacked = unzipSync(bytes); }
  catch (error) { throw new Error(`Archive is corrupt or unsupported: ${error instanceof Error ? error.message : "unzip failed"}`); }
  inspectXml(unpacked);
  return { entries, expandedBytes };
}
