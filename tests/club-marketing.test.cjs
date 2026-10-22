const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { "next/cache": { unstable_cache: fn => fn, revalidateTag() {}, revalidatePath() {} }, ...mocks }
  if (mocks["@/utils/prisma"]) mocks["@/utils/club-write-transaction"] = { clubWriteTransaction: fn => mocks["@/utils/prisma"].prisma.$transaction(fn) }
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
  new Function('require', 'module', 'exports', code)(n => n === '@/components/club-logo' ? require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx') : n === '@/components/icons' ? require('./helpers/icons.cjs') : n.endsWith('.css') ? {} : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts') : require(n), mod, mod.exports)
  const profile = draft()
  const header = renderToStaticMarkup(React.createElement(mod.exports.MarketingProfile, { profile }))
  const sections = renderToStaticMarkup(React.createElement(mod.exports.MarketingSections, { profile }))
  assert.match(header, /Impact Club/)
  assert.match(header, /Members/)
  profile.logoUrl = 'https://example.com/white-logo.png'
  profile.marketing.logoOnBrand = true
  assert.match(renderToStaticMarkup(React.createElement(mod.exports.MarketingProfile, { profile })), /background-color:#123456/)
  assert.match(sections, /Mentorship/)
  assert.match(sections, /Who can join\?/)
  assert.match(sections, /https:\/\/example.com\/join/)
  profile.marketing.showMembers = false
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(mod.exports.MarketingProfile, { profile })), />Members</)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(mod.exports.MarketingSections, { profile: profileDraft({ name: 'Empty' }) })), /Frequently asked|Life in the club|A look inside/)
})

test('published profile compare tokens reject concurrent authors and recover identical retries', async () => {
  let current = clubProfileSchema.parse(draft()), writes = 0
  const expectedProfile = JSON.stringify(current)
  const tx = { club: { findUniqueOrThrow: async () => current, update: async q => { writes++; current = { ...current, ...q.data } } }, auditLog: { create: async () => {} } }
  const actions = load('actions/club-workspace.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'editor' } }) },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
  })
  const next = { ...current, description: 'The acknowledged public description' }
  await actions.updateClubSettings({ clubId, ...next, expectedProfile })
  await actions.updateClubSettings({ clubId, ...next, expectedProfile })
  await assert.rejects(actions.updateClubSettings({ clubId, ...next, description: 'Stale competing draft', expectedProfile }), /changed while you were editing/)
  assert.equal(current.description, next.description); assert.equal(writes, 2)
})

