from pathlib import Path

root = Path('.')

def insert_before(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor}')
    file.write_text(text.replace(anchor, addition + anchor, 1), encoding='utf-8')

# README author-facing workflow.
readme = '''## Premise laboratory

During book planning, use **Compare and select a premise** from `/novel`, or open the optional local surface directly:

```text
/novel-wizard premise
```

The premise laboratory compares **three to five structural versions** of the writer's seed before the book architecture hardens. Variant 1 is the raw-idea baseline or closest faithful expansion. Every version preserves the declared seed elements while changing the story engine, central final-page question, immediate gain, deferred cost, irreversible effect, differentiation, series potential, and accepted tradeoffs.

The comparison uses neutral observations only. Novel Forge does not score, rank, recommend, or choose a premise. The writer explicitly selects a variant, and that choice is recorded in `series/decision-ledger.yaml` before `books/book-NN/premise-lab.yaml` may hold an active selection. Comparison and selection are saved through the state-neutral `premise-update` event, which cannot advance stage, change gates, or modify manuscript, reader, publishing, marketing, or package files.

Only the selected premise's structural consequences enter the book-planning prompt. Nonselected variants, private influence references, and every premise variant's prose remain outside chapter drafting context. Existing approved 1.3 projects without a premise lab remain valid; the file becomes authoritative only when the writer intentionally uses or rebuilds this 1.4 workflow.

'''
insert_before('README.md', '## Guided voice and research wizard\n', readme)

# Skill contract.
skill = '''## Premise laboratory

Use the premise laboratory only during `book-planning`. Generate three to five structurally distinct variants from the writer's raw idea and explicit seed elements. Variant 1 is the raw-idea baseline or closest faithful expansion. Every variant must preserve all seed elements and define a unique normalized story engine, final-page question, immediate gain, deferred cost, irreversible effect, differentiation, series potential, accepted tradeoffs, and neutral diagnostic observations.

Never score, rank, recommend, or automatically select a premise. Never consult private taste-profile influence names when generating premise variants. Save comparison evidence through `premise-update`; save selection only with one matching active writer decision whose scope is the active book, subject is `premise-selection`, and choice is the selected `PV-NNN` ID.

Only the explicitly selected premise may enter book-plan context. Do not place any premise-lab prose, selected or unselected, into chapter drafting context. Existing projects without `premise-lab.yaml` remain readable and retain their approved 1.3 plans until the writer intentionally invokes or rebuilds the premise workflow.

'''
insert_before('SKILL.md', '## Guided research wizard\n', skill)

# Changelog.
insert_before('CHANGELOG.md', '### Changed\n', '- A strict premise laboratory with three-to-five structural variants, a raw-idea baseline, decision-bound writer selection, and a loopback preview/apply wizard.\n')
insert_before('CHANGELOG.md', '### Compatibility\n', '- Book planning can now include only the explicitly selected premise and its structural consequences; chapter drafting context continues to exclude all premise-lab prose.\n')
insert_before('CHANGELOG.md', '### Safety retained\n', '- `premise-update` is state-neutral and may write only the active book premise lab and the decision ledger; it cannot choose a winner or mutate manuscript, reader, publishing, marketing, or package state.\n')

# Release checklist extension.
release = '''### Premise laboratory acceptance

- [ ] New books contain an empty strict `books/book-NN/premise-lab.yaml`.
- [ ] Populated labs contain three to five variants and exactly one order-1 raw-idea baseline.
- [ ] Every variant preserves all declared seed elements and uses a unique normalized story engine.
- [ ] The schema rejects score, rank, winner, and recommendation fields.
- [ ] A selected variant requires one matching active writer decision.
- [ ] `premise-update` works only during book planning and preserves stage, gates, book state, and manuscript bytes.
- [ ] `/novel-wizard premise` provides preview-before-apply comparison and explicit selection.
- [ ] Book-plan prompts include only the selected premise; chapter drafting context includes no premise-lab prose.
- [ ] Existing projects without a premise lab remain readable and retain prior approvals.

'''
insert_before('RELEASE.md', '### Version and compatibility\n', release)

