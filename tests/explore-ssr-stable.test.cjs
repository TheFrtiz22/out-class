// FE-4: /explore server-renders seeded club cards, so the HTML must not depend on the server's or
// browser's time zone or locale (a difference would be a hydration mismatch, React #418).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')

const render = env => JSON.parse(execFileSync(process.execPath, ['tests/helpers/render-explore.cjs'], { env: { ...process.env, ...env }, encoding: 'utf8' }))
const text = html => html.replace(/<!-- -->/g, '')

test('seeded Explore HTML is identical across time zones and locales', () => {
  const base = render({ TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' })
  assert.equal(base.tz, 'UTC')
  const html = text(base.html)
  assert.match(html, /<time dateTime="2026-12-01T04:30:00.000Z">Deadline · Nov 30, 2026, 11:30 PM · Eastern Time<\/time>/, 'Eastern date even when UTC is already Dec 1')
  assert.match(html, /Closed · Nov 1, 2026, 7:00 AM · Eastern Time/, 'deadline state uses serverNow')
  assert.ok(html.indexOf('Ångström Physics') < html.indexOf('Zeta Consulting'), 'name order is pinned, not the runtime collation')
  for (const env of [
    { TZ: 'America/Los_Angeles', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    { TZ: 'Asia/Tokyo', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' },
    // Swedish collation sorts Å after Z; an unpinned localeCompare reorders the cards.
    { TZ: 'Europe/Stockholm', LANG: 'sv_SE.UTF-8', LC_ALL: 'sv_SE.UTF-8' },
  ]) {
    const other = render(env)
    assert.equal(other.tz, env.TZ)
    assert.equal(other.html, base.html, `${env.TZ} / ${env.LANG}`)
  }
})
