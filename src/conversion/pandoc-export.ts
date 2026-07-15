import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PublishingMetadata } from "../domain/v1-2-schemas.js";
import { detectPandoc } from "./pandoc.js";

const execFileAsync = promisify(execFile);

export interface PandocExportResult {
  docx: Uint8Array;
  epub: Uint8Array;
  engine: string;
}

function metadataArguments(metadata: PublishingMetadata): string[] {
  const author = metadata.author.pen_name || metadata.author.name;
  return [
    "--metadata", `title=${metadata.title}`,
    "--metadata", `subtitle=${metadata.subtitle}`,
    "--metadata", `author=${author}`,
    "--metadata", `lang=${metadata.language || "en"}`,
    "--metadata", `description=${metadata.descriptions.short}`,
  ];
}

async function convert(binary: string, input: string, output: string, to: "docx" | "epub3", metadata: PublishingMetadata, cwd: string): Promise<void> {
  await execFileAsync(binary, [
    "--from", "gfm+footnotes+pipe_tables",
    "--to", to,
    ...metadataArguments(metadata),
    "--output", output,
    input,
  ], {
    cwd,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
}

export async function exportWithPandoc(markdown: string, metadata: PublishingMetadata, binary = "pandoc"): Promise<PandocExportResult> {
  const availability = await detectPandoc(binary);
  if (!availability.available) throw new Error("Pandoc is not available.");
  const work = mkdtempSync(join(tmpdir(), "novel-forge-pandoc-export-"));
  const input = join(work, "manuscript.md");
  const docx = join(work, "manuscript.docx");
  const epub = join(work, "manuscript.epub");
  try {
    writeFileSync(input, markdown, "utf8");
    await convert(availability.path, input, docx, "docx", metadata, work);
    await convert(availability.path, input, epub, "epub3", metadata, work);
    return {
      docx: new Uint8Array(readFileSync(docx)),
      epub: new Uint8Array(readFileSync(epub)),
      engine: `pandoc ${availability.version}`,
    };
  } catch (error) {
    throw new Error(`Pandoc export failed: ${error instanceof Error ? error.message : "unknown error"}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
