from pathlib import Path

root = Path('.')


def append_once(path: str, heading: str, body: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if heading in text:
        return
    file.write_text(text.rstrip() + '\n\n' + heading + '\n\n' + body.rstrip() + '\n', encoding='utf-8')


def insert_after(path: str, anchor: str, addition: str) -> None:
    file = root / path
    text = file.read_text(encoding='utf-8')
    if addition.strip() in text:
        return
    if anchor not in text:
        raise RuntimeError(f'Anchor missing in {path}: {anchor!r}')
    file.write_text(text.replace(anchor, anchor + addition, 1), encoding='utf-8')

insert_after(
    'CHANGELOG.md',
    '### Added\n',
    '\n- Nine deterministic 1.3 release evaluation fixtures, an honest clean-project journey, packed-extension clean-start coverage, and a machine-checkable release tree.\n- One-time merged-main release automation that verifies the exact commit before creating annotated tag `v1.3.0` and its GitHub release.\n',
)

append_once(
    'README.md',
    '## Install the verified 1.3 release',
    '''```text
pi install git:github.com/dustinober1/pi-book@v1.3.0
```

Novel Forge 1.3 ships with deterministic release fixtures, a clean-project evidence journey, packed-extension install/import tests, and a read-only release-tree verifier. Run:

```text
npm run eval
npm run verify:release
npm run test:release
```

These checks verify contracts and safety boundaries. They do not establish objective literary quality; human editorial review and real human reader judgment remain required.''',
)

append_once(
    'SKILL.md',
    '## Release qualification',
    'Before publishing Novel Forge 1.3, run the complete Node 22.19.0 and Node 24 matrix, all nine deterministic release fixtures, the honest clean-project journey, packed-extension clean start, and `npm run verify:release`. Release checks verify contracts, compatibility, and package boundaries only. Never describe them as proof of literary excellence or substitute them for human editorial and reader judgment.',
)

release = root / 'RELEASE.md'
text = release.read_text(encoding='utf-8')
duplicate = '- [ ] Existing adoption, readers, packaging, and next-book wizard workflows remain passing.\n'
while text.count(duplicate) > 1:
    first = text.find(duplicate)
    second = text.find(duplicate, first + len(duplicate))
    text = text[:second] + text[second + len(duplicate):]
section = '''
### Phase 7 release qualification

- [ ] Nine deterministic 1.3 release fixtures pass without claiming objective literary quality.
- [ ] The clean-project journey records honest skips for writer prose, real human evidence, supplied adoption files, approved packaging, and locked-canon next-book creation.
- [ ] `npm run verify:release` passes and reports all tree/package/release-note findings.
- [ ] The one-time `release-v1.3` workflow verifies the merged main commit before creating the annotated tag and GitHub release.

'''
if '### Phase 7 release qualification' not in text:
    anchor = '### Publish\n'
    if anchor not in text:
        raise RuntimeError('Publish anchor missing in RELEASE.md')
    text = text.replace(anchor, section + anchor, 1)
release.write_text(text, encoding='utf-8')

append_once(
    'evals/README.md',
    '## Novel Forge 1.3 release evaluations',
    '`evals/v1-3-release/` contains nine deterministic contract fixtures for influence translation, writer-sample precedence, one-star noise handling, praise/complaint pairing, intentional tradeoffs, voice drift, scene diversity, agency consequences, and revision-learning promotion. `npm run eval` executes these after the architecture fixtures.\n\nThese fixtures verify policy and data-flow behavior only. They do not score literary excellence, simulate human readers, or replace blinded editorial review and delayed real-reader recall.',
)
