// Real Next + Auth + PostgreSQL on the disposable onboarding stack (run-onboarding-e2e.cjs --shell).
// The overview read's `view` argument only narrows a read the server already authorizes from the session.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { shellAccount } = require('./helpers/workspace-shell-e2e.cjs')
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test('overview views: own club allowed, other club, signed-out and unknown views denied', { skip: !configFile, timeout: 120000 }, async () => {
  const account = await shellAccount(configFile, { elevate: false })
  try {
    const read = (clubId, view, cookie = account.actor.cookieHeader()) => fetch(account.config.appUrl + '/api/workspace?' + new URLSearchParams({ kind: 'overview', args: JSON.stringify(view ? [clubId, view] : [clubId]) }), { headers: { cookie } })
    for (const view of [undefined, 'all', 'club', 'recruiting', 'strip']) assert.equal((await read(account.clubId, view)).status, 200, `own club ${view ?? 'default'}`)
    // The admin is not a member of the second fixture club: every view is denied, never narrowed into a leak.
    const other = account.fixture.clubIds[1]
    await account.db.clubMember.deleteMany({ where: { clubId: other, userId: account.config.admin.id } })
    for (const view of ['club', 'recruiting', 'strip']) assert.ok([401, 403].includes((await read(other, view)).status), `other club ${view}`)
    for (const view of ['club', 'strip']) assert.ok([401, 403].includes((await read(account.clubId, view, '')).status), `signed out ${view}`)
    assert.equal((await read(account.clubId, 'everything')).status, 400, 'unknown view rejected')
  } finally { await account.db.$disconnect() }
})
