from pathlib import Path

root = Path('.')

# Templates: import and seed the strict empty premise lab.
path = root / 'src/project/templates.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('import { defaultDecisionLedger, defaultIntake } from "../domain/v1-4-schemas.js";', 'import { defaultDecisionLedger, defaultIntake, defaultPremiseLab } from "../domain/v1-4-schemas.js";')
anchor = '    [`${base}/voice-audits.yaml`]: stringifyYaml(defaultVoiceAudits()),\n'
if 'premise-lab.yaml' not in text:
    text = text.replace(anchor, anchor + '    [`${base}/premise-lab.yaml`]: stringifyYaml(defaultPremiseLab(bookId)),\n', 1)
path.write_text(text, encoding='utf-8')

# Project hash: premise evidence participates even when missing on legacy projects.
path = root / 'src/application/project-hash.ts'
text = path.read_text(encoding='utf-8')
anchor = '    `books/${bookId}/voice-audits.yaml`,\n'
if 'premise-lab.yaml' not in text:
    text = text.replace(anchor, anchor + '    `books/${bookId}/premise-lab.yaml`,\n', 1)
path.write_text(text, encoding='utf-8')

# Events: state-neutral book-planning event plus overlay validation.
path = root / 'src/application/events.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('import { DecisionLedgerSchema, IntakeSchema, intakeDecisionFindings, type DecisionLedger, type IntakeState } from "../domain/v1-4-schemas.js";', 'import { DecisionLedgerSchema, IntakeSchema, PremiseLabSchema, intakeDecisionFindings, type DecisionLedger, type IntakeState, type PremiseLab } from "../domain/v1-4-schemas.js";')
if 'from "./premise-lab.js"' not in text:
    text = text.replace('import { projectStateHash } from "./project-hash.js";\n', 'import { projectStateHash } from "./project-hash.js";\nimport { premiseLabFindings } from "./premise-lab.js";\n')
text = text.replace('| "intake-update" | "revise"', '| "intake-update" | "premise-update" | "revise"')
text = text.replace('  "intake-update": ["voice-intake", "series-planning", "book-planning"],\n', '  "intake-update": ["voice-intake", "series-planning", "book-planning"],\n  "premise-update": ["book-planning"],\n')
text = text.replace('    "intake-update": ["series/intake.yaml", "series/decision-ledger.yaml"],\n', '    "intake-update": ["series/intake.yaml", "series/decision-ledger.yaml"],\n    "premise-update": [`${book}/premise-lab.yaml`, "series/decision-ledger.yaml"],\n')
text = text.replace('  if (input.eventType === "intake-update" && input.files.length === 0) throw new Error("intake-update requires at least one intake evidence file.");\n', '  if (input.eventType === "intake-update" && input.files.length === 0) throw new Error("intake-update requires at least one intake evidence file.");\n  if (input.eventType === "premise-update" && input.files.length === 0) throw new Error("premise-update requires at least one premise evidence file.");\n')
validation = '''  if (input.eventType === "premise-update" || (input.eventType === "book-plan" && overlay(root, input.files, `books/${book.book_id}/premise-lab.yaml`))) {
    const lab = parseOverlay<PremiseLab>(root, input.files, `books/${book.book_id}/premise-lab.yaml`, PremiseLabSchema);
    const ledger = parseOverlay<DecisionLedger>(root, input.files, "series/decision-ledger.yaml", DecisionLedgerSchema);
    const blockers = premiseLabFindings(lab, ledger).filter((finding) => finding.severity === "blocker");
    if (input.eventType === "book-plan" && lab.variants.length > 0 && (!lab.selected_variant_id || !lab.selection_decision_id)) {
      blockers.push({ severity: "blocker", code: "unselected-premise", message: "A rebuilt book plan requires an explicitly selected premise variant." });
    }
    if (blockers.length) throw new Error(`Premise validation blocked the event:\n${blockers.map((item) => `- ${item.message}`).join("\n")}`);
  }
'''
anchor = '  if (input.eventType === "intake-update") {\n'
if validation.strip() not in text:
    text = text.replace(anchor, validation + anchor, 1)
path.write_text(text, encoding='utf-8')
