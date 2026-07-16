from pathlib import Path

path = Path('docs/superpowers/plans/2026-07-16-v1-3-phase-7-release.md')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'Keep the current four architecture fixtures unchanged. After the architecture summary, load `evals/v1-3-release/*.yaml`, evaluate all nine fixtures, print one PASS/FAIL line per fixture, and set a nonzero exit code for any failure.',
    'Keep the current four architecture fixtures unchanged. Explicitly exclude `v1-3-release` from the architecture-directory scan, then load `evals/v1-3-release/*.yaml` separately, evaluate all nine fixtures, print one PASS/FAIL line per fixture, and set a nonzero exit code for any failure.',
)
text = text.replace(
    '- README, SKILL, CHANGELOG, and RELEASE;',
    '- `README.md`, `SKILL.md`, `CHANGELOG.md`, and `RELEASE.md`;',
)
path.write_text(text, encoding='utf-8')
