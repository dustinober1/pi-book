import { join } from "node:path";
import { extractVoiceMetrics, compareVoiceMetrics } from "../src/application/voice-audit.js";
import { VoiceGuardrailsSchema, type VoiceGuardrails } from "../src/domain/v1-3-schemas.js";
import { listChapterFiles, readText } from "../src/infrastructure/files.js";
import { parseYaml } from "../src/infrastructure/yaml.js";
import { readBook } from "../src/project/store.js";

const root = process.argv[2] ?? process.cwd();

try {
  const book = readBook(root);
  const guardrailPath = join(root, "series", "voice-guardrails.yaml");
  const guardrailText = readText(guardrailPath);
  if (!guardrailText) {
    console.log(JSON.stringify({ status: "no-baseline", message: "series/voice-guardrails.yaml is missing." }, null, 2));
    process.exit(0);
  }
  const guardrails = parseYaml<VoiceGuardrails>(guardrailText, VoiceGuardrailsSchema, "series/voice-guardrails.yaml");
  if (!guardrails.baseline.content_hash || !Object.keys(guardrails.baseline.metrics).length) {
    console.log(JSON.stringify({ status: "no-baseline", message: "No accepted baseline hash and metrics are available." }, null, 2));
    process.exit(0);
  }
  const bookRoot = join(root, "books", book.book_id);
  const chapters = listChapterFiles(bookRoot);
  const text = chapters.map((path) => readText(path) ?? "").join("\n\n");
  const metrics = extractVoiceMetrics(text);
  console.log(JSON.stringify({
    status: "evidence",
    book_id: book.book_id,
    chapter_count: chapters.length,
    baseline_hash: guardrails.baseline.content_hash,
    metrics,
    deltas: compareVoiceMetrics(metrics, guardrails.baseline.metrics),
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
