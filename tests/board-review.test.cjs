const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('lib/board-review.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('module', 'exports', code)(mod, mod.exports)
const { boardDecisionProgress } = mod.exports

test('board progress counts real final statuses without counting drafts or treating waitlist as rejection', () => {
 const items = ['DRAFTING', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'INTERVIEWING', 'IN_REVIEW'].map(status => ({ status }))
 assert.deepEqual(boardDecisionProgress(items), { total: 5, accepted: 1, rejected: 1, remaining: 3 })
})
test('empty and fully decided pools have honest remaining counts', () => {
 assert.deepEqual(boardDecisionProgress([]), { total: 0, accepted: 0, rejected: 0, remaining: 0 })
 assert.deepEqual(boardDecisionProgress([{ status: 'ACCEPTED' }, { status: 'REJECTED' }]), { total: 2, accepted: 1, rejected: 1, remaining: 0 })
})