test('selectivity context round trips and does not present unknown or hidden rates as facts', () => {
  const { profileStatistics } = load('lib/club-marketing.ts')
  const p = profileDraft({ name: 'Research fund', acceptanceRate: 3, marketing: { acceptanceApproximate: true, acceptanceNote: 'Approximate · cohort not specified', acceptanceSource: 'https://example.com/' } })
  assert.deepEqual(profileDraft(clubProfileSchema.parse(p)), p)
  assert.equal(profileStatistics(p)[0].value, '~3%')
  assert.equal(profileStatistics({ marketing: {} })[0].value, 'Not disclosed')
  assert.equal(profileStatistics({ ...p, marketing: { ...p.marketing, showAcceptance: false } }).length, 0)
  for (const bannerPosition of [{ x: -1, y: 50 }, { x: 50, y: 101 }]) assert.equal(clubProfileSchema.safeParse({ ...p, marketing: { ...p.marketing, bannerPosition } }).success, false)
  assert.equal(clubProfileSchema.safeParse({ ...p, marketing: { ...p.marketing, acceptanceSource: 'javascript:alert(1)' } }).success, false)
})
test('researched package keeps cohort/approximation explicit and does not confuse McIntire admission with club admission', () => {
  const { clubProfileImportSchema } = load('lib/club-profile-import.ts')
  const data = clubProfileImportSchema.parse(JSON.parse(fs.readFileSync('docs/club-profile-design/profiles.json', 'utf8')))
  assert.equal(data.profiles.length, 13)
  const vcg = data.profiles.find(p => p.key === 'vcg').profile
  assert.equal(vcg.acceptanceRate, 3); assert.match(vcg.marketing.acceptanceNote, /Spring 2026/)
  const fbif = data.profiles.find(p => p.key === 'fbif').profile
  assert.equal(fbif.marketing.acceptanceApproximate, true); assert.match(fbif.marketing.acceptanceNote, /cohort not specified/)
  assert.equal(data.profiles.find(p => p.key === 'vvf').profile.acceptanceRate, null)
  assert.equal(data.profiles.filter(p => p.profile.acceptanceRate == null).length, 11)
})
test('import rejects duplicate clubs, path escapes and preassigned remote images', () => {
  const { clubProfileImportSchema } = load('lib/club-profile-import.ts')
  const row = { key: 'club', slug: 'club', profile: profileDraft({ name: 'Club' }) }
  assert.equal(clubProfileImportSchema.safeParse({ profiles: [row, row] }).success, false)
  assert.equal(clubProfileImportSchema.safeParse({ profiles: [{ ...row, imageAssignments: { logoUrl: ['images/../secret.png'] } }] }).success, false)
  assert.equal(clubProfileImportSchema.safeParse({ profiles: [{ ...row, profile: { ...row.profile, logoUrl: 'https://example.com/logo.png' } }] }).success, false)
})
test('import preflights the entire package before writes, publishes only after uploads, preserves version checks and stops on conflict', async () => {
  const { runClubProfileImport } = load('lib/club-profile-import.ts')
  const row = { key: 'club', slug: 'club', existingId: null, profile: profileDraft({ name: 'Club' }), imageAssignments: { logoUrl: ['images/club-logo.png'] } }
  const calls = [], file = new File(['png-fixture'], 'club-logo.png', { type: 'image/png' })
  const ops = { save: async d => { calls.push(['save', d]); return { id: clubId } }, load: async id => { calls.push(['load', id]); return { id, version: 'expected-version' } }, upload: async (id, f) => { calls.push(['upload', id, f.name]); return `club-assets/${id}/00000000-0000-4000-8000-000000000002.webp` }, progress: () => {} }
  await assert.rejects(runClubProfileImport([{ row, current: null }], [], 'school-uva', 'Approved researched import', ops), /Missing image/)
  assert.equal(calls.length, 0)
  await runClubProfileImport([{ row, current: null }], [file], 'school-uva', 'Approved researched import', ops)
  assert.deepEqual(calls.map(c => c[0]), ['save', 'load', 'upload', 'save'])
  assert.equal(calls[0][1].isDiscoverable, false)
  assert.equal(calls[3][1].isDiscoverable, true)
  assert.equal(calls[3][1].applicationOpen, false)
  assert.equal(calls[3][1].version, 'expected-version')
  assert.match(calls[3][1].profile.logoUrl, /^club-assets\//)
  assert.equal(row.profile.logoUrl, null)
  calls.length = 0
  await assert.rejects(runClubProfileImport([{ row, current: { id: clubId, version: 'stale' } }, { row: { ...row, slug: 'second' }, current: null }], [file], 'school-uva', 'Approved researched import', { ...ops, save: async () => { calls.push(['conflict']); return { error: 'Club changed. Reload before saving.' } } }), /Club changed/)
  assert.deepEqual(calls.map(c => c[0]), ['upload', 'conflict'])
})

test('commerce packages cover every verified directory club without fabricated admissions or replacement identities', () => {
  const { clubProfileImportSchema } = load('lib/club-profile-import.ts')
  const first = JSON.parse(fs.readFileSync('docs/club-profile-design/profiles.json', 'utf8'))
  const extra = JSON.parse(fs.readFileSync('docs/club-profile-design/commerce-expansion.json', 'utf8'))
  const inventory = JSON.parse(fs.readFileSync('docs/club-profile-design/commerce-inventory.json', 'utf8'))
  const packages = [first, extra].map(p => clubProfileImportSchema.parse(p))
  const rows = packages.flatMap(p => p.profiles), keys = new Set(rows.map(p => p.key))
  assert.equal(rows.length, 38); assert.equal(keys.size, 38)
  assert.equal(new Set(rows.map(p => p.slug)).size, 38)
  assert.equal(inventory.organizations.length, 34)
  for (const org of [...inventory.organizations, ...inventory.additionalOrganizations]) assert.ok(keys.has(org.profileKey), org.name)
  assert.equal(keys.has('mdsa'), false); assert.match(extra.unresolved[0].reason, /identity/)
  for (const row of extra.profiles) {
    assert.equal(row.profile.acceptanceRate, null); assert.equal(row.applicationOpen, false)
    assert.ok(row.sources.length); assert.ok(row.profile.marketing.links.length)
    for (const source of row.sources) assert.ok(new URL(source.url).protocol === 'https:')
  }
  for (const [key,id] of [['aif','b90c1444-45ea-45bc-9b05-1f5a73c63303'],['mii','b90c1444-45ea-45bc-9b05-1f5a73c63301']]) {
    const row = rows.find(p => p.key === key)
    assert.equal(row.existingId, id); assert.equal(row.slug, key)
  }
})
test('white logos can retain their original artwork on a brand-color background with backward-compatible defaults', () => {
  assert.equal(profileDraft({ name: 'Legacy club' }).marketing.logoOnBrand, false)
  const profile = profileDraft({ name: 'White logo club', marketing: { logoOnBrand: true } })
  assert.equal(clubProfileSchema.parse(profile).marketing.logoOnBrand, true)
  assert.equal(clubProfileSchema.safeParse({ ...profile, marketing: { logoOnBrand: 'yes' } }).success, false)
})

test('logo presentation choices persist through the existing authorized settings update and preserve artwork', async () => {
  let profile = draft(), allowed = true, transactionAllowed = true, writes = 0
  const actions = load('actions/club-workspace.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, id, actor, permissions) => { assert.equal(id, clubId); assert.equal(actor, 'editor'); assert.deepEqual(permissions, ['club.settings']); if (!transactionAllowed) throw Error('Revoked') } },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} },
    '@/utils/auth': { requireClubPermission: async () => { if (!allowed) throw Error('Denied'); return { user: { id: 'editor' } } } },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn({ club: { findUniqueOrThrow: async () => profile, update: async ({data}) => { writes++; profile = {...profile,...data} } }, auditLog: {create: async()=>{}} }) } },
  })
  const original = profile.logoUrl
  for (const mode of ['auto','navy','ivory','transparent','custom']) {
    const logoBackground = {mode,...(mode==='custom'?{color:'#3b6149'}:{})}
    await actions.updateClubSettings({clubId,...profile,marketing:{...profile.marketing,logoBackground},expectedProfile:JSON.stringify(clubProfileSchema.parse(profile))})
    assert.deepEqual(profileDraft(JSON.parse(JSON.stringify(profile))).marketing.logoBackground,logoBackground)
    assert.equal(profile.logoUrl,original)
  }
  for (const color of ['red','transparent','#fff','#12345678','url(https://evil.test)','var(--primary)','</style><script>',';color:red']) {
    await assert.rejects(actions.updateClubSettings({clubId,...profile,marketing:{...profile.marketing,logoBackground:{mode:'custom',color}}}))
  }
  const before = writes
  allowed = false
  await assert.rejects(actions.updateClubSettings({clubId,...profile}),/Denied/)
  allowed = true; transactionAllowed = false
  await assert.rejects(actions.updateClubSettings({clubId,...profile}),/Revoked/)
  assert.equal(writes,before)
})

