import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { ChapterPacket, GenreConfig, PlotGridState } from "../domain/schemas.js";
import type { NovelProfile, ProfileFinding } from "./types.js";

const requiredProfileFields = [
  "historical_risk",
  "chronology_refs",
  "constraint_refs",
  "invention_refs",
  "knowledge_boundary",
  "historical_pressure",
  "material_world",
] as const;

const idArray = (prefix: string, minimum = 0) => Type.Array(
  Type.String({ pattern: `^${prefix}-[0-9]{3}$` }),
  { minItems: minimum, uniqueItems: true },
);

const profileFieldsSchema = Type.Object({
  historical_risk: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
  chronology_refs: idArray("HIST"),
  constraint_refs: idArray("HC", 1),
  invention_refs: idArray("INV"),
  knowledge_boundary: Type.String({ pattern: "^KB-[0-9]{3}$" }),
  historical_pressure: Type.String({ minLength: 1 }),
  material_world: Type.String({ minLength: 1 }),
}, { additionalProperties: true });

const genreSettingsSchema = Type.Object({
  story_mode: Type.Union([
    Type.Literal("literary"), Type.Literal("family-saga"), Type.Literal("romance"),
    Type.Literal("mystery"), Type.Literal("adventure"), Type.Literal("war"),
    Type.Literal("political"), Type.Literal("biographical"), Type.Literal("other"),
  ]),
  relationship_to_history: Type.Union([
    Type.Literal("fictional-characters-documented-setting"),
    Type.Literal("fictional-characters-documented-events"),
    Type.Literal("real-person-centered"),
    Type.Literal("mixed"),
  ]),
  accuracy_contract: Type.Union([
    Type.Literal("balanced"), Type.Literal("authenticity-first"), Type.Literal("story-first"),
  ]),
  prose_register: Type.Union([
    Type.Literal("period-shaped-readable"), Type.Literal("deep-immersion"),
    Type.Literal("contemporary-accessible"),
  ]),
  real_person_policy: Type.Union([
    Type.Literal("background-only"), Type.Literal("evidence-and-restraint"),
    Type.Literal("central-with-heightened-review"),
  ]),
  counterfactual_policy: Type.Union([
    Type.Literal("prohibit-major"), Type.Literal("explicit-writer-approved"),
  ]),
}, { additionalProperties: false });

const genreRequirementsSchema = Type.Object({
  risk_based_research: Type.Literal(true),
  chronology_control: Type.Literal("required"),
  invention_tracking: Type.Literal("required"),
  knowledge_boundaries: Type.Literal("required"),
  material_causality: Type.Literal("required"),
  anachronism_review: Type.Literal("required"),
  portrayal_review: Type.Literal("required"),
  historical_note: Type.Literal("conditional"),
}, { additionalProperties: false });

function schemaFinding(schema: object, value: unknown, category: string): ProfileFinding[] {
  return Value.Check(schema as never, value)
    ? []
    : [{ severity: "blocker", category, message: `Invalid ${category} values for the historical-fiction profile.` }];
}

function packetFieldFindings(packet: ChapterPacket): ProfileFinding[] {
  const fields = packet.profile_fields;
  const checks: Record<(typeof requiredProfileFields)[number], boolean> = {
    historical_risk: fields["historical_risk"] === "low" || fields["historical_risk"] === "medium" || fields["historical_risk"] === "high",
    chronology_refs: Array.isArray(fields["chronology_refs"]),
    constraint_refs: Array.isArray(fields["constraint_refs"]) && fields["constraint_refs"].length > 0,
    invention_refs: Array.isArray(fields["invention_refs"]),
    knowledge_boundary: typeof fields["knowledge_boundary"] === "string" && /^KB-[0-9]{3}$/.test(fields["knowledge_boundary"]),
    historical_pressure: typeof fields["historical_pressure"] === "string" && fields["historical_pressure"].trim().length > 0,
    material_world: typeof fields["material_world"] === "string" && fields["material_world"].trim().length > 0,
  };
  const findings = requiredProfileFields.flatMap((field) => checks[field]
    ? []
    : [{
      severity: "blocker" as const,
      category: "historical-fiction-packet",
      message: `Missing or invalid historical-fiction packet field: ${field}`,
    }]);
  if (!Value.Check(profileFieldsSchema, fields)) {
    findings.push({
      severity: "blocker",
      category: "historical-fiction-packet",
      message: "Historical-fiction packet references must use canonical IDs and valid value types.",
    });
  }
  return findings;
}

