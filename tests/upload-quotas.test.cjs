const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const q = load('lib/upload-quotas.ts')
const owner = '123e4567-e89b-12d3-a456-426614174000'
const clubId = '223e4567-e89b-12d3-a456-426614174000'
const eventId = '323e4567-e89b-12d3-a456-426614174000'
const png = [137, 80, 78, 71, 13, 10, 26, 10]

test('quota edges: the Nth upload in the hour passes, N+1 is refused with the friendly message', () => {
  const { flyer, profile } = q.UPLOAD_QUOTAS
  assert.equal(q.uploadQuotaError({ userRecent: profile.perUserHour - 1 }, profile), null)
  assert.equal(q.uploadQuotaError({ userRecent: profile.perUserHour }, profile), q.UPLOAD_QUOTA_MESSAGES.hourly)
  assert.equal(q.uploadQuotaError({ userRecent: 0, clubRecent: flyer.perClubHour }, flyer), q.UPLOAD_QUOTA_MESSAGES.hourly)
  assert.equal(q.uploadQuotaError({ userRecent: 0, clubRecent: 0, clubBytes: flyer.clubBytes - 10, incomingBytes: 10 }, flyer, 'full'), null)
  assert.equal(q.uploadQuotaError({ userRecent: 0, clubRecent: 0, clubBytes: flyer.clubBytes - 10, incomingBytes: 11 }, flyer, 'full'), 'full')
})

test('recentObjectCount only counts Storage objects inside the window', () => {
  const now = Date.now(), since = q.uploadWindowStart(now)
  const objects = [{ created_at: new Date(now - 1000).toISOString() }, { created_at: new Date(now - 3600001).toISOString() }, { created_at: null }, {}]
  assert.equal(q.recentObjectCount(objects, since), 1)
  assert.equal(q.recentObjectCount(null, since), 0)
})

function profileHarness(recentCount, listError = null) {
  process.env.SUPABASE_SECRET_KEY = 'test-only'
  const calls = []
  const recent = Array.from({ length: recentCount }, () => ({ created_at: new Date().toISOString() }))
  const admin = { storage: {
    getBucket: async () => ({ data: { public: false } }),
    from: bucket => ({ list: async (folder, options) => { calls.push({ step: 'list', bucket, folder, options }); return listError ? { data: null, error: listError } : { data: recent, error: null } } }),
  } }
  const api = load('actions/storage.ts', {
    '@/utils/auth': { requireAuth: async () => ({ user: { id: owner } }) },
    '@/utils/support-audit': { auditSupportAction: async () => {} },
    'next/headers': { cookies: async () => ({}) },
    '@supabase/supabase-js': { createClient: () => admin },
    '@/utils/supabase/server': { createClient: async () => ({ storage: { from: () => ({
      createSignedUploadUrl: async path => { calls.push({ step: 'sign', path }); return { data: { token: 't' } } },
      uploadToSignedUrl: async () => ({ error: null }),
    }) } }) },
  })
  const form = new FormData(); form.set('kind', 'headshot'); form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'portrait.png')
  return { api, calls, form }
}

test('profile headshot/résumé replacement is limited per owner per hour, counted from Storage metadata', async () => {
  const ok = profileHarness(q.UPLOAD_QUOTAS.profile.perUserHour - 1)
  await ok.api.uploadProfileFile(ok.form)
  const list = ok.calls.find(c => c.step === 'list')
  assert.deepEqual([list.bucket, list.folder], ['headshots', owner])
  assert.equal(list.options.sortBy.order, 'desc')
  assert.ok(ok.calls.some(c => c.step === 'sign'))

  const full = profileHarness(q.UPLOAD_QUOTAS.profile.perUserHour)
  await assert.rejects(full.api.uploadProfileFile(full.form), /Hourly upload limit reached/)
  assert.ok(!full.calls.some(c => c.step === 'sign'))

  const broken = profileHarness(0, { message: 'down' })
  await assert.rejects(broken.api.uploadProfileFile(broken.form), /storage is unavailable/)
  assert.ok(!broken.calls.some(c => c.step === 'sign'))
})

