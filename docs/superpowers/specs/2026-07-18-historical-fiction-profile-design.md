# Novel Forge 1.5 Historical Fiction Profile Design

## Purpose

Novel Forge 1.5 adds `historical-fiction` as a first-class profile beside thriller and romantasy. The profile supports broad, research-grounded historical fiction across eras, regions, and story modes without creating a separate author workflow.

The default contract is balanced: verified history anchors the book, documented gaps may be filled with clearly tracked invention, and prose remains readable while reflecting the period's worldview, constraints, and material reality. Historical information must change character options and story causality rather than function as decorative setting.

## Product boundary

The normal author flow remains `/novel-start` followed by `/novel`. Historical-fiction projects use the existing intake, voice, series planning, book planning, chapter queue, drafting, review, revision, reader-evidence, recovery, and packaging stages. The current research wizard remains the optional visual surface.

The release adds no historical-only command, top-level stage, browser workspace, remote service, automatic web scraper, citation manager, or alternate-history workflow. It does not refactor profiles into composable overlays. Profile schemas should avoid assumptions that would prevent a future overlay design, but genre composition is out of scope.

## Profile identity and settings

Extend `ProfileIdSchema`, profile registration, command parsing, migration choices, organizer inputs, next-book selection, templates, package metadata, documentation, and tests with the canonical ID `historical-fiction` and display label `Historical Fiction`.

The historical genre configuration uses these settings:

- `story_mode`: `literary`, `family-saga`, `romance`, `mystery`, `adventure`, `war`, `political`, `biographical`, or `other`;
- `relationship_to_history`: `fictional-characters-documented-setting`, `fictional-characters-documented-events`, `real-person-centered`, or `mixed`;
- `accuracy_contract`: `balanced`, `authenticity-first`, or `story-first`;
- `prose_register`: `period-shaped-readable`, `deep-immersion`, or `contemporary-accessible`;
- `real_person_policy`: `background-only`, `evidence-and-restraint`, or `central-with-heightened-review`;
- `counterfactual_policy`: `prohibit-major` or `explicit-writer-approved`.

New projects default to `literary`, `fictional-characters-documented-setting`, `balanced`, `period-shaped-readable`, `evidence-and-restraint`, and `prohibit-major`. Story mode changes reader-promise guidance but does not silently import thriller or romance profile requirements.

The profile requirements are typed as required contracts for risk-based research, chronology control, invention tracking, character knowledge boundaries, material and institutional causality, anachronism review, portrayal review, and conditional Historical Note disclosure.

## Durable historical artifacts

Every historical-fiction book owns two additional guarded files:

```text
books/<book-id>/historical-context.yaml
books/<book-id>/invention-ledger.yaml
```

They are required outputs of a historical-fiction `book-plan` event, allowed through a historical-fiction `research-update`, included in the project hash, included in integrity checks, and conditionally loaded into bounded drafting and review context. They are not created for thriller or romantasy books.

### Historical context

`historical-context.yaml` is the compact model of the period. It contains:

- schema version and book ID;
- human-readable temporal scope, geographic scope, and calendar/date conventions;
- the selected accuracy, prose, real-person, and counterfactual contracts copied from `genre.yaml` for integrity comparison;
- a chronology with stable `HIST-NNN` IDs, explicit sequence numbers, display dates, certainty, event descriptions, source IDs, research IDs, and story effects;
- period constraints with stable `HC-NNN` IDs, category, statement, dramatic consequence, source IDs, research IDs, risk, and confidence;
- character or group knowledge boundaries tied to chronology IDs;
- language and dialogue conventions, including translation choices and prohibited modern idioms or faux-archaic habits;
- declared uncertainties, contested interpretations, and research gaps.

Chronology uses integer sequence plus a display label instead of assuming Gregorian or ISO dates. This supports BCE dates, regnal years, non-Gregorian calendars, disputed dates, and deliberately approximate chronology without fragile date parsing. Sequence values must be unique and ordered; references must resolve.

Constraint categories include political, institutional, legal, social, economic, religious, medical, military, geographic, material, transport, communication, linguistic, and other. Each constraint must state how it changes available choices, costs, risks, relationships, or timing.

### Invention ledger

`invention-ledger.yaml` separates historical evidence from narrative invention. Each `INV-NNN` entry contains:

- a concise claim or intervention;
- classification: `documented`, `inferred`, `compressed`, `composite`, `invented`, or `counterfactual`;
- risk: `low`, `medium`, or `high`;
- source and research IDs;
- rationale and story necessity;
- affected chapter numbers;
- portrayal or continuity risks;
- disclosure level: `none`, `historical-note`, or `prominent`;
- an optional writer-decision ID when explicit approval is required.

