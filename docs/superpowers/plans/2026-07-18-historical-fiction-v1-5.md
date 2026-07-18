# Historical Fiction v1.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Add a first-class, accuracy-aware historical-fiction profile and publish it as installable release `v1.5.0`.

**Architecture:** Historical fiction remains a normal per-book Novel Forge profile, using the existing `/novel` workflow and research wizard. Two profile-only guarded artifacts hold historical context and invention decisions; a dedicated validator joins those artifacts to chapter packets, research evidence, writer decisions, prompts, integrity checks, and packaging. Existing thriller and romantasy projects retain their current files and behavior.

**Tech Stack:** TypeScript, TypeBox, YAML, Node.js test runner, npm, GitHub Actions, Git tags.

## Global Constraints

- Preserve every existing thriller and romantasy behavior and test.
- Follow test-driven development: add a failing focused test, run it, implement the smallest coherent change, then rerun it.
- Use canonical profile ID `historical-fiction` and never infer a profile from prose.
- Keep historical artifacts conditional: only historical-fiction books receive or require them.
- Keep prompts bounded: include only chapter-referenced chronology, constraints, inventions, knowledge boundaries, and research.
- Treat `genre.yaml.settings` as authoritative and require `historical-context.yaml.settings` to match it.
- Require explicit writer approval for major counterfactual inventions.
- Commit each task independently and leave version/tag creation until all implementation checks pass.

---

### Task 1: Register the historical-fiction profile contract

**Files:**
- Modify: `src/domain/schemas.ts`
- Modify: `src/profiles/types.ts`
- Modify: `src/profiles/index.ts`
- Create: `src/profiles/historical-fiction.ts`
- Create: `profiles/historical-fiction.yaml`
- Modify: `tests/profiles.test.ts`
- Modify: `tests/profile-hardening.test.ts`

**Step 1: Write failing profile tests**

Add assertions that `getProfile("historical-fiction")` returns the new profile, defaults to the approved six settings, accepts the approved enum values, rejects unknown/wrongly typed settings, exposes the required historical planning questions/review lanes/drafting rules, and validates required chapter packet fields:

```ts
const historical = getProfile("historical-fiction");
assert.equal(historical.id, "historical-fiction");
assert.deepEqual(historical.defaultGenreConfig.settings, {
  story_mode: "literary",
  relationship_to_history: "fictional-characters-documented-setting",
  accuracy_contract: "balanced",
  prose_register: "period-shaped-readable",
  real_person_policy: "evidence-and-restraint",
  counterfactual_policy: "prohibit-major",
});
```

Use a valid packet with `historical_risk`, `chronology_refs`, `constraint_refs`, `invention_refs`, `knowledge_boundary`, `historical_pressure`, and `material_world`, then remove one required value to prove validation fails.

**Step 2: Run the tests to verify failure**

Run: `npm test -- tests/profiles.test.ts tests/profile-hardening.test.ts`

Expected: FAIL because the profile ID and registry entry do not exist.

**Step 3: Implement the profile**