function flyerHarness({ userRecent = 0, clubRecent = 0, clubBytes = 0 } = {}) {
  const calls = []
  const tx = {
    $queryRaw: async () => [],
    meeting: { findFirst: async () => ({ revision: 1, publication: { status: 'DRAFT' } }), update: async () => ({}) },
    auditLog: {
      count: async ({ where }) => { calls.push({ step: 'count', where }); return where.actorId ? userRecent : clubRecent },
      create: async () => ({}),
    },
    eventFlyer: {
      aggregate: async args => { calls.push({ step: 'bytes', args }); return { _sum: { size: clubBytes } } },
      create: async () => ({}), findUniqueOrThrow: async () => ({ id: 'f' }),
    },
    eventPublication: { update: async () => ({}) },
  }
  const api = load('actions/event-flyers.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: owner } }) },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx), $executeRaw: async () => {} } },
    '@/utils/event-flyer-storage': { privateFlyerStorage: async () => ({ upload: async () => { calls.push({ step: 'upload' }); return { error: null } }, remove: async () => ({ error: null }) }) },
    '@/utils/support-audit': { auditSupportAction: async () => {} },
    '@/utils/event-flyer-cleanup': { cleanupEventFlyers: async () => {} },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  })
  const form = new FormData()
  form.set('eventId', eventId); form.set('clubId', clubId); form.set('revision', '1')
  form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'flyer.png')
  return { api, calls, form }
}

test('event flyers: per-user and per-club hourly limits and a per-club byte cap, before Storage', async () => {
  const ok = flyerHarness()
  await ok.api.uploadEventFlyer(ok.form)
  assert.ok(ok.calls.some(c => c.step === 'upload'))
  assert.deepEqual(ok.calls.find(c => c.step === 'bytes').args.where, { event: { clubId } })
  assert.ok(ok.calls.every(c => c.step !== 'count' || c.where.action === 'event.flyer.upload'))

  const { flyer } = q.UPLOAD_QUOTAS
  for (const [usage, message] of [
    [{ userRecent: flyer.perUserHour }, /Hourly upload limit reached/],
    [{ clubRecent: flyer.perClubHour }, /Hourly upload limit reached/],
    [{ clubBytes: flyer.clubBytes }, /flyer storage limit/],
  ]) {
    const h = flyerHarness(usage)
    await assert.rejects(h.api.uploadEventFlyer(h.form), message)
    assert.ok(!h.calls.some(c => c.step === 'upload'), JSON.stringify(usage))
  }
})

const SIX_MB = 6 * 1024 * 1024
function clubHarness({ failSum = false } = {}) {
  const objects = new Map(), logs = [], removed = []
  const club = { id: clubId, name: 'Club', tagline: '', description: '', logoUrl: null, bannerUrl: null, marketing: {} }
  const bucket = {
    upload: async (path) => { objects.set(path, SIX_MB); return { error: null } },
    remove: async (paths) => { for (const p of paths) { removed.push(p); objects.delete(p) } return { data: [], error: null } },
  }
  const prisma = {
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?')
      if (sql.includes('pg_policies')) return [{ secured: true }]
      if (sql.includes('SUM(')) {
        if (failSum) throw Object.assign(Error('permission denied for schema storage'), { name: 'PrismaClientKnownRequestError' })
        return [{ bytes: values[0].reduce((sum, path) => sum + (objects.get(path) || 0), 0) }]
      }
      throw Error('unexpected query: ' + sql)
    },
    club: { findUnique: async () => ({ ...club }) },
  }
  const tx = {
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?')
      if (sql.includes('SUM(')) throw Error('byte cap must not run inside the transaction')
      if (sql.includes('SELECT name FROM storage.objects')) return objects.has(values[0]) ? [{ name: values[0] }] : []
      return []
    },
    club: { findUnique: async () => ({ ...club }), findUniqueOrThrow: async () => ({ ...club }), update: async ({ data }) => Object.assign(club, data) },
    auditLog: { count: async () => 0, create: async () => ({}) }, // hourly windows simulated as already elapsed
  }
  prisma.$transaction = async fn => fn(tx)
  const storageModule = load('utils/club-asset-storage.ts', {
    'server-only': {}, '@/utils/prisma': { prisma },
    '@supabase/supabase-js': { createClient: () => ({ storage: { getBucket: async () => ({ data: { public: false }, error: null }), from: () => bucket } }) },
  })
  const common = {
    '@/utils/prisma': { prisma }, '@/utils/club-asset-storage': storageModule,
    '@/utils/auth': { requireAuth: async () => ({ user: { id: owner } }), requireClubPermission: async () => ({ user: { id: owner } }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
  }
  const assets = load('actions/club-assets.ts', { ...common,
    '@/utils/platform-admin': { requirePlatformAdmin: async () => ({ id: owner }) },
    '@/utils/admin-transaction': { authorizeAdminTransaction: async () => {} },
    '@/lib/club-image': { prepareClubImage: async () => ({ bytes: new Uint8Array(SIX_MB), mime: 'image/png', contentType: 'image/webp' }) },
  })
  const workspace = load('actions/club-workspace.ts', { ...common,
    '@/lib/club-suspension': { lockOperationalClub: async () => {} },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn(tx) },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  })
  const upload = () => { const f = new FormData(); f.set('clubId', clubId); f.set('admin', 'false'); f.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'logo.png'); return assets.uploadClubAsset(f) }
  const saveLogo = logoUrl => workspace.updateClubSettings({ clubId, name: 'Club', tagline: '', description: '', logoUrl })
  return { upload, saveLogo, objects, removed, logs, club }
}
async function withLoggedErrors(fn) {
  const original = console.error, lines = []
  console.error = (...args) => lines.push(args)
  try { return { result: await fn(), lines } } finally { console.error = original }
}

