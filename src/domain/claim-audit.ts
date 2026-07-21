import { Type, type Static } from "@sinclair/typebox";

const HashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
const ArtifactFields = {
  schema_version: Type.Literal("1.0.0"),
  run_id: Type.String({ minLength: 1 }),
  chapter: Type.Integer({ minimum: 1 }),
  source_hashes: Type.Array(HashSchema, { minItems: 1, uniqueItems: true }),
  creation_order: Type.Integer({ minimum: 1 }),
};

export const ClaimTypeSchema = Type.Union([
  Type.Literal("factual"),
  Type.Literal("procedural"),
  Type.Literal("chronological"),
  Type.Literal("material"),
  Type.Literal("biographical"),
]);
export const ClaimRiskSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);

export const ProposedClaimSchema = Type.Object({
  id: Type.String({ pattern: "^CLM-[0-9]{3}$" }),
  line_start: Type.Integer({ minimum: 1 }),
  line_end: Type.Integer({ minimum: 1 }),
  text_hash: HashSchema,
  claim_type: ClaimTypeSchema,
  risk: ClaimRiskSchema,
  research_ids: Type.Array(Type.String({ pattern: "^RES-[0-9]{3}$" }), { uniqueItems: true }),
  invention_ids: Type.Array(Type.String({ pattern: "^INV-[0-9]{3}$" }), { uniqueItems: true }),
}, { additionalProperties: false });
export type ProposedClaim = Static<typeof ProposedClaimSchema>;

export const ClaimAuditFindingSchema = Type.Object({
  claim_id: Type.String({ pattern: "^CLM-[0-9]{3}$" }),
  status: Type.Union([
    Type.Literal("supported"),
    Type.Literal("unsupported"),
    Type.Literal("invention"),
  ]),
  anchor_refs: Type.Array(Type.String({ pattern: "^RES-[0-9]{3}#[1-9][0-9]*$" }), { uniqueItems: true }),
  action: Type.Union([
    Type.Literal("accept"),
    Type.Literal("block"),
    Type.Literal("qualify"),
    Type.Literal("generalize"),
    Type.Literal("accept-invention"),
  ]),
  reason: Type.String({ minLength: 1 }),
}, { additionalProperties: false });
export type ClaimAuditFinding = Static<typeof ClaimAuditFindingSchema>;

export const ClaimExtractionArtifactSchema = Type.Object({
  ...ArtifactFields,
  artifact_type: Type.Literal("claim-extraction"),
  claims: Type.Array(ProposedClaimSchema),
}, { additionalProperties: false });
export type ClaimExtractionArtifact = Static<typeof ClaimExtractionArtifactSchema>;

export const ClaimAuditArtifactSchema = Type.Object({
  ...ArtifactFields,
  artifact_type: Type.Literal("claim-audit"),
  findings: Type.Array(ClaimAuditFindingSchema),
}, { additionalProperties: false });
export type ClaimAuditArtifact = Static<typeof ClaimAuditArtifactSchema>;
