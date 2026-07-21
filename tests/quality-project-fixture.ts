import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyYaml } from "../src/infrastructure/yaml.js";
import { initializeProject, readProject } from "../src/project/store.js";
import { completePlot, queueFixture } from "./phase4-fixtures.js";

export function createDraftableQualityProject(tier: "economy" | "balanced" | "premium" | "editorial" = "premium") {
  const parent = mkdtempSync(join(tmpdir(), "novel-forge-quality-project-"));
  const root = initializeProject(parent, {
    projectName: "Quality Project",
    projectType: "standalone",
    profile: "thriller",
    runtimeProfile: "full",
  });
  const project = readProject(root);
  project.current_stage = "drafting";
  project.next_gate = null;
  project.quality!.tier = tier;
  writeFileSync(join(root, "PROJECT.yaml"), stringifyYaml(project), "utf8");
  writeFileSync(join(root, "series", "canon.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    facts: [{ id: "CAN-001", category: "access", subject: "Mara", fact: "Mara has archive access.", source: "chapter-00", status: "locked", introduced_in: "book-01" }],
    relationships: [],
  }), "utf8");
  writeFileSync(join(root, "series", "story-threads.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    threads: [{ id: "ST-001", type: "mystery", setup: "The log is missing.", reader_knows: "It existed.", characters_know: { Mara: "It is missing." }, status: "open", intended_payoff: "book-01", last_advanced_in: null }],
  }), "utf8");
  writeFileSync(join(root, "books", "book-01", "plot-grid.yaml"), stringifyYaml(completePlot()), "utf8");
  const queue = queueFixture();
  for (const packet of queue.packets) packet.required_research = [];
  writeFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), stringifyYaml(queue), "utf8");
  writeFileSync(join(root, "books", "book-01", "remarkability.yaml"), stringifyYaml({
    schema_version: "1.0.0",
    safe_obvious_version: "A routine archive breach.",
    author_only_advantage: "Institutional pressure rendered through procedure.",
    productive_discomfort: "Mara protects evidence before safety.",
    retellable_hook: "The building edits its own evacuation record.",
    signature_moments: [{ id: "RM-001", description: "The exit sign changes its testimony.", intended_reader_memory: "The building lies.", planned_location: "chapter-01", status: "planned" }],
    productive_disagreements: [{ question: "Was Mara right to stay?", competing_readings: ["She protected truth.", "She valued proof over people."] }],
    recurring_motifs: [],
    lingering_question: "What evidence is worth a life?",
    hand_sell_reason: "A procedural thriller with a building that falsifies its record.",
    accepted_reader_costs: ["Moral discomfort without reassurance."],
  }), "utf8");
  return { parent, root };
}
