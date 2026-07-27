import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { BookSchema, RevisionTicketsSchema, type BookState, type RevisionTicketsState } from "../domain/schemas.js";
import { ProjectV14Schema, type ProjectStateV14 } from "../domain/v1-4-project-schema.js";
import { childProjectRoots, findProjectRoot, readText, safeSlug } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { applyTransaction, type FileChange } from "../infrastructure/transaction.js";
import { commitWorkflowEvent, ensureGit } from "../infrastructure/git.js";
import { projectTemplateFiles, type ProjectTemplateOptions } from "./templates.js";

export function initializeProject(parent: string, options: ProjectTemplateOptions): string {
  const root = resolve(parent, safeSlug(options.projectName));
  if (existsSync(join(root, "PROJECT.yaml"))) throw new Error(`Novel Forge project already exists: ${root}`);
  mkdirSync(root, { recursive: true });
  const changes = Object.entries(projectTemplateFiles(options)).map(([path, content]) => ({ path, content }));
  applyTransaction(root, changes, { gitCheckpoint: false });
  mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
  mkdirSync(join(root, "research", "notes"), { recursive: true });
  if (ensureGit(root)) commitWorkflowEvent(root, changes.map((change) => change.path), "Novel Forge: initialize project");
  return root;
}

export function requireProjectRoot(cwd: string): string {
  const root = findProjectRoot(cwd);
  if (root) return root;
  // novel-start creates its project one directory below the cwd it was run
  // from, so a command run immediately afterward from that same, unchanged
  // shell directory would otherwise fail to find the project it just made.
  const children = childProjectRoots(cwd);
  if (children.length === 1) return children[0]!;
  if (children.length > 1) {
    throw new Error(`Multiple Novel Forge projects exist directly under ${cwd}: ${children.join(", ")}. Run this command again from inside the one you mean.`);
  }
  throw new Error(`No Novel Forge project found from ${cwd}. Run /novel-start first.`);
}

export function readProject(root: string): ProjectStateV14 {
  const path = join(root, "PROJECT.yaml");
  const text = readText(path);
  if (!text) throw new Error(`Missing ${path}`);
  return parseYaml<ProjectStateV14>(text, ProjectV14Schema, "PROJECT.yaml");
}

export function readBook(root: string, bookId?: string): BookState {
  const project = readProject(root);
  const id = bookId ?? project.active_book;
  const path = join(root, "books", id, "BOOK.yaml");
  const text = readText(path);
  if (!text) throw new Error(`Missing ${path}`);
  return parseYaml<BookState>(text, BookSchema, `${id}/BOOK.yaml`);
}

export function readTickets(root: string, bookId?: string): RevisionTicketsState {
  const project = readProject(root);
  const id = bookId ?? project.active_book;
  const path = join(root, "books", id, "revision-tickets.yaml");
  const text = readText(path);
  if (!text) throw new Error(`Missing ${path}`);
  return parseYaml<RevisionTicketsState>(text, RevisionTicketsSchema, `${id}/revision-tickets.yaml`);
}

export function writeProjectEvent(root: string, changes: FileChange[], message: string): void {
  const project = readProject(root);
  applyTransaction(root, changes, { gitCheckpoint: project.automation.git_checkpoints, commitMessage: message });
}
