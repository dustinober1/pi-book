import type { ActiveContextCapsule, ActiveContextRecord } from "../domain/active-context-capsule.js";

export type ActiveContextRenderStyle = "compact" | "standard";

export interface ActiveContextRenderOptions {
  style: ActiveContextRenderStyle;
}

function payload(record: ActiveContextRecord): string {
  return JSON.stringify(record.payload);
}

function compactRecord(record: ActiveContextRecord): string {
  return `- ${record.id} | Authority: ${record.authority} | Type: ${record.kind} | ${payload(record)}`;
}

function standardRecord(record: ActiveContextRecord): string {
  return [
    `### ${record.id}`,
    `Authority: ${record.authority}`,
    `Status: ${record.status}`,
    `Type: ${record.kind}`,
    `Reason included: ${record.reason}`,
    `Source: ${record.source_path}`,
    `Version: ${record.version}`,
    `Payload: ${payload(record)}`,
  ].join("\n");
}

function recordSection(title: string, records: ActiveContextRecord[], style: ActiveContextRenderStyle): string[] {
  if (!records.length) return [title, "_none_"];
  return [
    title,
    ...records.map((record) => style === "compact" ? compactRecord(record) : standardRecord(record)),
  ];
}

function contractSection(capsule: ActiveContextCapsule, style: ActiveContextRenderStyle): string[] {
  const scene = capsule.scene_contract;
  if (style === "compact") {
    return [
      "SCENE CONTRACT",
      `- Scene: ${scene.scene_id}`,
      `- POV: ${scene.pov}`,
      `- Objective: ${scene.objective}`,
      `- Conflict: ${scene.conflict}`,
      `- Turn: ${scene.turn}`,
      `- Required beats: ${scene.required_beats.join(" | ")}`,
      `- Forbidden changes: ${scene.forbidden_changes.join(" | ") || "none"}`,
      `- Word range: ${scene.target_words.minimum}-${scene.target_words.maximum}`,
      `- Ending requirement: ${scene.ending_requirement}`,
    ];
  }
  return [
    "SCENE CONTRACT",
    JSON.stringify(scene, null, 2),
  ];
}

export function renderActiveContextCapsule(
  capsule: ActiveContextCapsule,
  options: ActiveContextRenderOptions,
): string {
  const established = capsule.records.filter((record) => record.authority === "established");
  const requirements = capsule.records.filter((record) => record.authority !== "established");
  const lines = [
    "NON-NEGOTIABLE RULES",
    ...capsule.opening_rules.map((rule) => `- ${rule}`),
    "",
    ...contractSection(capsule, options.style),
    "",
    ...recordSection("ESTABLISHED RECORDS", established, options.style),
    "",
    ...recordSection("REQUIREMENTS AND PROPOSALS", requirements, options.style),
  ];
  if (capsule.previous_tail !== null) lines.push("", "PREVIOUS TAIL", capsule.previous_tail);
  if (capsule.style_card !== null) lines.push("", "STYLE CARD", capsule.style_card);
  lines.push(
    "",
    "EXACT TASK",
    ...capsule.closing_task.map((task) => `- ${task}`),
  );
  return lines.join("\n");
}
