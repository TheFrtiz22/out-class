const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Load a TS module with @/ aliases resolved to transpiled sources.
const cache = {}
function load(file) {
  const full = path.resolve(file)
  if (cache[full]) return cache[full].exports
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mod = { exports: {} }; cache[full] = mod
  const req = name => {
    if (name.startsWith('@/')) { const base = name.slice(2); for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(base + ext)) return load(base + ext) }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}
const { searchDestinations, matchDestinations } = load('lib/search-destinations.ts')
const hrefs = pages => pages.map(page => page.href)

test('a student with no clubs gets only personal pages', () => {
  const pages = searchDestinations({})
  assert.ok(pages.every(page => page.scope === 'Personal'))
  assert.ok(hrefs(pages).includes('/applications'))
  assert.ok(!hrefs(pages).some(href => href.startsWith('/platform') || href.startsWith('/club/')))
})

test('a plain member reaches that club\'s home, meetings and tasks but no leader tools', () => {
  const pages = searchDestinations({ memberships: [{ clubId: 'c1', club: { name: 'Chess Club' }, permissions: [] }] })
  const club = pages.filter(page => page.scope === 'Chess Club')
  assert.deepEqual(club.map(page => page.title).sort(), ['Club home', 'Meetings', 'Tasks'])
  assert.ok(!hrefs(club).some(href => href.includes('tool=applicants') || href.includes('section=settings')))
})

test('leader pages follow each membership\'s own permissions, across every club', () => {
  const pages = searchDestinations({ memberships: [
    { clubId: 'c1', club: { name: 'Chess Club' }, isOwner: true },
    { clubId: 'c2', club: { name: 'Rowing' }, permissions: ['meetings.manage'] },
  ] })
  const chess = pages.filter(page => page.scope === 'Chess Club').map(page => page.title)
  const rowing = pages.filter(page => page.scope === 'Rowing').map(page => page.title)
  assert.ok(chess.includes('Applicants') && chess.includes('Decide'))
  assert.ok(!rowing.includes('Applicants') && !rowing.includes('Decide'))
  assert.equal(new Set(hrefs(pages)).size, pages.length, 'one entry per address')
})

test('former members and non-admins get nothing extra; admins get the platform', () => {
  assert.ok(!searchDestinations({ memberships: [{ clubId: 'c1', club: { name: 'Gone' }, isOwner: true, status: 'REMOVED' }] }).some(page => page.scope === 'Gone'))
  assert.ok(!hrefs(searchDestinations({})).some(href => href.startsWith('/platform')))
  assert.ok(hrefs(searchDestinations({ admin: true })).includes('/platform/audit'))
})

test('matching uses every word against the page and its workspace', () => {
  const pages = searchDestinations({ memberships: [
    { clubId: 'c1', club: { name: 'Chess Club' }, isOwner: true },
    { clubId: 'c2', club: { name: 'Rowing' }, isOwner: true },
  ] })
  const found = matchDestinations(pages, 'applicants rowing')
  assert.equal(found.length, 1)
  assert.equal(found[0].scope, 'Rowing')
  assert.deepEqual(matchDestinations(pages, '   '), [])
  assert.equal(matchDestinations(pages, 'calendar')[0].title, 'Calendar', 'title matches rank first')
})
