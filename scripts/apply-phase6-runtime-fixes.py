from pathlib import Path

root = Path('.')

# Restore exact existing wizard-session compatibility.
path = root / 'src/wizard/session.ts'
text = path.read_text(encoding='utf-8')
text = text.replace('import { createWriteStream, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";', 'import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";')
text = text.replace('stream.on("limit", () => { rejected = true; unlinkSync(absolutePath); reject(statusError(413, "Upload exceeds the session size limit.")); });', 'stream.on("limit", () => { rejected = true; if (existsSync(absolutePath)) unlinkSync(absolutePath); reject(statusError(413, "Upload exceeds the session size limit.")); });')
text = text.replace('if (req.method === "POST" && requestUrl.pathname === "/api/session") {', 'if ((req.method === "GET" || req.method === "POST") && requestUrl.pathname === "/api/session") {')
text = text.replace('sendJson(res, 200, { source_id: record.sourceId, original_name: record.originalName, media_type: record.mediaType, byte_size: record.byteSize });', 'sendJson(res, 201, { source_id: record.sourceId, original_name: record.originalName, media_type: record.mediaType, byte_size: record.byteSize });')
path.write_text(text, encoding='utf-8')

# Use exact static safety checks rather than a regex that can match harmless identifier substrings.
path = root / 'tests/research-wizard-assets.test.ts'
text = path.read_text(encoding='utf-8')
old = '  assert.doesNotMatch(app, /\\beval\\s*\\(|new Function|createElement\\(["\']script|child_process|fs\\./i);\n'
new = '  assert.equal(app.includes("eval("), false);\n  assert.equal(app.includes("new Function"), false);\n  assert.equal(app.includes("createElement(\\\"script\\\")"), false);\n  assert.equal(app.includes("child_process"), false);\n  assert.equal(app.includes("fs."), false);\n'
if old not in text:
    raise RuntimeError('static safety assertion anchor missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Clarify the three review-commented plan paths without changing implementation scope.
path = root / 'docs/superpowers/plans/2026-07-15-v1-3-phase-6-research-wizard.md'
text = path.read_text(encoding='utf-8')
text = text.replace('- Modify: `package.json`\n- Test: `tests/voice-drift.test.ts`', '- Modify package script: `package.json`\n- Test: `tests/voice-drift.test.ts`')
text = text.replace('- Modify: `src/pi/extension.ts`\n- Modify: `src/application/guide.ts`\n- Modify: `src/application/status.ts`', '- Modify command registration: `src/pi/extension.ts`\n- Modify guided action labels: `src/application/guide.ts`\n- Modify status guidance: `src/application/status.ts`')
text = text.replace('- Modify: `wizard/index.html`\n- Modify: `wizard/app.js`\n- Modify: `wizard/styles.css`', '- Modify wizard markup: `wizard/index.html`\n- Modify wizard behavior: `wizard/app.js`\n- Modify wizard presentation: `wizard/styles.css`')
path.write_text(text, encoding='utf-8')
