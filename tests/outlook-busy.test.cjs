const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const cache = {}
function load(file) {
  file = path.resolve(file); if (cache[file]) return cache[file].exports
  const m = { exports: {} }; cache[file] = m
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports)
  return m.exports
}
const busy = load('lib/outlook-busy.ts'), outlook = load('lib/outlook-calendar.ts')
const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const at = text => +new Date(text)
const ZONE = 'America/New_York'

test('week and nonce inputs are strict', () => {
  assert.equal(busy.validWeek('2026-11-09'), true)
  for (const bad of ['2026-11-10', '2026-02-30', '2026-11-9', '', null, '2026-11-09T00:00']) assert.equal(busy.validWeek(bad), false, String(bad))
  assert.equal(busy.validNonce('abcdefghijklmnopqrstuv'), true)
  for (const bad of ['short', 'has spaces in it here', 'x'.repeat(65), 42]) assert.equal(busy.validNonce(bad), false)
})

test('busy intervals mark only overlapping quarter hours inside 8 AM–9 PM Eastern, across DST', () => {
  // Monday 2026-11-02 is after the Nov 1 fall-back: 9:00 AM EST = 14:00Z.
  const cells = busy.busyCellsForWeek('2026-11-02', ZONE, [[at('2026-11-02T14:00Z'), at('2026-11-02T14:30Z')], [at('2026-11-03T04:00Z'), at('2026-11-03T05:00Z')]])
  const marked = cells.flatMap((day, d) => day.flatMap((on, slot) => on ? [`${d}:${slot}`] : []))
  assert.deepEqual(marked, ['0:36', '0:37'], '9:00–9:30 AM Monday only; 11 PM–midnight is outside the editor window')
  // Before the change, 9:00 AM EDT = 13:00Z.
  const summer = busy.busyCellsForWeek('2026-10-26', ZONE, [[at('2026-10-26T13:00Z'), at('2026-10-26T13:01Z')]])
  assert.equal(summer[0][36], true); assert.equal(summer[0][37], false, 'a partial overlap marks only the quarter hours it touches')
  const allDay = busy.busyCellsForWeek('2026-11-02', ZONE, [[at('2026-11-04T05:00Z'), at('2026-11-05T05:00Z')]])
  assert.equal(allDay[2].filter(Boolean).length, 52, 'an all-day event covers every editable slot on Wednesday only')
  assert.equal(allDay.filter((day, i) => i !== 2).flat().some(Boolean), false)
})

test('applying busy times only removes availability and reports the days it changed', () => {
  const days = Array.from({ length: 7 }, () => Array(96).fill(false))
  days[0][36] = true; days[0][40] = true; days[0][2] = true
  const marks = Array.from({ length: 7 }, () => Array(96).fill(false))
  marks[0][36] = true; marks[1][50] = true; marks[0][2] = true
  const result = busy.removeBusy(days, marks)
  assert.equal(result.next[0][36], false); assert.equal(result.next[0][40], true)
  assert.equal(result.next[1][50], false, 'busy time never becomes availability')
  assert.deepEqual(result.changedDays, [0]); assert.equal(result.removed, 2)
  assert.equal(days[0][36], true, 'input is not mutated')
})

test('popup messages are bounded and validated', () => {
  assert.deepEqual(busy.parseBusy([[1, 2]]), [[1, 2]])
  for (const bad of [null, {}, [[2, 1]], [[1]], [['1', 2]], [[0, 32 * 86400000]], Array(501).fill([1, 2])]) assert.equal(busy.parseBusy(bad), null)
})

test('Graph events: busy, tentative and away block; free, working elsewhere and cancelled do not', () => {
  const event = (showAs, extra = {}) => ({ showAs, start: { dateTime: '2026-11-02T14:00:00.0000000' }, end: { dateTime: '2026-11-02T15:00:00.0000000' }, ...extra })
  const result = outlook.busyFromEvents([event('busy'), event('tentative'), event('oof'), event('free'), event('workingElsewhere'), event('busy', { isCancelled: true }), event('busy', { end: { dateTime: 'nope' } }), null])
  assert.equal(result.length, 3)
  assert.deepEqual(result[0], [at('2026-11-02T14:00Z'), at('2026-11-02T15:00Z')], 'zone-less Graph times are UTC')
})

test('only a configured, explicitly enabled deployment offers the lookup', () => {
  const full = { NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED: 'true', MICROSOFT_CALENDAR_CLIENT_ID: 'id', MICROSOFT_CALENDAR_CLIENT_SECRET: 's' }
  assert.deepEqual(outlook.outlookConfig(full), { clientId: 'id', clientSecret: 's', tenant: 'organizations' })
  assert.equal(outlook.outlookConfig({ ...full, NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED: 'false' }), null)
  assert.equal(outlook.outlookConfig({ ...full, MICROSOFT_CALENDAR_CLIENT_SECRET: '' }), null)
  assert.equal(outlook.outlookConfig({ ...full, MICROSOFT_CALENDAR_TENANT: 'evil/../x' }), null)
})

