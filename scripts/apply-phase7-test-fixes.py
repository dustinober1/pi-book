from pathlib import Path

release = Path('src/evaluation/v1-3-release.ts')
text = release.read_text(encoding='utf-8')
old = 'strategy.reader_friction.accepted_tradeoffs.push({ id: tradeoffId, statement: "Preserve deliberate ambiguity.", mitigation: `Source cluster ${clusterId}; clarify stakes elsewhere.` });'
new = 'strategy.reader_friction.accepted_tradeoffs.push({ id: tradeoffId, statement: "Preserve deliberate ambiguity.", source_cluster_ids: [clusterId], mitigation: `Clarify stakes elsewhere while preserving the intentional friction from ${clusterId}.` });'
if old not in text:
    raise RuntimeError('accepted tradeoff anchor missing')
release.write_text(text.replace(old, new, 1), encoding='utf-8')

fixture = Path('evals/v1-3-release/voice-drift.yaml')
text = fixture.read_text(encoding='utf-8')
text = text.replace('    - sentence_mean\n', '    - average_sentence_words\n')
fixture.write_text(text, encoding='utf-8')

test = Path('tests/e2e/v1-3-release-journey.test.ts')
text = test.read_text(encoding='utf-8')
old = '    assert.ok(report.skippedChecks.some((item) => item.id === "docx-adoption" && /source file/i.test(item.reason)));\n'
new = old + '    await new Promise<void>((resolve) => setTimeout(resolve, 25));\n'
if old not in text:
    raise RuntimeError('journey cleanup anchor missing')
test.write_text(text.replace(old, new, 1), encoding='utf-8')
