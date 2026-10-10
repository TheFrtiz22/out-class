const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { "next/cache": { unstable_cache: fn => fn, revalidateTag() {}, revalidatePath() {} }, ...mocks }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { clubProfileSchema, profileDraft, readMarketing } = load('lib/club-marketing.ts')
const clubId = '00000000-0000-4000-8000-000000000001'
const draft = () => ({ ...profileDraft({ name: 'Impact Club', tagline: 'Build together', category: 'Service', color: '#123456' }), marketing: { ...readMarketing({}), memberCount: 0, benefits: ['Mentorship'], faqs: [{ question: 'Who can join?', answer: 'All years' }], links: [{ label: 'Join our community', url: 'https://example.com/join' }], gallery: [{ url: 'data:image/webp;base64,YQ==', caption: 'Our team' }] } })
test('marketing round trips optional content, zero counts, visibility, and uploaded images', () => {
  const saved = clubProfileSchema.parse(draft())
  assert.deepEqual(profileDraft(JSON.parse(JSON.stringify(saved))), saved)
  assert.equal(saved.marketing.memberCount, 0)
  assert.equal(saved.marketing.faqs[0].answer, 'All years')
  assert.equal(readMarketing(null).showMembers, true)
})
test('invalid links, non-raster uploads, oversized images, and impossible stats cannot publish', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.com', 'https://']) {
    assert.equal(clubProfileSchema.safeParse({ ...draft(), marketing: { ...draft().marketing, website: url } }).success, false)
  }
  for (const logoUrl of ['data:image/svg+xml;base64,YQ==', 'blob:http://localhost/id', 'data:image/png;base64,' + 'a'.repeat(350000)]) assert.equal(clubProfileSchema.safeParse({ ...draft(), logoUrl }).success, false)
  assert.equal(clubProfileSchema.safeParse({ ...draft(), acceptanceRate: 101 }).success, false)
  assert.equal(clubProfileSchema.safeParse({ ...draft(), marketing: { ...draft().marketing, memberCount: -1 } }).success, false)
})
test('publishing checks club permission and atomically saves every profile field with an audit', async () => {
  let stored, audit, allowed = false, writes = 0
  const actions = load('actions/club-workspace.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} },
    '@/utils/auth': { requireClubPermission: async (id, p) => { assert.equal(id, clubId); assert.deepEqual(p, ['club.settings']); if (!allowed) throw new Error('Denied'); return { user: { id: 'editor' } } } },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn({ $queryRaw: async()=>[], club: { findUniqueOrThrow: async () => draft(), update: async q => { writes++; stored = q.data; assert.equal(q.where.id, clubId) } }, auditLog: { create: async q => { audit = q.data } } }) } },
  })
  await assert.rejects(actions.updateClubSettings({ clubId, ...draft() }), /Denied/)
  assert.equal(writes, 0)
  allowed = true
  await actions.updateClubSettings({ clubId, ...draft() })
  assert.deepEqual(stored, clubProfileSchema.parse(draft()))
  assert.equal(audit.actorId, 'editor')
  assert.equal(audit.action, 'club.settings.update')
})
test('Discover receives saved marketing while hidden statistics are omitted', async () => {
  const persisted = { ...draft(), id: clubId, pipelineRounds: [], questions: [], events: [], acceptanceRate: 8, aumValue: 100000, marketing: { ...draft().marketing, showAcceptance: false, showAum: false } }
  const actions = load('actions/club-directory.ts', { '@/utils/prisma': { prisma: { meeting: {findMany: async()=>[]}, club: { findMany: async q => { assert.equal(q.select.marketing, true); assert.equal(q.select.members, undefined); return [persisted] } } } } })
  const result = await actions.getClubDirectory()
  assert.deepEqual(result.clubs[0].marketing, persisted.marketing)
  assert.equal(result.clubs[0].acceptanceRate, null)
  assert.equal(result.clubs[0].aumValue, null)
})
test('marketing migration preserves existing clubs and persists JSON content', async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE "Club" (id TEXT PRIMARY KEY, name TEXT); INSERT INTO "Club" VALUES (\'c\', \'Club\');')
    await db.exec(fs.readFileSync('prisma/migrations/20260929000000_club_marketing/migration.sql', 'utf8'))
    const before = await db.query('SELECT * FROM "Club"')
    assert.equal(before.rows[0].marketing, null)
    await db.query('UPDATE "Club" SET marketing = $1 WHERE id = $2', [JSON.stringify(draft().marketing), 'c'])
    const after = await db.query('SELECT marketing FROM "Club"')
    assert.deepEqual(after.rows[0].marketing, draft().marketing)
  } finally { await db.close() }
})

test('shared public renderer displays marketing content and respects empty and hidden sections', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/clubs/marketing-profile.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(n => n === '@/lib/club-marketing' ? { readMarketing } : n === '@/lib/club-assets' ? load('lib/club-assets.ts') : require(n), mod, mod.exports)
  const profile = draft()
  const header = renderToStaticMarkup(React.createElement(mod.exports.MarketingProfile, { profile }))
  const sections = renderToStaticMarkup(React.createElement(mod.exports.MarketingSections, { profile }))
  assert.match(header, /Impact Club/)
  assert.match(header, /Members/)
  assert.match(sections, /Mentorship/)
  assert.match(sections, /Who can join\?/)
  assert.match(sections, /https:\/\/example.com\/join/)
  profile.marketing.showMembers = false
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(mod.exports.MarketingProfile, { profile })), />Members</)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(mod.exports.MarketingSections, { profile: profileDraft({ name: 'Empty' }) })), /Frequently asked|Life in the club|A look inside/)
})