test('automatic background distinguishes transparent light/dark artwork from opaque images and respects manual overrides', async () => {
  const sharp = require('sharp')
  const {analyzeLogoPixels,logoBackgroundColor,LOGO_NAVY,LOGO_IVORY} = load('lib/club-logo-background.ts')
  async function artwork(fill, background='none', format='png') {
    const encoded=await sharp(Buffer.from(`<svg width="60" height="60"><rect width="60" height="60" fill="${background}"/><rect x="10" y="10" width="40" height="40" fill="${fill}"/></svg>`))[format]().toBuffer()
    const bytes=await sharp(encoded).ensureAlpha().raw().toBuffer()
    return analyzeLogoPixels(bytes)
  }
  const white = await artwork('white'), dark = await artwork('#142D45'), opaque = await artwork('white','white','jpeg')
  assert.equal(white.transparent,true);assert.equal(logoBackgroundColor({},'#123456',white),LOGO_NAVY)
  assert.equal(dark.transparent,true);assert.equal(logoBackgroundColor(null,'#123456',dark),LOGO_IVORY)
  assert.equal(opaque.transparent,false);assert.equal(opaque.lowContrast,true);assert.equal(logoBackgroundColor({},'#123456',opaque),'transparent')
  for (const analysis of [white,dark,opaque,null]) {
    assert.equal(logoBackgroundColor({logoBackground:{mode:'transparent'}},'#123456',analysis),'transparent')
    assert.equal(logoBackgroundColor({logoBackground:{mode:'custom',color:'#123456'}},'#ffffff',analysis),'#123456')
    assert.equal(logoBackgroundColor({logoOnBrand:true},'#123456',analysis),'#123456')
    assert.equal(logoBackgroundColor({logoOnBrand:true,logoBackground:{mode:'ivory'}},'#123456',analysis),LOGO_IVORY)
  }
  assert.equal(logoBackgroundColor({logoBackground:{mode:'custom',color:'url(evil)'}},'red',white),LOGO_NAVY)
  assert.equal(analyzeLogoPixels([255,255,255,0]),null)
})

test('profile enrichment preserves an existing live intake and deadline rather than closing recruitment', async () => {
  const { runClubProfileImport } = load('lib/club-profile-import.ts')
  const row = { key: 'mii', slug: 'mii', profile: profileDraft({ name: 'McIntire Investment Institute' }), imageAssignments: {} }
  const calls = [], deadline = '2027-02-01T23:59:00.000Z'
  const current = { id: clubId, version: 'reviewed-version', applicationOpen: true, applicationDeadline: deadline }
  await runClubProfileImport([{ row, current }], [], 'school-uva', 'Enrich researched club profile', { save: async d => { calls.push(d); return { id: clubId } }, load: async () => current, upload: async () => { throw Error('Unexpected upload') }, progress() {} })
  assert.equal(calls.length, 1); assert.equal(calls[0].id, clubId); assert.equal(calls[0].version, current.version)
  assert.equal(calls[0].applicationOpen, true); assert.equal(calls[0].applicationDeadline, deadline)
})
