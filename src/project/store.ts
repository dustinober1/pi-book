import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { BookSchema, ProjectSchema, RevisionTicketsSchema, type BookState, type ProjectState, type RevisionTicketsState } from "../domain/schemas.js";
import { findProjectRoot, readText, safeSlug } from "../infrastructure/files.js";
import { parseYaml } from "../infrastructure/yaml.js";
import { applyTransaction, type FileChange } from "../infrastructure/transaction.js";
import { ensureGit } from "../infrastructure/git.js";
import { projectTemplateFiles, type ProjectTemplateOptions } from "./templates.js";

export function initializeProject(parent: string, options: ProjectTemplateOptions): string {
  const root = resolve(parent, safeSlug(options.projectName));
  if (existsSync(join(root, "PROJECT.yaml"))) throw new Error(`Novel Forge project already exists: ${root}`);
  mkdirSync(root, { recursive: true });
  const changes = Object.entries(projectTemplateFiles(options)).map(([path, content]) => ({ path, content }));
  applyTransaction(root, changes, { gitCheckpoint: false });
  mkdirSync(join(root, "books", "book-01", "manuscript", "chapters"), { recursive: true });
  mkdirSync(join(root, "research", "notes"), { recursive: true });
  ensureGit(root);
  return root;
}

export function requireProjectRoot(cwd: string): string {
  const root = findProjectRoot(cwd);
  if (!root) throw new Error(`No Novel Forge project found from ${cwd}. Run /novel-start first.`);
  return root;
}

export function readProject(root: string): ProjectState {
  const path = join(root, "PROJECT.yaml");
  const text = readText(path);
  if (!text) throw new Error(`Missing ${path}`);
  return parseYaml<ProjectState>(text, ProjectSchema, "PROJECT.yaml");
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
