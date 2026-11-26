// A recused reviewer's refusal reaches them as a result with its message. Found in production (Sentry OUT-CLASS-M):
// RecusedError extended Error, so a converted action rethrew it and the reviewer saw a generic failure.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness } = require('./helpers/demo-harness.cjs')

test('RecusedError is an ActionError that actionResult returns as a refusal', async () => {
  const h = harness()
  const { RecusedError, RECUSED_MESSAGE } = h.load('lib/recusal.ts'), { ActionError, actionResult } = h.load('lib/action-result.ts')
  const error = new RecusedError()
  assert.ok(error instanceof ActionError); assert.equal(error.code, 'RECUSED'); assert.equal(error.name, 'RecusedError')
  const result = await actionResult(async () => { throw new RecusedError() })
  assert.equal(result.ok, false); assert.equal(result.error, RECUSED_MESSAGE); assert.equal(result.code, 'RECUSED')
})
