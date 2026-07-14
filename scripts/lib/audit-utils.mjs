import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import YAML from "yaml";

export function read(path) {
  return readFileSync(path, "utf8");
}

function walk(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "legacy") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (/\.md$/i.test(entry.name)) output.push(full);
  }
  return output;
}

export function resolveInput(input = process.cwd()) {
  const target = resolve(input);
  if (existsSync(join(target, "PROJECT.yaml"))) {
    const project = YAML.parse(read(join(target, "PROJECT.yaml")));
    const book = project.active_book || "book-01";
    return { projectRoot: target, files: walk(join(target, "books", book, "manuscript", "chapters")).sort() };
  }
  return { projectRoot: null, files: walk(target).sort() };
}

export function words(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
}

export function wordCount(text) {
  return words(text).length;
}

export function chapterLabel(path) {
  return basename(path);
}

export function printReport(title, sections) {
  console.log(`# ${title}\n`);
  for (const [heading, lines] of sections) {
    console.log(`## ${heading}\n`);
    if (!lines.length) console.log("- none\n");
    else console.log(`${lines.map((line) => `- ${line}`).join("\n")}\n`);
  }
}
