from pathlib import Path

root = Path('.')

schemas = root / 'src/domain/schemas.ts'
text = schemas.read_text(encoding='utf-8')
import_anchor = 'import { Value } from "@sinclair/typebox/value";\n'
import_line = 'import { AutomationRunStateSchema } from "./v1-4-schemas.js";\n'
if import_line not in text:
    if import_anchor not in text:
        raise RuntimeError('schemas import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)
old = '''  automation: Type.Object({
    max_chapters_per_run: Type.Integer({ minimum: 1, maximum: 10 }),
    require_first_chapter_approval: Type.Boolean(),
    git_checkpoints: Type.Boolean(),
  }),
'''
new = '''  automation: Type.Object({
    max_chapters_per_run: Type.Integer({ minimum: 1, maximum: 10 }),
    require_first_chapter_approval: Type.Boolean(),
    git_checkpoints: Type.Boolean(),
    active_run: Type.Optional(Type.Union([AutomationRunStateSchema, Type.Null()])),
  }),
'''
if old not in text:
    raise RuntimeError('ProjectSchema automation anchor missing')
schemas.write_text(text.replace(old, new, 1), encoding='utf-8')

templates = root / 'src/project/templates.ts'
text = templates.read_text(encoding='utf-8')
old = '    automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: true },\n'
new = '    automation: { max_chapters_per_run: 3, require_first_chapter_approval: true, git_checkpoints: true, active_run: null },\n'
if old not in text:
    raise RuntimeError('project template automation anchor missing')
templates.write_text(text.replace(old, new, 1), encoding='utf-8')
