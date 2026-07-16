from pathlib import Path
path = Path('src/application/events.ts')
text = path.read_text(encoding='utf-8')
old = '''    if (blockers.length) throw new Error(`Premise validation blocked the event:
${blockers.map((item) => `- ${item.message}`).join("
")}`);
'''
# The broken source contains literal newlines inside join quotes; replace by locating the surrounding block.
start = text.index('    if (blockers.length) throw new Error(`Premise validation blocked the event:')
end = text.index('  }\n  if (input.eventType === "intake-update")', start)
replacement = '''    if (blockers.length) throw new Error(`Premise validation blocked the event:\\n${blockers.map((item) => `- ${item.message}`).join("\\n")}`);\n'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
