// A panel schedule notification lists one session per line. The Inbox list preview showed them run together
// ("…10:30 AM (Eastern Time) Thu, Nov 26, 2026 · QA Room 1 …") because HTML collapses the line breaks. The preview now
// separates lines, and a long preview ends with an ellipsis instead of stopping mid-word.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load() {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'lib/communications-client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'window', code)(n => n === '@/lib/scheduling-config' ? { SCHEDULING_TIMEZONE: 'America/New_York', schedulingDateTime: String } : require(n), mod, mod.exports, {})
  return mod.exports
}
const base = { id: 'n1', type: 'INTERVIEW', title: 'Interview panel schedule · First interview', createdAt: '2026-11-25T17:32:00Z', readAt: null, href: '/settings/interviews?clubId=c&roundId=r', eventKey: 'panel-schedule:v1:u1', clubId: 'c', club: { name: 'QA' } }

test('separate lines read apart in the list preview', () => {
  const { inboxNotification } = load()
  const body = 'Thu, Nov 26, 2026 · QA Room 1 · 10:00 AM–10:30 AM (Eastern Time)\nThu, Nov 26, 2026 · QA Room 1 · 10:30 AM–11:00 AM (Eastern Time)'
  const item = inboxNotification({ ...base, body })
  assert.equal(item.preview, 'Thu, Nov 26, 2026 · QA Room 1 · 10:00 AM–10:30 AM (Eastern Time) · Thu, Nov 26, 2026 · QA Room 1 · 10:30 AM–11:00 AM (Eastern Time)')
  assert.deepEqual(item.body, [body], 'the full view keeps the original lines')
})

test('sentences join with a space and long previews end with an ellipsis', () => {
  const { notificationPreview } = load()
  assert.equal(notificationPreview('First line.\nSecond line'), 'First line. Second line')
  const long = notificationPreview('x'.repeat(200))
  assert.equal(long.length, 160)
  assert.ok(long.endsWith('…'))
  assert.equal(notificationPreview('Short'), 'Short')
})
