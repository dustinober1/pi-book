import { join } from "node:path";
import { PackageManifestSchema, type PackageManifest } from "../../domain/v1-2-schemas.js";
import { readText } from "../../infrastructure/files.js";
import { parseYaml, stringifyYaml } from "../../infrastructure/yaml.js";
import { readBook, readProject } from "../../project/store.js";
import { applyGuidedProjectEvent } from "../handoff.js";
import { buildPackagingChecklist } from "../package-checklist.js";
import { buildPackageArtifacts, type PackageBuildOptions } from "./export.js";

export interface ApplyPackageOptions extends PackageBuildOptions {
  regenerate?: boolean;
  bypassWorkflowChecklist?: boolean;
}

export async function applyPackageArtifacts(root: string, options: ApplyPackageOptions = {}) {
  const checklist = buildPackagingChecklist(root);
  if (!options.bypassWorkflowChecklist && !checklist.ready) {
    const blockers = checklist.items.filter((item) => item.blocking && !item.complete);
    throw new Error(`Packaging is blocked:\n${blockers.map((item) => `- ${item.label}: ${item.detail}`).join("\n")}`);
  }
  const book = structuredClone(readBook(root));
  const project = structuredClone(readProject(root));
  const built = await buildPackageArtifacts(root, options);
  const manifestPath = join(root, "books", book.book_id, "exports", "package-manifest.yaml");
  const existingText = readText(manifestPath);
  if (existingText) {
    const existing = parseYaml<PackageManifest>(existingText, PackageManifestSchema, "package-manifest.yaml");
    if (existing.source_hash !== built.sourceHash && !options.regenerate) throw new Error("Existing package outputs are stale. Confirm regeneration before overwriting them.");
    if (existing.source_hash === built.sourceHash && !options.regenerate) {
      return { changed: [], sourceHash: built.sourceHash, engine: existing.engine, current: true };
    }
  }

  const summary = `# Editorial Package\n\n- Book: ${book.book_id}\n- Source hash: ${built.sourceHash}\n- Chapters: ${built.chapters}\n- Words: ${built.words}\n- Engine: ${built.engine}\n- Full outputs: books/${book.book_id}/exports/\n`;
  const changes = [...built.changes, { path: `books/${book.book_id}/package.md`, content: summary }];
  if (!options.bypassWorkflowChecklist && project.current_stage === "packaging") {
    book.status = "packaged";
    project.gates["package-approval"] = "pending";
    project.next_gate = "package-approval";
    changes.push(
      { path: "PROJECT.yaml", content: stringifyYaml(project) },
      { path: `books/${book.book_id}/BOOK.yaml`, content: stringifyYaml(book) },
    );
  }
  const event = applyGuidedProjectEvent(root, changes, `Novel Forge: package ${book.book_id}`, { lastAction: `Generated complete package for ${book.book_id}` });
  return { changed: event.changed, sourceHash: built.sourceHash, engine: built.engine, current: false };
}
