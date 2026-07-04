# Genesis for Pi Troubleshooting

## Drift-loop hard stop

- Open `artifacts/drift-loop-alarm.md`.
- Confirm the repeated structure or no-state-change evidence.
- Repair the underlying chapter, outline, or ticket pattern before drafting more.

## Phase mismatch

- Run `/genesis-validate`.
- Compare `PROJECT_STATE.yaml` with the actual files.
- Either create the missing outputs or correct the recorded phase.

## Placeholder-heavy artifacts

- Run `/genesis-lint`.
- Replace `unknown`, TODO scaffolds, empty headings, and starter text with real decisions.

## Missing install or package-health files

- Run `/genesis-doctor`.
- Reinstall the package if package files are missing.

## Older project tree

- Run `/genesis-migrate`.
- Recheck with `/genesis-status` and `/genesis-validate`.

## Writer says “this is not how I sound”

- Update `artifacts/author-voice-fingerprint.md` and `artifacts/voice-bible.md` first.
- Only continue drafting after the voice contract matches the writer again.
