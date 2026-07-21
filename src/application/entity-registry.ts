import type { EntityRegistry } from "../domain/entity-registry.js";

function normalizedLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function labels(displayName: string, aliases: readonly string[]): string[] {
  return [displayName, ...aliases].map(normalizedLabel).filter(Boolean);
}

export function entityRegistryFindings(registry: EntityRegistry): string[] {
  const findings: string[] = [];
  const ids = new Set<string>();
  const labelOwners = new Map<string, { id: string; original: string }>();
  for (const entity of registry.entities) {
    if (ids.has(entity.id)) findings.push(`Duplicate entity ID ${entity.id}.`);
    ids.add(entity.id);
    for (const original of [entity.display_name, ...entity.aliases]) {
      const label = normalizedLabel(original);
      if (!label) {
        findings.push(`Entity ${entity.id} has a blank display name or alias.`);
        continue;
      }
      const owner = labelOwners.get(label);
      if (owner && owner.id !== entity.id) {
        findings.push(`Entity alias ${original} is shared by ${owner.id} and ${entity.id}.`);
      } else if (!owner) {
        labelOwners.set(label, { id: entity.id, original });
      }
    }
  }
  return findings;
}

export function assertValidEntityRegistry(registry: EntityRegistry): void {
  const findings = entityRegistryFindings(registry);
  if (findings.length) {
    throw new Error(`Entity registry validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
  }
}

export function resolveEntityId(registry: EntityRegistry, nameOrAlias: string): string | null {
  assertValidEntityRegistry(registry);
  const requested = normalizedLabel(nameOrAlias);
  if (!requested) return null;
  for (const entity of registry.entities) {
    if (labels(entity.display_name, entity.aliases).includes(requested)) return entity.id;
  }
  return null;
}
