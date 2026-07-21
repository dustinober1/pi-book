export interface ContextRecord {
  id: string;
  body: string;
  required: boolean;
  priority: number;
}

export interface ContextSection {
  id: string;
  title: string;
  records: readonly ContextRecord[];
  maxChars: number;
}

export interface ContextAllocationReport {
  characters: number;
  includedRecordIds: string[];
  omittedRecordIds: string[];
  sections: Array<{
    id: string;
    characters: number;
    includedRecordIds: string[];
    omittedRecordIds: string[];
  }>;
}

export class ContextBudgetError extends Error {
  readonly requiredRecordIds: readonly string[];

  constructor(requiredRecordIds: readonly string[]) {
    super(`Context budget cannot fit required records: ${requiredRecordIds.join(", ")}.`);
    this.name = "ContextBudgetError";
    this.requiredRecordIds = [...requiredRecordIds];
  }
}

interface Candidate {
  sectionIndex: number;
  recordIndex: number;
  order: number;
  section: ContextSection;
  record: ContextRecord;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

export function paragraphContextRecords(
  prefix: string,
  text: string,
  priorityBase: number,
  preference: "start" | "end" = "start",
): ContextRecord[] {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) throw new Error("Paragraph context prefix must be nonblank.");
  if (!Number.isFinite(priorityBase)) throw new Error("Paragraph context priority base must be finite.");
  const bodies = text
    .split(/\n\s*\n/u)
    .map((body) => body.trim())
    .filter(Boolean);
  return bodies.map((body, index) => {
    const withinBand = preference === "end"
      ? (index + 1) / (bodies.length + 1)
      : (bodies.length - index) / (bodies.length + 1);
    return {
      id: `${normalizedPrefix}:paragraph:${String(index + 1).padStart(4, "0")}`,
      body,
      required: false,
      priority: priorityBase + withinBand,
    };
  });
}

function recordText(record: ContextRecord): string {
  return `### ${record.id}\n\n${record.body}\n`;
}

function sectionHeader(section: ContextSection): string {
  return `\n## ${section.title}\n\n`;
}

function selectionDelta(candidate: Candidate, selectedCount: number): number {
  return (selectedCount === 0 ? sectionHeader(candidate.section).length : 1) + recordText(candidate.record).length;
}

export function allocateContext(
  sections: readonly ContextSection[],
  maxChars: number,
): { text: string; report: ContextAllocationReport } {
  const maximum = nonnegativeInteger(maxChars, "Context character budget");
  const candidates: Candidate[] = [];
  const seenIds = new Set<string>();
  let order = 0;
  sections.forEach((section, sectionIndex) => {
    nonnegativeInteger(section.maxChars, `Section ${section.id} character budget`);
    section.records.forEach((record, recordIndex) => {
      const id = record.id.trim();
      if (!id) throw new Error(`Context section ${section.id} contains a blank record ID.`);
      if (seenIds.has(id)) throw new Error(`Context record ID ${id} is duplicated.`);
      seenIds.add(id);
      if (!Number.isFinite(record.priority)) throw new Error(`Context record ${id} priority must be finite.`);
      candidates.push({ sectionIndex, recordIndex, order: order++, section, record: { ...record, id } });
    });
  });

  const selected = new Set<string>();
  const selectedOrder: string[] = [];
  const sectionCharacters = sections.map(() => 0);
  const sectionSelectedCounts = sections.map(() => 0);
  let characters = 0;

  const ordered = [...candidates].sort((left, right) =>
    Number(right.record.required) - Number(left.record.required)
    || right.record.priority - left.record.priority
    || left.order - right.order,
  );

  const missingRequired: string[] = [];
  for (const candidate of ordered.filter((item) => item.record.required)) {
    const delta = selectionDelta(candidate, sectionSelectedCounts[candidate.sectionIndex]!);
    const fitsSection = sectionCharacters[candidate.sectionIndex]! + delta <= candidate.section.maxChars;
    const fitsGlobal = characters + delta <= maximum;
    if (!fitsSection || !fitsGlobal) {
      missingRequired.push(candidate.record.id);
      continue;
    }
    selected.add(candidate.record.id);
    selectedOrder.push(candidate.record.id);
    sectionSelectedCounts[candidate.sectionIndex]! += 1;
    sectionCharacters[candidate.sectionIndex]! += delta;
    characters += delta;
  }
  if (missingRequired.length) throw new ContextBudgetError(missingRequired);

  for (const candidate of ordered.filter((item) => !item.record.required)) {
    const delta = selectionDelta(candidate, sectionSelectedCounts[candidate.sectionIndex]!);
    const fitsSection = sectionCharacters[candidate.sectionIndex]! + delta <= candidate.section.maxChars;
    const fitsGlobal = characters + delta <= maximum;
    if (!fitsSection || !fitsGlobal) continue;
    selected.add(candidate.record.id);
    selectedOrder.push(candidate.record.id);
    sectionSelectedCounts[candidate.sectionIndex]! += 1;
    sectionCharacters[candidate.sectionIndex]! += delta;
    characters += delta;
  }

  const renderedSections: string[] = [];
  const sectionReports = sections.map((section, sectionIndex) => {
    const included = section.records.filter((record) => selected.has(record.id));
    const omitted = section.records.filter((record) => !selected.has(record.id));
    if (included.length) {
      renderedSections.push(sectionHeader(section) + included.map(recordText).join("\n"));
    }
    return {
      id: section.id,
      characters: sectionCharacters[sectionIndex]!,
      includedRecordIds: included.map((record) => record.id),
      omittedRecordIds: omitted.map((record) => record.id),
    };
  });
  const text = renderedSections.join("");
  const omittedRecordIds = candidates.filter((candidate) => !selected.has(candidate.record.id)).map((candidate) => candidate.record.id);

  return {
    text,
    report: {
      characters: text.length,
      includedRecordIds: selectedOrder,
      omittedRecordIds,
      sections: sectionReports,
    },
  };
}
