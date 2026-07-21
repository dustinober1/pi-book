import { EntityRegistrySchema, type EntityRegistry } from "../../domain/entity-registry.js";
import { assertSchema } from "../../domain/schemas.js";

export interface EntityRegistryFinding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  entity_ids: string[];
}

export function normalizeEntityAlias(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function entityRegistryFindings(registry: EntityRegistry): EntityRegistryFinding[] {
  const findings: EntityRegistryFinding[] = [];
  const blocker = (code: string, message: string, ids: string[]) => findings.push({ severity: "blocker", code, message, entity_ids: ids });
  try {
    assertSchema<EntityRegistry>(EntityRegistrySchema, registry, "Entity registry");
  } catch (error) {
    blocker("invalid-entity-registry", error instanceof Error ? error.message : String(error), []);
    return findings;
  }
  const idOwners = new Map<string, string[]>();
  const aliasOwners = new Map<string, string[]>();
  for (const entity of registry.entities) {
    idOwners.set(entity.id, [...(idOwners.get(entity.id) ?? []), entity.id]);
    if (entity.status === "deprecated") continue;
    for (const alias of [entity.id, entity.display_name, ...entity.aliases]) {
      const normalized = normalizeEntityAlias(alias);
      if (!normalized) continue;
      aliasOwners.set(normalized, [...(aliasOwners.get(normalized) ?? []), entity.id]);
    }
  }
  for (const [id, owners] of idOwners) if (owners.length > 1) blocker("duplicate-entity-id", `Entity ID ${id} is duplicated.`, owners);
  for (const [alias, owners] of aliasOwners) {
    const distinct = [...new Set(owners)];
    if (distinct.length > 1) blocker("entity-alias-collision", `Normalized entity alias ${alias} belongs to multiple active entities.`, distinct);
  }
  return findings;
}

export function assertEntityRegistryValid(registry: EntityRegistry): void {
  const blockers = entityRegistryFindings(registry).filter((finding) => finding.severity === "blocker");
  if (blockers.length) throw new Error(`Entity registry is invalid:\n${blockers.map((finding) => `- ${finding.code}: ${finding.message}`).join("\n")}`);
}

export function resolveEntityReference(registry: EntityRegistry, reference: string): string | null {
  assertEntityRegistryValid(registry);
  const normalized = normalizeEntityAlias(reference);
  if (!normalized) return null;
  for (const entity of registry.entities) {
    if (entity.status === "deprecated") continue;
    if ([entity.id, entity.display_name, ...entity.aliases].some((value) => normalizeEntityAlias(value) === normalized)) return entity.id;
  }
  return null;
}
