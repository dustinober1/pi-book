from pathlib import Path

root = Path('.')

# Preserve the established upload-source identifier contract.
path = root / 'src/wizard/session.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('const sourceId = `upload-${randomBytes(12).toString("hex")}`;', 'const sourceId = `source_${randomBytes(12).toString("hex")}`;')
path.write_text(text, encoding='utf-8')

# Return the public candidate wrapper while storing the full private preview entry.
path = root / 'src/application/research/wizard.ts'
text = path.read_text(encoding='utf-8')
old = '''      return save({ kind: "influence", taste, influence });
'''
new = '''      const stored = save({ kind: "influence", taste, influence });
      return { preview_id: stored.preview_id, candidate: influence, findings: [] };
'''
if old not in text:
    raise RuntimeError('influence preview return anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Check actual filesystem imports/APIs instead of matching harmless identifiers such as refs.
path = root / 'tests/research-wizard-assets.test.ts'
text = path.read_text(encoding='utf-8')
old = '''  assert.equal(app.includes("fs."), false);
'''
new = '''  assert.equal(app.includes("node:fs"), false);
  assert.equal(app.includes('require("fs")'), false);
  assert.equal(app.includes("require('fs')"), false);
'''
if old not in text:
    raise RuntimeError('filesystem assertion anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