- Add `historical-fiction` to `ProfileIdSchema` and export a canonical `PROFILE_IDS` tuple plus `isProfileId(value)`.
- Extend `NovelProfile` only where reusable profile-specific book-plan rules/outputs are needed; existing profiles must provide empty arrays if fields are required.
- Define TypeBox schemas for the six settings and eight requirements from the approved design.
- Define the chapter packet schema with exact risk/reference/knowledge/material fields.
- Implement profile validators with actionable messages and add historical planning questions, milestone lanes, drafting rules, ending rules, and packet requirements.
- Add `profiles/historical-fiction.yaml` with matching defaults and requirements.
- Register the profile in `src/profiles/index.ts`.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/profiles.test.ts tests/profile-hardening.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/schemas.ts src/profiles/types.ts src/profiles/index.ts src/profiles/historical-fiction.ts profiles/historical-fiction.yaml tests/profiles.test.ts tests/profile-hardening.test.ts
git commit -m "feat: add historical fiction profile"
```

### Task 2: Define historical artifact schemas and templates

**Files:**
- Create: `src/domain/historical-fiction.ts`
- Create: `src/domain/v1-5-schema-registry.ts`
- Modify: `src/infrastructure/transaction.ts`
- Modify: `src/project/templates.ts`
- Create: `references/templates/novel/historical-context.yaml`
- Create: `references/templates/novel/invention-ledger.yaml`
- Create: `tests/historical-schemas.test.ts`
- Modify: `tests/schema.test.ts`

**Step 1: Write failing schema tests**

Cover valid default documents and rejection of duplicate/malformed IDs, invalid enum values, missing chronology source/research provenance, missing invention rationale, and settings that do not match the book genre configuration.

```ts
assert.equal(Value.Check(HistoricalContextSchema, historicalContext), true);
assert.equal(Value.Check(InventionLedgerSchema, inventionLedger), true);
assert.equal(schemaForPath("books/book-01/historical-context.yaml"), HistoricalContextSchema);
```

**Step 2: Run the tests to verify failure**

Run: `npm test -- tests/historical-schemas.test.ts tests/schema.test.ts`

Expected: FAIL because schemas, defaults, templates, and registry entries are absent.

**Step 3: Implement schemas and defaults**

- Define typed schemas for:
  - `HIST-NNN` chronology entries with sequence/display/certainty/source or research reference/story effect/uncertainty/invention reference.
  - `HC-NNN` constraints with category/risk/confidence/source or research reference.
  - `KB-NNN` knowledge boundaries.
  - Language conventions and unresolved uncertainties.
  - `INV-NNN` invention entries with classification/risk/provenance/rationale/affected chapters/risks/disclosure/writer decision and deterministic `major_counterfactual`.
- Export default document builders from `src/domain/historical-fiction.ts`.
- Add the two paths to a new v1.5 schema registry and consult it before older registries in transactions.
- Add reference templates that parse against the schemas.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/historical-schemas.test.ts tests/schema.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/historical-fiction.ts src/domain/v1-5-schema-registry.ts src/infrastructure/transaction.ts src/project/templates.ts references/templates/novel/historical-context.yaml references/templates/novel/invention-ledger.yaml tests/historical-schemas.test.ts tests/schema.test.ts
git commit -m "feat: add historical evidence artifacts"
```

### Task 3: Create conditional project files and profile selectors

**Files:**
- Modify: `src/project/templates.ts`
- Modify: `src/pi/extension.ts`
- Modify: `wizard/app.js`
- Modify: `src/migration/genesis-v0.4.ts`
- Modify: `src/application/next-book.ts`
- Modify: `src/application/brief-bootstrap.ts`
- Create: `tests/historical-profile-selection.test.ts`
- Modify: `tests/migration.test.ts`
- Modify: `tests/next-book.test.ts`

**Step 1: Write failing selection/template tests**

Prove that a new historical book creates both guarded historical files, while thriller and romantasy do not. Exercise CLI/profile parsing through the exported canonical guard, migration, next-book creation, brief bootstrap, and the wizard selector.

```ts
const files = bookTemplateFiles("book-01", "historical-fiction");
assert.ok(files.has("books/book-01/historical-context.yaml"));
assert.ok(files.has("books/book-01/invention-ledger.yaml"));
assert.equal(bookTemplateFiles("book-01", "thriller").has(historicalPath), false);
```

**Step 2: Run the tests to verify failure**

Run: `npm test -- tests/historical-profile-selection.test.ts tests/migration.test.ts tests/next-book.test.ts`

Expected: FAIL because selectors and conditional files know only the two existing profiles.

**Step 3: Implement conditional creation and canonical selection**