`documented` entries require supporting evidence. `inferred` entries require evidence for the surrounding facts and must not be described as documented. High-risk compression, composites, invention involving a real person, and every counterfactual entry require an unreplaced writer decision. Major counterfactual changes are blocked when the profile policy is `prohibit-major`.

The ledger is not a license to fill every unknown with invented certainty. Unknowns may remain unknown, characters may be wrong, and the narrative may preserve ambiguity.

## Research and source contract

Historical fiction continues to use `research/source-register.yaml` and the book's existing `research-ledger.yaml`. The two historical artifacts reference those sources rather than duplicating source descriptions.

Research risk is evaluated as follows:

- High risk: real-person conduct or interiority, major events and dates, law and institutions, identity and marginalized-group portrayal, medicine, military operations, plot-critical mechanisms, and facts whose failure would break reader trust. A ready packet must cite ready research evidence; unsupported material must be reclassified as inference or invention and pass the applicable writer gate.
- Medium risk: occupations, prices, domestic practice, travel time, communication, material culture, geography, and recurring social behavior. These require evidence or an explicit uncertainty/invention entry before confident use.
- Low risk: non-consequential atmosphere and connective texture. These may remain provisional, but prose must not present uncertain specificity as verified fact.

A source-register entry supporting a ready historical claim must name the corresponding `RES-NNN` item. No prompt may invent citations, titles, quotations, archival holdings, URLs, or source conclusions. When research tools are available, prefer primary sources and authoritative scholarship; contested claims must preserve disagreement and confidence limits.

The package does not scrape or browse on its own. It may store sources supplied by the writer or gathered through an available research tool after provenance is verified.

## Planning contract

Historical profile questions guide the existing short, one-question-at-a-time interview. Planning must resolve:

- the exact time, place, and historical hinge that make this story possible;
- the relationship between fictional characters, real people, and documented events;
- what is documented, contested, unknown, compressed, or invented;
- what each viewpoint character can plausibly know at each point;
- which social, material, institutional, geographic, and communication constraints create pressure;
- how the chosen period changes the protagonist's values and options rather than merely changing scenery;
- the dialogue translation convention and acceptable period flavor;
- the external and emotional ending contracts, including any required historical disclosure.

Book planning must produce complete `historical-context.yaml` and `invention-ledger.yaml` files in the same atomic event as the existing book-plan bundle. The book-plan gate remains the writer's approval point.

## Chapter packet contract

The historical profile schema requires these `profile_fields` on every ready packet:

- `historical_risk`: `low`, `medium`, or `high`;
- `chronology_refs`: an array of valid `HIST-NNN` IDs;
- `constraint_refs`: a non-empty array of valid `HC-NNN` IDs;
- `invention_refs`: an array of valid `INV-NNN` IDs;
- `knowledge_boundary`: what the viewpoint character knows, believes, mistakes, or cannot yet know;
- `historical_pressure`: how period conditions change the scene's choices, stakes, timing, or consequences;
- `material_world`: the physical, economic, geographic, or institutional detail doing active scene work.

All referenced IDs must resolve. High-risk packets require at least one ready `RES-NNN` reference and may not rely only on low-confidence sources. Medium-risk packets require ready research or a matching uncertainty/invention entry. Low-risk packets may omit research IDs.

A packet is blocked when its history could be removed without changing the scene's action or consequence. This check is expressed through the required constraint and historical-pressure fields and confirmed during review rather than through keyword counting alone.

## Drafting and context assembly

The context builder adds a bounded `Historical scene contract` only for historical-fiction books. It includes:

1. the active packet's historical risk and pressure;
2. only referenced chronology, constraint, knowledge-boundary, and invention entries;
3. only explicitly required ready research claims and source provenance;
4. the approved prose and dialogue conventions;
5. relevant unresolved uncertainty and disclosure notes.

Unreferenced period research, raw source text, unrelated chronology, private influence names, and whole-ledger dumps stay out of chapter context. Existing graph depth, ordering, later-book, and provisional-record protections remain in force.

Historical drafting defaults to period-shaped readable prose:

- use modern clarity without modern social assumptions, therapy language, idioms, or knowledge leakage;
- avoid theatrical faux-archaic diction and indiscriminate dialect spelling;
- make institutions, labor, money, weather, travel, communication, illness, religion, class, gender, and custom alter behavior where relevant;
- reveal the world through desire, work, conflict, error, and consequence rather than tour-guide exposition;
- do not flatten a culture into one worldview or turn a protagonist into a token modern dissenter;
- do not use grime, odor, cruelty, costume, food, or famous names as interchangeable authenticity decoration;
- preserve uncertainty, contradiction, silence, and historically plausible misinterpretation;
- keep the writer's approved voice evidence above genre defaults.

## Review and revision

Historical milestone and manuscript reviews add these lanes:

- chronology, causality, and character-age consistency;
- anachronisms, presentism, and impossible knowledge;
- evidence provenance and invention-ledger compliance;
- real-person, cultural, religious, and marginalized-group portrayal;
- legal, political, institutional, medical, military, geographic, linguistic, and material plausibility where relevant;
- exposition load and decorative research;
- period-shaped voice, dialogue, subtext, and character agency;
- narrative force independent of the reader already knowing the historical outcome.

Review findings become evidence-backed revision tickets. Audits do not rewrite prose, change an invention classification, accept historical risk, or approve a counterfactual choice automatically. A changed chronology or invention decision must identify affected chapters and trigger targeted regression review before packaging.

The profile ending rules require the protagonist's choices to create the book's narrative resolution. A known historical event cannot substitute for a climax. Standalone external and emotional promises must close even when history beyond the final page remains open.

## Packaging

When the invention ledger contains any `historical-note` or `prominent` disclosure, packaging derives a draft `historical-note.md`. It distinguishes documented events, contested interpretations, compression, composites, invented characters or scenes, and deliberate departures without claiming unsupported certainty.

The writer must approve the Historical Note as package copy. Packaging does not force disclosure of harmless scene-level invention or reveal avoidable spoilers when a concise category-level disclosure preserves reader trust.

## Transactions and failure behavior

Historical artifacts use the existing event transaction, expected-stage and project-hash checks, file allowlists, schema validation, reference validation, rollback, guidance refresh, and Git checkpoint behavior.

`book-plan` requires the two historical files only when the active book uses `historical-fiction`. `research-update` may update them only for a historical-fiction book and may not change project stage, gates, manuscript prose, or approvals. Thriller and romantasy events reject these paths.

Missing files, unresolved IDs, invalid chronology sequences, policy mismatches, unsupported ready claims, or missing writer decisions produce the existing structured schema- or reference-validation rejection envelope with concise actionable issues. The event writes nothing and leaves the stage unchanged. Retry policy remains unchanged: only corrected schema or reference payloads are eligible for one resubmission.

Research updates made after drafting do not trigger automatic prose revision. They identify affected chapters through ledger references and surface an advisory requiring historical regression review.

## Compatibility and migration

Existing thriller and romantasy projects remain byte-for-byte compatible and receive no historical artifacts or warnings. Existing profile defaults and tests must continue to pass.

New historical-fiction projects and new historical-fiction installments receive both artifacts from templates. `novel-migrate`, repository organization, brief bootstrap, next-book inheritance, adoption, and command-line profile parsing accept `historical-fiction`.

A hand-edited or pre-release project that declares `historical-fiction` but lacks the new artifacts receives a precise backfill advisory during non-drafting stages and a blocker before a chapter becomes ready. Novel Forge must not fabricate historical evidence, invention decisions, or approvals to silence the advisory.

Profile choice remains per book. A series may contain books with different profiles, but a historical-fiction installment does not inherit another profile's requirements automatically.

## Documentation and release surface

Update the package description, keywords, README, installed `SKILL.md`, agent metadata, release notes, profile YAML, command help, quick-start examples, and profile lists. Documentation should show both a new standalone historical novel and a historical series example.

The release target is `1.5.0`, reflecting a new public genre capability without breaking existing project schemas.

## Testing and acceptance criteria

Implementation follows test-driven development. Add focused coverage for:

- historical profile defaults, settings, requirements, packet schema, planning questions, drafting rules, review lanes, plot findings, and ending rules;
- initialization templates and conditional absence from thriller and romantasy projects;
- command, migration, organizer, brief, wizard, next-book, and adoption profile selection;
- complete historical book-plan bundles and rejection of missing artifacts;
- historical path isolation for non-historical profiles;
- project-hash changes when either historical artifact changes;
- chronology sequence and cross-reference validation;
- invention classification, disclosure, policy, and writer-decision validation;
- high-, medium-, and low-risk research behavior;
- source-register and research-ledger provenance checks;
- bounded historical context inclusion and unrelated-research exclusion;
- transaction rollback and unchanged stage on rejection;
- drafting, review, revision, packaging, recovery, standalone, and planned-series journeys;
- Historical Note generation and writer-approval blocking;
- prompt snapshots and compact-runtime budget behavior;
- regression coverage for all thriller and romantasy fixtures.

Release verification requires the supported Node matrix and the existing full checks:

```bash
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Acceptance requires all checks to pass, the packed package to include the historical profile and templates, and no existing profile journey to change except where a shared profile selector intentionally gains the new choice.

## Explicit non-goals

- A dedicated historical research or chronology browser UI
- Automatic browsing, scraping, citation discovery, or archive access
- A general-purpose academic citation manager
- Automatic calendar conversion across all historical systems
- Line-by-line factual verification by keyword matching
- Composable genre overlays
- Alternate history as a supported default story mode
- Automatic sensitivity approval or expert-review substitution
- Automatic rewriting after research or audit findings
