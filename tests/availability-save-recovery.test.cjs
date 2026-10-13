const { test } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
const { saveAvailabilityWithRecovery } = loader({})('lib/availability-save-recovery.ts')
const payload = { accountId: 'own-account', revision: 4, schedule: { timezone: 'UTC', weekly: Array.from({ length: 7 }, () => []), weeklySubmitted: true, exceptions: {} } }
test('a lost acknowledgement recovers exactly the next account-bound write without resending', async () => {
  let writes = 0; const saved = { ...payload, revision: 5 }
  assert.deepEqual(await saveAvailabilityWithRecovery(payload, async () => { writes++; throw Error('lost response') }, async () => ({ document: saved, responseMatches: true })), saved); assert.equal(writes, 1)
})
test('offline, newer concurrent edits, another account, and mismatched round confirmation retain the original failure', async () => {
  for (const current of [null, { document: { ...payload, revision: 6 }, responseMatches: true }, { document: { ...payload, accountId: 'another', revision: 5 }, responseMatches: true }, { document: { ...payload, revision: 5 }, responseMatches: false }, { document: { ...payload, revision: 5, schedule: { ...payload.schedule, timezone: 'America/New_York' } }, responseMatches: true }]) {
    const original = Error('edits retained'); await assert.rejects(saveAvailabilityWithRecovery(payload, async () => { throw original }, async () => { if (!current) throw Error('offline'); return current }), error => error === original)
  }
})