- Make `bookTemplateFiles` accept/use the profile and add historical defaults only for `historical-fiction`.
- Replace hard-coded profile arrays/checks with `PROFILE_IDS`/`isProfileId` throughout the extension, migration, next-book, and bootstrap paths.
- Add the Historical Fiction option to `wizard/app.js` and a sensible 100,000-word default.
- Keep old calls source-compatible when their profile is already discoverable from the passed book metadata.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/historical-profile-selection.test.ts tests/migration.test.ts tests/next-book.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/project/templates.ts src/pi/extension.ts wizard/app.js src/migration/genesis-v0.4.ts src/application/next-book.ts src/application/brief-bootstrap.ts tests/historical-profile-selection.test.ts tests/migration.test.ts tests/next-book.test.ts
git commit -m "feat: create historical books from every entry point"
```

### Task 4: Validate historical evidence across guarded artifacts

**Files:**
- Create: `src/application/historical-integrity.ts`
- Modify: `src/application/integrity.ts`
- Create: `tests/historical-evidence.test.ts`

**Step 1: Write failing cross-artifact tests**

Test findings for:

- genre/context settings mismatch;
- unknown or duplicate `HIST`, `HC`, `KB`, `INV`, `RES`, and chapter references;
- high-risk entries without ready, non-low-confidence research;
- medium-risk entries without either research or declared invention;
- invalid knowledge boundary references;
- major counterfactuals lacking `historical-invention:INV-NNN` writer decision with `accept:<classification>:<risk>:<disclosure>`;
- valid low-, medium-, and high-risk examples.

**Step 2: Run the test to verify failure**

Run: `npm test -- tests/historical-evidence.test.ts`

Expected: FAIL because the historical integrity join does not exist.

**Step 3: Implement one reusable validator**

Export a pure `historicalIntegrityFindings(input)` returning stable finding IDs, paths, and messages. Parse only typed input; join maps by canonical IDs; make risk rules deterministic. Call it conditionally from project integrity collection when the selected profile is historical fiction. Do not add findings to other profiles.

**Step 4: Rerun the focused test**

Run: `npm test -- tests/historical-evidence.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/application/historical-integrity.ts src/application/integrity.ts tests/historical-evidence.test.ts
git commit -m "feat: validate historical evidence integrity"
```

### Task 5: Guard historical artifacts in event application and hashing

**Files:**
- Modify: `src/application/events.ts`
- Modify: `src/application/project-hash.ts`
- Create: `tests/historical-events.test.ts`
- Modify: `tests/event-application.test.ts`
- Modify: `tests/research-event.test.ts`

**Step 1: Write failing event tests**

Prove that:

- `book-plan` must create valid historical artifacts for historical books;
- `research-update` may update the artifacts and must satisfy risk rules;
- unrelated event types cannot modify them;
- invalid references/settings/counterfactual approval reject the whole transaction;
- artifact changes alter the project hash;
- the same events for thriller/romantasy preserve their existing required file sets.

**Step 2: Run the tests to verify failure**

Run: `npm test -- tests/historical-events.test.ts tests/event-application.test.ts tests/research-event.test.ts`

Expected: FAIL because event allowlists, validation, and hashes exclude the new files.

**Step 3: Integrate the validator into guarded writes**

- Add exact historical paths to only `book-plan` and `research-update` allowlists.
- Require the two files during historical book planning and parse them through the v1.5 registry.
- Invoke `historicalIntegrityFindings` during architecture validation so invalid cross-file states fail atomically.
- Add both files to the project hash; missing paths remain stable for non-historical profiles.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/historical-events.test.ts tests/event-application.test.ts tests/research-event.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/application/events.ts src/application/project-hash.ts tests/historical-events.test.ts tests/event-application.test.ts tests/research-event.test.ts
git commit -m "feat: guard historical evidence updates"
```

### Task 6: Add bounded historical planning and drafting context

**Files:**
- Modify: `src/application/stage-specs/index.ts`
- Modify: `src/application/prompts.ts`
- Modify: `src/context/context-builder.ts`
- Create: `tests/historical-context.test.ts`
- Modify: `tests/prompts.test.ts`

