import { parseYaml } from "./src/infrastructure/yaml.js";
import { ResearchLedgerSchema } from "./src/domain/v1-3-schemas.js";
import { RemarkabilitySchema } from "./src/domain/schemas.js";
const bad = `schema_version: "1.0.0"
items:
  - id: RES-001
    question: "x"
    status: ready
    confidence: ""
    answer: "a"
    source_ids: ["SRC-001"]
`;
try { parseYaml(bad, ResearchLedgerSchema as never, "books/book-01/research-ledger.yaml"); }
catch (e) { console.log((e as Error).message, "\n"); }
const bad2 = `schema_version: "1.0.0"
safe_obvious_version: a
author_only_advantage: b
productive_discomfort: c
retellable_hook: d
signature_moments:
  - id: SIG-001
    description: x
    intended_reader_memory: y
    planned_location: chapter-1
    status: planned
    sensory_note: extra
productive_disagreements: []
recurring_motifs: []
lingering_question: l
hand_sell_reason: h
accepted_reader_costs: []
`;
try { parseYaml(bad2, RemarkabilitySchema as never, "books/book-01/remarkability.yaml"); }
catch (e) { console.log((e as Error).message); }
