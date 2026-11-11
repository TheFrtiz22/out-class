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

test('club images count audit rows and stored object sizes before uploading', () => {
  const source = fs.readFileSync('actions/club-assets.ts', 'utf8')
  const quota = source.indexOf('uploadQuotaError('), upload = source.indexOf('storage.upload(')
  assert.ok(quota > 0 && quota < upload)
  assert.match(source, /action: 'club\.asset\.upload', createdAt: \{ gte: since \}/)
  assert.match(source, /FROM storage\.objects WHERE bucket_id='club-assets' AND name LIKE \$\{clubId \+ '\/%'\}/)
  assert.match(source, /UPLOAD_QUOTAS\.clubAsset, UPLOAD_QUOTA_MESSAGES\.clubAssetStorage/)
})