export const historicalFictionProfile: NovelProfile = {
  id: "historical-fiction",
  label: "Historical Fiction",
  profileFieldsSchema,
  genreSettingsSchema,
  genreRequirementsSchema,
  defaultGenreConfig() {
    return {
      schema_version: "1.0.0",
      profile: "historical-fiction",
      settings: {
        story_mode: "literary",
        relationship_to_history: "fictional-characters-documented-setting",
        accuracy_contract: "balanced",
        prose_register: "period-shaped-readable",
        real_person_policy: "evidence-and-restraint",
        counterfactual_policy: "prohibit-major",
      },
      requirements: {
        risk_based_research: true,
        chronology_control: "required",
        invention_tracking: "required",
        knowledge_boundaries: "required",
        material_causality: "required",
        anachronism_review: "required",
        portrayal_review: "required",
        historical_note: "conditional",
      },
    };
  },
  planningQuestions: [
    "What dates, places, institutions, material constraints, and documented events define the story's historical boundary?",
    "Which claims require research, and which uncertainties must remain visibly unresolved?",
    "Where may documented chronology be compressed without changing major historical causality?",
    "What could each point-of-view character plausibly know at that moment?",
    "Which real people appear, and what evidence and restraint govern their portrayal?",
    "Which inferred, composite, invented, or counterfactual elements need explicit tracking or disclosure?",
  ],
  chapterPacketRequirements: requiredProfileFields,
  bookPlanRules: [
    "Complete historical-context.yaml with ordered chronology, period constraints, knowledge boundaries, language conventions, uncertainties, and settings that exactly match genre.yaml.",
    "Complete invention-ledger.yaml for every documented, inferred, compressed, composite, invented, or counterfactual intervention that affects the story.",
    "High-risk historical claims require ready, non-low-confidence RES-NNN evidence with registered source provenance; medium-risk claims require evidence or an explicit invention.",
    "A required invention decision uses subject historical-invention:INV-NNN and choice accept:<classification>:<risk>:<disclosure>; major counterfactuals also require explicit-writer-approved policy.",
    "Do not invent citations, quotations, archive holdings, source titles, URLs, or conclusions; preserve contested evidence and uncertainty.",
  ],
  bookPlanOutputs: [
    "historical-context.yaml",
    "invention-ledger.yaml",
  ],
  milestoneReviewLanes: [
    "chronology and historical causality",
    "research provenance and uncertainty",
    "anachronism, language, and material culture",
    "knowledge boundaries and point-of-view plausibility",
    "real-person and community portrayal",
    "invention, compression, composite, and counterfactual disclosure",
    "story pressure, character agency, voice, and line quality",
  ],
  draftingRules: [
    "Keep each point-of-view character inside the knowledge available to them at that moment.",
    "Make historical pressure operate through material conditions, institutions, custom, labor, travel, and consequence.",
    "Do not convert uncertainty into fact or silently invent support for a high-risk claim.",
    "Use period-shaped language without sacrificing reader comprehension or importing unapproved anachronism.",
    "Treat real people and affected communities with evidence, restraint, and explicit portrayal review.",
    "Keep every compression, composite, invention, and counterfactual consistent with the invention ledger.",
  ],
  validatePacket(packet: ChapterPacket) {
    return packetFieldFindings(packet);
  },
  validateGenreConfig(config: GenreConfig) {
    if (config.profile !== "historical-fiction") {
      return [{ severity: "blocker", category: "genre", message: "Genre profile is not historical-fiction." }];
    }
    return [
      ...schemaFinding(genreSettingsSchema, config.settings, "historical-fiction settings"),
      ...schemaFinding(genreRequirementsSchema, config.requirements, "historical-fiction requirements"),
    ];
  },
  validatePlot(plot: PlotGridState) {
    const findings: ProfileFinding[] = [];
    if (!plot.chapters.length) {
      findings.push({ severity: "blocker", category: "architecture", message: "Historical-fiction plot grid has no chapters." });
    }
    if (plot.chapters.some((chapter) => !chapter.state_change.trim() || /^none$/i.test(chapter.state_change))) {
      findings.push({ severity: "high", category: "causality", message: "Historical-fiction plot contains a no-state-change chapter." });
    }
    return findings;
  },
  endingRules: [
    "Resolve the fictional arc without falsifying the documented historical outcome.",
    "Preserve declared uncertainty instead of manufacturing retrospective certainty.",
    "Make the final consequence follow established material, institutional, and character causality.",
    "Carry every disclosure-worthy invention into the Historical Note.",
  ],
};
