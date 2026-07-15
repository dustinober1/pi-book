import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportWithPandoc } from "../src/conversion/pandoc-export.js";
import { defaultPublishingMetadata } from "../src/domain/v1-2-schemas.js";

function temp(): string { return mkdtempSync(join(tmpdir(), "novel-forge-pandoc-export-")); }

test("Pandoc export uses argument-safe DOCX and EPUB conversions", async () => {
  const root = temp();
  try {
    const executable = join(root, "fake pandoc;safe.mjs");
    writeFileSync(executable, `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nconst args = process.argv.slice(2);\nif (args[0] === '--version') { console.log('pandoc 9.9'); process.exit(0); }\nconst output = args[args.indexOf('--output') + 1];\nconst to = args[args.indexOf('--to') + 1];\nwriteFileSync(output, Buffer.from(to === 'docx' ? [80,75,3,4,1] : [80,75,3,4,2]));\n`, "utf8");
    chmodSync(executable, 0o755);
    const book = { schema_version: "1.0.0" as const, book_id: "book-01", title: "The Clean Signal", profile: "thriller" as const, status: "planning" as const, current_chapter: 0, target_words: 100000, actual_words: 0, act_checkpoint: null, canon_locked: false };
    const metadata = defaultPublishingMetadata(book, 1);
    metadata.author.pen_name = "Nessa Keane";
    const result = await exportWithPandoc("# The Clean Signal\n\nText.", metadata, executable);
    assert.equal(result.engine, "pandoc 9.9");
    assert.deepEqual([...result.docx], [80,75,3,4,1]);
    assert.deepEqual([...result.epub], [80,75,3,4,2]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