test('club images: a failing byte-cap read is logged and skipped, and the upload still succeeds', async () => {
  const h = clubHarness({ failSum: true })
  h.club.logoUrl = `club-assets/${clubId}/00000000-0000-4000-8000-000000000001.webp` // something referenced, so the SUM runs
  const { result, lines } = await withLoggedErrors(() => h.upload())
  assert.match(result.reference, new RegExp(`^club-assets/${clubId}/`))
  assert.deepEqual(lines, [['club.asset.quota.bytes.failure', { clubId, code: 'PrismaClientKnownRequestError' }]])
})

test('club images: replacements delete the previous object, so the 22nd upload still fits under the cap', async () => {
  const h = clubHarness()
  let previous = null
  for (let i = 0; i < 21; i++) {
    const { reference } = await h.upload()
    await h.saveLogo(reference)
    if (previous) assert.ok(!h.objects.has(previous.slice('club-assets/'.length)), `replacement ${i} deleted its predecessor`)
    previous = reference
  }
  assert.equal(h.removed.length, 20)
  assert.equal(h.objects.size, 1) // 21 x 6 MB would be 126 MB without cleanup
  const next = await h.upload()
  assert.match(next.reference, /^club-assets\//)
})

test('club images: only referenced images count, and the cap message points to removing unused images', async () => {
  const h = clubHarness()
  for (let i = 0; i < 16; i++) { const { reference } = await h.upload(); h.club.marketing = { gallery: [...(h.club.marketing.gallery || []), { url: reference }] } }
  // 16 x 6 MB = 96 MB referenced: one more 6 MB image would exceed 100 MB.
  await assert.rejects(h.upload(), /Remove images the club no longer uses/)
  h.club.marketing = { gallery: h.club.marketing.gallery.slice(0, 3) }
  assert.match((await h.upload()).reference, /^club-assets\//)
  assert.doesNotMatch(q.UPLOAD_QUOTA_MESSAGES.clubAssetStorage, /support/i)
})

test('club images: hourly counts stay in the transaction; the byte read and image release happen outside it', () => {
  const source = fs.readFileSync('actions/club-assets.ts', 'utf8')
  const bytes = source.indexOf('referencedClubAssetBytes(clubId)'), tx = source.indexOf('prisma.$transaction')
  assert.ok(bytes > 0 && bytes < tx)
  assert.doesNotMatch(source, /storage\.objects/)
  assert.match(source, /action: 'club\.asset\.upload', createdAt: \{ gte: since \}/)
  for (const file of ['actions/club-workspace.ts', 'actions/admin-clubs.ts']) {
    const save = fs.readFileSync(file, 'utf8')
    assert.ok(save.lastIndexOf('releaseReplacedClubImages(') > save.indexOf('$transaction') || save.lastIndexOf('releaseReplacedClubImages(') > save.indexOf('clubWriteTransaction(async'), file)
  }
})
