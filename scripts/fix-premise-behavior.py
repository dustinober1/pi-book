from pathlib import Path

root = Path('.')

path = root / 'src/application/prompts.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('Present the comparison for an explicit writer decision.\\n\\nUse the state-neutral', 'Present the comparison for an explicit writer decision; the writer must select the final variant.\\n\\nUse the state-neutral')
old = '${intakeContext ? intakeContext + "\\n\\n" : ""}${interviewRule}'
new = '${intakeContext ? intakeContext + "\\n\\n" : ""}${premiseContext ? premiseContext + "\\n\\n" : ""}${interviewRule}'
# Replace only inside bookPlanPrompt, after premiseContext declaration.
start = text.index('export function bookPlanPrompt')
pos = text.index(old, start)
text = text[:pos] + new + text[pos + len(old):]
path.write_text(text, encoding='utf-8')

path = root / 'wizard/app.js'
text = path.read_text(encoding='utf-8')
text = text.replace('Compare structural engines without scores or an automatic winner. The writer makes the final decision.', 'Compare structural engines through neutral observations without scoring or ranking. The writer makes the final decision.')
path.write_text(text, encoding='utf-8')