**Step 1: Write failing prompt/context tests**

For a chapter referencing one item from each artifact, assert the prompt has a `Historical scene contract` section containing exactly those records and linked research. Assert unrelated chronology, inventions, constraints, and sources are excluded. Also assert book-plan prompts request both historical artifacts and milestone/draft prompts contain profile rules.

```ts
assert.match(prompt, /Historical scene contract/);
assert.match(prompt, /HIST-001/);
assert.doesNotMatch(prompt, /HIST-999/);
```

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/historical-context.test.ts tests/prompts.test.ts`

Expected: FAIL because historical planning outputs and bounded context are absent.

**Step 3: Implement bounded context and stage rules**

- Add profile-specific book-plan outputs/rules to the book-plan stage input and render them from `bookPlanPrompt`.
- Load and schema-check the two historical artifacts only for historical books.
- Select records through packet references, add their directly linked research, and render a concise `Historical scene contract` including the referenced knowledge boundary and material/pressure fields.
- Emit stable included/excluded dependency markers used by diagnostics.
- Fail context construction on unknown references rather than silently widening scope.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/historical-context.test.ts tests/prompts.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/application/stage-specs/index.ts src/application/prompts.ts src/context/context-builder.ts tests/historical-context.test.ts tests/prompts.test.ts
git commit -m "feat: compile bounded historical scene context"
```

### Task 7: Package a conditional Historical Note

**Files:**
- Modify: `src/application/packaging/export.ts`
- Modify: `src/application/package-checklist.ts`
- Create: `tests/historical-packaging.test.ts`
- Modify: `tests/packaging-v1.2.test.ts`

**Step 1: Write failing packaging tests**

Assert that historical books produce `books/<id>/exports/historical-note.md`, that the note summarizes disclosed compressed/composite/invented/counterfactual entries without fabricating citations, that artifact edits change the packaging source hash, and that other profiles do not get the note. Assert invalid required disclosures block the checklist/apply flow while the existing package approval gate remains required.

**Step 2: Run tests to verify failure**

Run: `npm test -- tests/historical-packaging.test.ts tests/packaging-v1.2.test.ts`

Expected: FAIL because packaging ignores historical artifacts.

**Step 3: Implement conditional export/checklist behavior**

- Include both historical artifact bytes in the export source hash.
- Render `historical-note.md` only for historical books, using ledger disclosure values and documented uncertainty.
- Add a conditional `historical-disclosure` checklist item driven by the reusable validator.
- Preserve the existing pending package approval and deterministic artifact ordering.

**Step 4: Rerun focused tests**

Run: `npm test -- tests/historical-packaging.test.ts tests/packaging-v1.2.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/application/packaging/export.ts src/application/package-checklist.ts tests/historical-packaging.test.ts tests/packaging-v1.2.test.ts
git commit -m "feat: export historical notes"
```

### Task 8: Document and verify the end-to-end historical workflow

**Files:**
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `agents/openai.yaml`
- Modify: `CHANGELOG.md`
- Create: `docs/releases/v1.5.0.md`
- Create: `tests/e2e/v1-5-release-journey.test.ts`

**Step 1: Write the failing end-to-end journey**

Create a temp historical project, complete intake/premise/book-plan with the two artifacts, approve a major invention, apply research, build a chapter prompt, draft/review, and preview/apply packaging. Assert bounded evidence, integrity, and Historical Note output throughout.

**Step 2: Run the journey to verify failure**

Run: `npm test -- tests/e2e/v1-5-release-journey.test.ts`

Expected: FAIL until all public workflow surfaces and fixtures are complete.

**Step 3: Complete public documentation and fixtures**

- Describe Historical Fiction in the README, skill instructions, and agent metadata.
- Document the accuracy contract, risk rules, invention approvals, bounded scene contract, Historical Note, and compatibility in `docs/releases/v1.5.0.md`.
- Add the feature set under `CHANGELOG.md` Unreleased until the version bump task.
- Keep all command examples consistent with actual CLI commands.

