from pathlib import Path

root = Path('.')

prompts = root / 'src/application/prompts.ts'
text = prompts.read_text(encoding='utf-8')
text = text.replace(
    'New required_research entries use only ready RES-NNN research-ledger IDs. Carry approved book guardrails into drafting context; never copy raw public-review observations into a packet. Do not rebuild the entire book queue.',
    'New required_research entries use only ready RES-NNN research-ledger IDs. Existing SRC-NNN references remain readable as legacy advisories and should be migrated during the next plan rebuild. Carry approved book guardrails into drafting context; never copy raw public-review observations into a packet. Generate only the requested refill packets.',
)
prompts.write_text(text, encoding='utf-8')

path = root / 'tests/event-application.test.ts'
text = path.read_text(encoding='utf-8')
text = text.replace(
    'assert.match(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), /drafted/);',
    'assert.doesNotMatch(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), /drafted/);\n    assert.match(readFileSync(join(root, "books", "book-01", "chapter-queue.yaml"), "utf8"), /packets: \\[\\]/);',
)
path.write_text(text, encoding='utf-8')
