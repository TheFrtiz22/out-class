// In-app reporting (App Store 1.2): the native app reports a club, event, flyer or announcement through the
// "content.report" mobile operation, which runs the web's own reportContent action unchanged
// (actions/content-reports.ts) and turns its returned refusals into a 422 the app shows as written.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { z } = require('zod')

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', compile(file))(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}

const actionResult = load('lib/action-result.ts')
const operations = fs.readFileSync('lib/mobile-api/operations.ts', 'utf8')

/** The operations table with the real content-reports action behind it, against an in-memory club. */
function table({ staff = false, recent = 0 } = {}) {
  const created = []
  const tx = {
    $queryRaw: async () => [],
    platformReport: { findFirst: async () => null, count: async () => recent, create: async ({ data }) => { created.push(data); return { id: 'report-1' } } },
    auditLog: { create: async () => {} },
  }
  const prisma = {
    $transaction: async fn => fn(tx),
    club: { findFirst: async ({ where }) => where.id === 'club-1' ? { id: 'club-1', marketing: {} } : null },
    clubMember: { findUnique: async () => staff ? { status: 'ACTIVE', isOwner: true, permissions: [], interviewOffices: [] } : null },
  }
  const action = load('actions/content-reports.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'reporter' }, impersonation: null }) } })
  const mobileApi = { ActionError: actionResult.ActionError, operation: (method, input, run, options = {}) => ({ method, input, run, ...options }) }
  const { mobileOperations } = load('lib/mobile-api/operations.ts', {
    '@/utils/mobile-api': mobileApi,
    '@/lib/mobile-api/auth': { mobileConfirmInput: z.unknown(), mobileRegisterInput: z.unknown() },
    '@/actions/content-reports': action,
  })
  return { op: mobileOperations['content.report'], created }
}
const call = (op, input) => op.run(op.input.parse(input))

test('content.report is a signed-in POST that calls the web action, never public', () => {
  const { op } = table()
  assert.equal(op.method, 'POST')
  assert.notEqual(op.public, true)
  assert.match(operations, /"content\.report": operation\("POST", passthrough, async input => \{\n\s+const result = await \(await import\("@\/actions\/content-reports"\)\)\.reportContent\(input\);/)
  // Still only the three sign-up steps are public (tests/mobile-signup.test.cjs keeps the same rule).
  const publicOps = [...operations.matchAll(/^\s*"([\w.]+)": operation\(.*\{ public: true \}\),?$/gm)].map(match => match[1])
  assert.ok(!publicOps.includes('content.report'))
})

test('a report the app sends is stored once and answers with the web confirmation', async () => {
  const { op, created } = table()
  assert.deepEqual(await call(op, { target: { type: 'club', id: 'club-1' }, reason: 'HARASSMENT' }), { message: 'Thanks. Our team will review this.' })
  assert.equal(created.length, 1)
  assert.equal(created[0].kind, 'CLUB'); assert.equal(created[0].targetId, 'club-1'); assert.equal(created[0].reporterId, 'reporter')
  assert.match(created[0].summary, /^Harassment or bullying · Club profile/)
})

test('refusals reach the app as ActionErrors with the action\'s own wording (a 422 from utils/mobile-api.ts)', async () => {
  const cases = [
    [table({ staff: true }), { target: { type: 'club', id: 'club-1' }, reason: 'SPAM' }, /can’t report your own content/],
    [table(), { target: { type: 'club', id: 'missing' }, reason: 'SPAM' }, /can’t be reported right now/],
    [table(), { target: { type: 'club', id: 'club-1' }, reason: 'NOT_A_REASON' }, /can’t be reported right now/],
    [table({ recent: 10 }), { target: { type: 'club', id: 'club-1' }, reason: 'SPAM' }, /several reports recently/],
  ]
  for (const [{ op, created }, input, message] of cases) {
    await assert.rejects(call(op, input), error => actionResult.isActionError(error) && error.code === 'REPORT_REFUSED' && message.test(error.message))
    assert.equal(created.length, 0)
  }
  // The boundary maps an ActionError code it doesn't list to 422 with the message unchanged.
  const boundary = fs.readFileSync('utils/mobile-api.ts', 'utf8')
  assert.match(boundary, /const refusalStatus = \(code: string\) => statusByCode\[code\] \?\? 422;/)
  assert.match(boundary, /if \(isActionError\(error\)\) return refusal\(refusalStatus\(error\.code\), error\.code, error\.message\);/)
  assert.doesNotMatch(boundary, /REPORT_REFUSED/)
})

test('the app offers exactly the reasons and target types the web action accepts', () => {
  const content = load('lib/content-reports.ts')
  const app = fs.readFileSync('mobile/src/components/report.tsx', 'utf8')
  const appReasons = [...app.matchAll(/\{ value: "([A-Z]+)", label: "([^"]+)" \}/g)].map(match => [match[1], match[2]])
  assert.deepEqual(appReasons, content.REPORT_REASONS.map(reason => [reason, content.reportReasonLabels[reason]]))
  for (const type of [...app.matchAll(/type: "([a-z-]+)"/g)].map(match => match[1])) {
    assert.ok(content.reportTargetSchema.options.some(option => option.shape.type.value === type), `server accepts ${type}`)
  }
})