**Step 4: Rerun the journey and documentation-oriented tests**

Run: `npm test -- tests/e2e/v1-5-release-journey.test.ts tests/schema.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add README.md SKILL.md agents/openai.yaml CHANGELOG.md docs/releases/v1.5.0.md tests/e2e/v1-5-release-journey.test.ts
git commit -m "docs: document historical fiction workflow"
```

### Task 9: Bump, verify, and publish v1.5.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/application/version-core.ts`
- Modify: `README.md`
- Modify: `RELEASE.md`
- Modify: `CHANGELOG.md`
- Create: `scripts/verify-v1-5-release.ts`
- Create: `tests/v1-5-release-checklist.test.ts`
- Modify: `tests/v1-4-release-checklist.test.ts`
- Modify: `.github/workflows/test.yml` only if the canonical command changes

**Step 1: Write failing release metadata tests**

Copy the v1.4 verifier structure into a v1.5 verifier that checks package/lock/runtime versions, README install pin, release docs, changelog heading, required shipped files, package allowlist, tests, and CI invocation. Update the v1.4 test to prove the old verifier rejects current metadata after the bump.

**Step 2: Run release tests to verify failure**

Run: `npm test -- tests/v1-5-release-checklist.test.ts tests/v1-4-release-checklist.test.ts`

Expected: FAIL because version metadata remains `1.4.2` and no v1.5 verifier exists.

**Step 3: Bump all release metadata**

- Set package, lock, and runtime version to `1.5.0`.
- Point `verify:release`/`test:release` at the v1.5 verifier/tests while retaining the old verifier as historical coverage.
- Update README install URLs to `#v1.5.0`, RELEASE.md, release notes, and move changelog entries under `[1.5.0] - 2026-07-18`.
- Ensure `npm pack --dry-run` includes every new runtime/profile/template file and no transient artifacts.

**Step 4: Run full verification**

Run, in order:

```bash
npm run typecheck
npm test
npm run eval
npm run verify:release
npm pack --dry-run
```

Expected: all commands exit 0; test count includes the new historical and release journeys.

**Step 5: Commit the release**

```bash
git add package.json package-lock.json src/application/version-core.ts README.md RELEASE.md CHANGELOG.md scripts/verify-v1-5-release.ts tests/v1-5-release-checklist.test.ts tests/v1-4-release-checklist.test.ts .github/workflows/test.yml
git commit -m "release: prepare v1.5.0"
```

**Step 6: Push, tag, and verify the remote release reference**

```bash
git push origin main
git tag -a v1.5.0 -m "Novel Forge v1.5.0"
git push origin v1.5.0
git ls-remote --tags origin refs/tags/v1.5.0 refs/tags/v1.5.0^{}
```

Expected: the annotated tag resolves to the release commit. Do not move or reuse `v1.4.2`.

**Step 7: Verify installation from the exact GitHub pin**

Run the repository-supported install validation using:

```text
https://github.com/dustinober1/pi-book.git#v1.5.0
```

Then confirm the installed package reports `1.5.0` and exposes `historical-fiction`.

## Final Acceptance Checklist

- A historical-fiction book can be created from every supported entry point.
- Its settings, context, chronology, constraints, knowledge boundaries, inventions, research, decisions, and chapter packets validate together.
- High-risk claims require ready evidence; major counterfactuals require explicit writer approval.
- Draft prompts receive a bounded Historical scene contract.
- Milestone reviews use historical review lanes.
- Packaging emits a deterministic Historical Note only when appropriate.
- Thriller and romantasy regression suites pass unchanged.
- Typecheck, unit/integration/e2e tests, evals, release verifier, and package dry run pass.
- `main` and annotated tag `v1.5.0` are pushed and the GitHub tag resolves to the verified release commit.
