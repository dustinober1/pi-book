import { ChapterContractSchema, type ChapterContract } from "../../domain/chapter-contract.js";
import { assertSchema } from "../../domain/schemas.js";
import { stringifyYaml } from "../../infrastructure/yaml.js";

export interface RenderedChapterContract {
  path: string;
  content: string;
}

export function chapterContractPath(bookId: string, chapter: number): string {
  if (!/^book-[0-9]{2}$/.test(bookId)) throw new Error("Book ID must use book-NN format.");
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 999) throw new Error("Chapter must be an integer from 1 to 999.");
  return `books/${bookId}/contracts/chapters/CH-${String(chapter).padStart(3, "0")}.yaml`;
}

export function renderChapterContract(bookId: string, contract: ChapterContract): RenderedChapterContract {
  assertSchema<ChapterContract>(ChapterContractSchema, contract, `Chapter contract ${contract.contract_id}`);
  if (contract.contract_id !== `CH-${String(contract.chapter).padStart(3, "0")}`) {
    throw new Error(`Chapter contract ID ${contract.contract_id} does not match Chapter ${contract.chapter}.`);
  }
  return {
    path: chapterContractPath(bookId, contract.chapter),
    content: stringifyYaml(contract),
  };
}
