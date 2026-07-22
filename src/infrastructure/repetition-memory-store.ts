import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { RepetitionMemorySchema, type RepetitionMemory } from "../domain/repetition-memory.js";

function requireMemoryId(memoryId: string): void {
  if (!/^REP-[A-F0-9]{16}$/.test(memoryId)) throw new Error("Invalid repetition memory ID.");
}

export function repetitionMemoryPath(root: string, memoryId: string): string {
  requireMemoryId(memoryId);
  return join(root, ".pi-book", "index", "repetition-memory", `${memoryId}.json`);
}

export function writeRepetitionMemory(root: string, memory: RepetitionMemory): string {
  requireMemoryId(memory.memory_id);
  if (!Value.Check(RepetitionMemorySchema, memory)) throw new Error("Invalid repetition memory.");
  const path = repetitionMemoryPath(root, memory.memory_id);
  const directory = join(root, ".pi-book", "index", "repetition-memory");
  const temporary = join(directory, `.${memory.memory_id}.${process.pid}.${randomUUID()}.tmp`);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(memory, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
    return path;
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw new Error("Unable to write repetition memory.", { cause: error });
  }
}

export function readRepetitionMemory(root: string, memoryId: string): RepetitionMemory | null {
  requireMemoryId(memoryId);
  const path = repetitionMemoryPath(root, memoryId);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error("Unable to read repetition memory.", { cause: error });
  }
  if (!Value.Check(RepetitionMemorySchema, value)) throw new Error("Stored repetition memory is invalid.");
  return value as RepetitionMemory;
}
