import type { ChapterContract } from "../../domain/chapter-contract.js";
import { stringifyYaml } from "../../infrastructure/yaml.js";

export function renderChapterContract(contract: ChapterContract): string {
  return stringifyYaml(contract);
}
