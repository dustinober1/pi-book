import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { countTextWords, splitMarkdownSections } from "./html-to-markdown.js";
import type { ConversionAsset, ConversionDocument, ConversionSource } from "./types.js";

const execFileAsync = promisify(execFile);

export interface PandocAvailability { available: boolean; version: string; path: string }

function mediaType(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function mediaFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? mediaFiles(join(root, entry.name)) : [join(root, entry.name)]);
}

export async function detectPandoc(binary = "pandoc"): Promise<PandocAvailability> {
  try {
    const { stdout } = await execFileAsync(binary, ["--version"], { timeout: 10_000, maxBuffer: 1024 * 1024, windowsHide: true });
    return { available: true, version: stdout.split(/\r?\n/)[0]?.replace(/^pandoc\s*/i, "").trim() || "unknown", path: binary };
  } catch {
    return { available: false, version: "", path: binary };
  }
}

export async function runPandocImport(source: ConversionSource, format: "docx" | "epub", binary = "pandoc"): Promise<ConversionDocument> {
  const availability = await detectPandoc(binary);
  if (!availability.available) throw new Error("Pandoc is not available.");
  const work = mkdtempSync(join(tmpdir(), "novel-forge-pandoc-"));
  const media = join(work, "media");
  const output = join(work, "manuscript.md");
  try {
    await execFileAsync(availability.path, [
      "--from", format,
      "--to", "gfm+footnotes+pipe_tables",
      "--extract-media", media,
      "--output", output,
      source.absolutePath,
    ], { cwd: work, timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, shell: false });
    const markdown = readFileSync(output, "utf8").trim();
    const assets: ConversionAsset[] = mediaFiles(media).map((path, index) => {
      const bytes = readFileSync(path);
      return {
        id: `asset-${index + 1}`,
        originalName: basename(path),
        mediaType: mediaType(path),
        bytes,
        caption: "",
        altText: "",
        sourceRef: path.slice(media.length + 1).replace(/\\/g, "/"),
      };
    });
    return {
      markdown,
      sections: splitMarkdownSections(markdown, source.originalName),
      assets,
      metadata: {},
      warnings: [],
      sourceWordCount: countTextWords(markdown),
    };
  } catch (error) {
    throw new Error(`Pandoc conversion failed: ${error instanceof Error ? error.message : "unknown error"}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function pandocAssetHash(asset: ConversionAsset): string {
  return createHash("sha256").update(asset.bytes).digest("hex");
}
