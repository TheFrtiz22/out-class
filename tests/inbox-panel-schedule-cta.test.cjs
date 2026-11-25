// Inbox: an interviewer's "Interview panel schedule" notice opens their own interview schedule, but its button said
// "View application", as if it were about an application of theirs.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync('lib/communications-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function('require', 'module', 'exports', code)(n => n === '@/lib/scheduling-config' ? { SCHEDULING_TIMEZONE: 'America/New_York', schedulingDateTime: String } : require(n), mod, mod.exports)
const item = over => ({ id: 'n1', type: 'INTERVIEW', title: 'Interview panel schedule · First interview', body: 'Thu', createdAt: '2026-11-25T17:32:00Z', readAt: null, href: '/settings/interviews?clubId=c&roundId=r', eventKey: 'panel-schedule:v1:u1', clubId: 'c', club: { name: 'QA' }, ...over })

test("a panel schedule notice offers the interviewer's schedule, not an application", () => {
  assert.equal(mod.exports.inboxNotification(item()).cta, 'View my schedule')
})

test('an applicant interview notice still reads View application', () => {
  assert.equal(mod.exports.inboxNotification(item({ title: 'Interview update', href: '/applications/a1', eventKey: 'interview:a1' })).cta, 'View application')
})