test('authorization asks for read-only calendar access with PKCE and no refresh token', () => {
  const { state, verifier, challenge } = outlook.pkce()
  assert.ok(state.length >= 32 && verifier.length >= 43)
  assert.equal(challenge, require('node:crypto').createHash('sha256').update(verifier).digest('base64url'))
  const url = new URL(outlook.authorizeUrl({ clientId: 'id', tenant: 'organizations' }, { redirectUri: 'https://www.out-class.net/api/calendar/outlook/callback', state, challenge, loginHint: 'a@virginia.edu' }))
  assert.equal(url.origin + url.pathname, 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize')
  assert.equal(url.searchParams.get('scope'), 'https://graph.microsoft.com/Calendars.ReadBasic')
  assert.doesNotMatch(url.search, /offline_access|Calendars\.Read(?!Basic)|Write/)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
})

test('pending lookups expire and reject malformed cookies', () => {
  const value = { state: 's', verifier: 'v', week: '2026-11-02', nonce: 'n'.repeat(16), userId: 'u', expires: 2000 }
  assert.deepEqual(outlook.parsePending(JSON.stringify(value), 1000), value)
  assert.equal(outlook.parsePending(JSON.stringify(value), 3000), null)
  for (const bad of [undefined, '', 'not json', '[]', JSON.stringify({ ...value, state: 1 }), 'x'.repeat(2001)]) assert.equal(outlook.parsePending(bad, 1000), null)
})

test('lookup exchanges the code once, reads one window, follows Graph pages only, and returns no token', async () => {
  const calls = []
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init })
    if (url.includes('/token')) return { ok: true, json: async () => ({ access_token: 'secret-access-token', refresh_token: 'never' }) }
    if (calls.length === 2) return { ok: true, json: async () => ({ value: [{ showAs: 'busy', start: { dateTime: '2026-11-02T14:00:00' }, end: { dateTime: '2026-11-02T15:00:00' } }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skip=200' }) }
    return { ok: true, json: async () => ({ value: [] }) }
  }
  const config = { clientId: 'id', clientSecret: 'cs', tenant: 'organizations' }
  const result = await outlook.lookupBusy({ config, code: 'c', verifier: 'v', redirectUri: 'https://x/cb', week: '2026-11-02', fetcher })
  assert.deepEqual(result, [[at('2026-11-02T14:00Z'), at('2026-11-02T15:00Z')]])
  assert.equal(calls.length, 3)
  assert.equal(calls[0].init.body.get('code_verifier'), 'v')
  const first = new URL(calls[1].url)
  assert.equal(first.searchParams.get('startDateTime'), '2026-11-01T00:00:00.000Z')
  assert.equal(first.searchParams.get('endDateTime'), '2026-11-10T00:00:00.000Z')
  assert.equal(first.searchParams.get('$select'), 'start,end,showAs,isCancelled', 'no subjects, bodies, locations or attendees are requested')
  assert.equal(calls[1].init.headers.Authorization, 'Bearer secret-access-token')
  assert.doesNotMatch(JSON.stringify(result), /secret-access-token/)
  const hostile = async (url) => url.includes('/token') ? { ok: true, json: async () => ({ access_token: 't' }) } : { ok: true, json: async () => ({ value: [], '@odata.nextLink': 'https://attacker.example/steal' }) }
  await assert.rejects(outlook.lookupBusy({ config, code: 'c', verifier: 'v', redirectUri: 'https://x/cb', week: '2026-11-02', fetcher: hostile }), /page/)
  await assert.rejects(outlook.lookupBusy({ config, code: 'c', verifier: 'v', redirectUri: 'https://x/cb', week: '2026-11-02', fetcher: async () => ({ ok: false, json: async () => ({}) }) }), /token/)
})

test('the popup posts only to the same origin and escapes its payload', () => {
  const html = outlook.popupResult('https://www.out-class.net', { nonce: 'n'.repeat(16), week: '</script><script>alert(1)</script>', busy: [[1, 2]] })
  assert.doesNotMatch(html, /<\/script><script>alert/)
  assert.match(html, /postMessage\(\{"type":"outclass:outlook-busy"/)
  assert.match(html, /,"https:\/\/www\.out-class\.net"\)/)
  assert.doesNotMatch(html, /postMessage\([^)]*"\*"/)
})

test('routes: signed-in, not impersonating or in demo; state, account and single-use cookie are enforced', () => {
  const start = read('app/api/calendar/outlook/start/route.ts'), callback = read('app/api/calendar/outlook/callback/route.ts')
  for (const source of [start, callback]) {
    assert.match(source, /PLATFORM_VIEW_COOKIE/); assert.match(source, /DEMO_COOKIE/); assert.match(source, /requireAuth\(\)/)
    assert.match(source, /outlookConfig\(\)/)
  }
  assert.match(start, /httpOnly: true/); assert.match(start, /path: OUTLOOK_COOKIE_PATH, maxAge: 600/)
  assert.match(callback, /params\.get\("state"\) !== pending\.state/)
  assert.match(callback, /user\.id !== pending\.userId/)
  assert.match(callback, /maxAge: 0/)
  assert.ok(callback.indexOf('maxAge: 0') < callback.indexOf('const config = outlookConfig()'), 'every response clears the pending lookup')
  assert.doesNotMatch(callback, /prisma|access_token|console\.(log|error)\([^)]*(token|busy)/, 'nothing is stored or logged')
  const editor = read('components/availability/my-availability.tsx'), widget = read('components/availability/outlook-busy-import.tsx')
  assert.match(editor, /mode === "week" && OUTLOOK_BUSY_ENABLED && <OutlookBusyImport week=\{week\} days=\{days\} disabled=\{confirming\} onApply=\{editDays\} \/>/)
  assert.match(widget, /event\.origin !== window\.location\.origin \|\| event\.source !== pending\.popup/)
  assert.match(widget, /data\.nonce !== pending\.nonce \|\| data\.week !== pending\.week/)
})