# Plan readability review suggestions.
path = root / 'docs/superpowers/plans/2026-07-16-v1-4-4-premise-lab.md'
text = path.read_text(encoding='utf-8')
replacements = {
'''Prove fewer than three or more than five variants fail; duplicate IDs/orders/story engines fail; order must be contiguous; exactly one baseline exists at order 1; raw idea and seed elements are required once variants exist; every variant preserves all declared seed elements; blank consequence/question/differentiation fields fail; score/rank/winner fields are rejected by the strict schema; selected fields must be paired; unknown selected variant fails; selection without an exact active decision fails; a valid selection passes; selected context includes only the chosen premise and structural consequences; comparison output contains engines/neutral observations but no claimed winner.''': '''Prove:

- fewer than three or more than five variants fail;
- duplicate IDs, orders, or story engines fail;
- order must be contiguous;
- exactly one baseline exists at order 1;
- raw idea and seed elements are required once variants exist;
- every variant preserves all declared seed elements;
- blank consequence, question, or differentiation fields fail;
- score, rank, or winner fields are rejected by the strict schema;
- `selected_variant_id` and `selection_decision_id` must be paired;
- an unknown selected variant fails;
- selection without an exact active decision fails;
- a valid selection passes;
- selected context includes only the chosen premise and structural consequences;
- comparison output contains engines and neutral observations but no claimed winner.''',
'''Prove new books receive an empty strict premise lab; `premise-update` works only during book planning; it accepts the active book premise path alone or with the decision ledger; it rejects empty, inactive-book, manuscript, state, reader, publishing, marketing, package, status, and handoff paths; malformed labs use schema-validation; selection/decision mismatches block before mutation; accepted updates preserve stage/gates/book/manuscript and use `Novel Forge: premise-update`; project hash changes; existing projects with no premise file remain hashable and valid.''': '''Prove:

- new books receive an empty strict premise lab;
- `premise-update` works only during book planning;
- it accepts the active book premise path alone or with the decision ledger;
- it rejects empty, inactive-book, manuscript, state, reader, publishing, marketing, package, status, and handoff paths;
- malformed labs use `schema-validation`;
- selection/decision mismatches block before mutation;
- accepted updates preserve stage, gates, book state, and manuscript bytes and use `Novel Forge: premise-update`;
- project hash changes on update;
- existing projects with no premise file remain hashable and valid.''',
'''Prove snapshot contains raw idea, seed elements, current variants, and active selection but no project root or taste influences; comparison preview validates/stores an opaque candidate and mutates nothing; save-comparison returns through premise-update; selection preview appends one direct writer decision with scope book ID, subject premise-selection, and chosen variant ID; select apply atomically writes lab and ledger; stale stage/hash uses `stale-stage`/`stale-project-hash`; expired preview IDs fail; no score/winner action exists.''': '''Prove:

- snapshot contains raw idea, seed elements, current variants, and active selection but no project root or taste influences;
- comparison preview validates and stores an opaque candidate but mutates nothing;
- `save-comparison` returns through `premise-update`;
- selection preview appends one direct writer decision with book scope, subject `premise-selection`, and the chosen variant ID;
- selection apply atomically writes the lab and ledger;
- stale stage/hash uses `stale-stage` or `stale-project-hash`;
- expired preview IDs fail;
- no score or winner action exists.''',
'''Prove `/novel-wizard premise` completion/launch; book-planning guide offers premise comparison while unselected; premise-generation prompt includes raw idea/seed elements and neutral structural instructions but no taste influence names; selected premise enters book-plan prompt; nonselected variant premise text is absent from book-plan and chapter drafting context; missing/empty premise lab does not fabricate context; book-plan prompt instructs explicit writer selection and premise-update.''': '''Prove:

- `/novel-wizard premise` provides completion and launch;
- the book-planning guide offers premise comparison while unselected;
- the premise-generation prompt includes raw idea, seed elements, and neutral structural instructions but no taste influence names;
- the selected premise enters the book-plan prompt;
- nonselected variant premise text is absent from book-plan and chapter drafting context;
- a missing or empty premise lab does not fabricate context;
- the book-plan prompt instructs explicit writer selection and `premise-update`.'''
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
