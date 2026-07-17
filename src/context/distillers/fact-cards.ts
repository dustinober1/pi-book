function scalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compact(value: unknown): string {
  if (value === null || typeof value !== "object") return scalar(value);
  if (Array.isArray(value)) return value.map((item) => compact(item)).filter(Boolean).join(" || ");
  return Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${compact(item)}`)
    .join("; ");
}

export function renderFactCards(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item, index) => `- ${index + 1}|${compact(item)}`).join("\n");
  }
  return compact(value);
}

export function renderEndingContext(text: string, maxChars = 2_500): string {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(-maxChars);
}
