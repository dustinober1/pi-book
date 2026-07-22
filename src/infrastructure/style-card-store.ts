import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { StyleCardSchema, type StyleCard } from "../domain/style-card.js";

function requireStyleId(styleId: string): void {
  if (!/^STYLE-[A-F0-9]{16}$/.test(styleId)) throw new Error("Invalid style card ID.");
}

export function styleCardPath(root: string, styleId: string): string {
  requireStyleId(styleId);
  return join(root, ".pi-book", "index", "style-cards", `${styleId}.json`);
}

export function writeStyleCard(root: string, card: StyleCard): string {
  requireStyleId(card.style_id);
  if (!Value.Check(StyleCardSchema, card)) throw new Error("Invalid style card.");
  const path = styleCardPath(root, card.style_id);
  const directory = join(root, ".pi-book", "index", "style-cards");
  const temporary = join(directory, `.${card.style_id}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(card, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write style card.", { cause: error });
  }
}

export function readStyleCard(root: string, styleId: string): StyleCard | null {
  requireStyleId(styleId);
  const path = styleCardPath(root, styleId);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read style card.", { cause: error });
  }
  if (!Value.Check(StyleCardSchema, value)) throw new Error("Stored style card is invalid.");
  return value as StyleCard;
}
