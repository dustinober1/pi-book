# Novel Forge Release Checklist

## Version 1.1.0

Do not create the `v1.1.0` tag until the feature pull request is merged and the merge commit passes the complete verification matrix.

### Code and compatibility

- [ ] `package.json` reports `1.1.0`.
- [ ] `package-lock.json` reports `1.1.0` in the root package metadata.
- [ ] New projects write `novel_forge_version: 1.1.0`.
- [ ] Projects without the field remain readable and receive an upgrade warning.
- [ ] Projects created by a newer package version are blocked safely.
- [ ] All existing specialist commands remain registered.
- [ ] `/novel` and `/novel-adopt` are registered by the packed extension.

### Verification

- [ ] `npm ci` passes.
- [ ] `npm run typecheck` passes on Node 22.19.0 and Node 24.
- [ ] `npm test` passes on Node 22.19.0 and Node 24.
- [ ] `npm run eval` passes.
- [ ] The packed-extension Pi API smoke test passes.
- [ ] `npm pack --dry-run` includes README, SKILL, CHANGELOG, RELEASE, source, agents, profiles, references, and scripts.
- [ ] The final PR diff contains no temporary workflow, generated diagnostic, or local environment files.

### Product acceptance

- [ ] A new user can start with `/novel-start` and continue with `/novel` without memorizing a gate identifier.
- [ ] Pending gates expose approve, request changes, and evidence actions.
- [ ] Rejected gates expose an exact repair action.
- [ ] Every guarded workflow event refreshes `STATUS.md` and `HANDOFF.md` inside the same rollback-capable transaction and Git checkpoint.
- [ ] Undo rejects dirty trees, non-Novel-Forge commits, and unconfirmed approval reversal.
- [ ] Adoption preserves source files and refuses an occupied manuscript directory.
- [ ] Reader imports reject simulated sources, duplicates, malformed booleans, and unmatched delayed rows.
- [ ] Packaging cannot proceed through the guided path until blocking checklist items are complete.

### Publish

1. Merge the verified pull request to `main`.
2. Confirm the merge commit's `Novel Forge tests` workflow is green on both Node versions.
3. Create annotated tag `v1.1.0` on that merge commit.
4. Confirm installation with:

   ```bash
   pi install git:github.com/dustinober1/pi-book@v1.1.0
   ```

5. Run one clean-project `/novel-start` and `/novel` smoke test from the tagged package.
