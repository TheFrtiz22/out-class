// Signed-out entry points: invitation and club-link cards, public Explore projection,
// short-link 404s, sitemap/robots. Pages are transpiled and rendered with mocked services.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name === 'server-only' || name.endsWith('.css')) return {}
    if (name === '@/components/icons') return require('./helpers/icons.cjs')
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = ['', '.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
      if (resolved) return load(resolved, mocks)
    }
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}
const signedOut = { '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }, 'next/headers': { cookies: async () => ({}) } }
const forbidden = () => { throw Error('must not run for a signed-out visitor') }
const id = '7d1f0f43-5f5e-4a39-9e8a-5e3c52c3c0a1'

test('invitation preview reads only a pending, unexpired, unanswered invitation of an active club, and no email', async () => {
  let query = null
  const prisma = { clubInvitation: { findFirst: async q => { query = q; return { requestedRole: 'INTERVIEWER', schoolIdentityId: null, club: { name: 'Virginia Venture Fund' } } } }, club: { findFirst: async () => null } }
  const { invitationPreview } = load('lib/public-link-preview.ts', { '@/utils/prisma': { prisma } })
  assert.deepEqual(await invitationPreview(id), { clubName: 'Virginia Venture Fund', role: 'Interviewer', owner: false })
  assert.equal(query.where.id, id); assert.equal(query.where.status, 'PENDING')
  for (const key of ['acceptedAt', 'declinedAt', 'revokedAt']) assert.equal(query.where[key], null)
  assert.ok(query.where.expiresAt.gt instanceof Date); assert.deepEqual(query.where.club, { suspendedAt: null })
  assert.deepEqual(Object.keys(query.select).sort(), ['club', 'requestedRole', 'schoolIdentityId'])
  assert.deepEqual(query.select.club, { select: { name: true } })
  query = null
  assert.equal(await invitationPreview('not-a-uuid'), null); assert.equal(query, null)
  const failing = load('lib/public-link-preview.ts', { '@/utils/prisma': { prisma: { clubInvitation: { findFirst: async () => { throw Error('db down') } } } } })
  assert.equal(await failing.invitationPreview(id), null)
})

function invitationPage(preview) {
  return load('app/(workspace)/invitations/[id]/page.tsx', {
    ...signedOut,
    '@/lib/public-link-preview': { invitationPreview: async () => preview },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: null } }), requireAuth: forbidden },
    '@/utils/prisma': { prisma: new Proxy({}, { get: forbidden }) },
    '@/utils/profile-onboarding': { requireCompletedStudentProfile: forbidden },
    '@/utils/school-identity': { previewVerifiedSchoolIdentities: forbidden, prepareVerifiedSchoolAccount: forbidden },
    '@/utils/verified-email-policy': { UniversityVerificationError: class extends Error {} },
    '@/components/invitation-response': { InvitationResponse: () => null },
  }).default
}

test('signed-out invitation: dedicated card with Sign in and Create account returning to the link; no identity work runs', async () => {
  const html = renderToStaticMarkup(await invitationPage({ clubName: 'Virginia Venture Fund', role: 'Interviewer', owner: false })({ params: Promise.resolve({ id }) }))
  assert.match(html, /<h1[^>]*>You’ve been invited to join Virginia Venture Fund as an interviewer<\/h1>/)
  const next = encodeURIComponent(`/invitations/${id}`)
  assert.match(html, new RegExp(`href="/login\\?next=${next}"`)); assert.match(html, new RegExp(`href="/signup\\?next=${next}"`))
  assert.doesNotMatch(html, /@virginia\.edu|outclass-landing|Find and apply/)
})

test('signed-out invitation: an invalid or expired link gets a clear message, not the marketing page', async () => {
  const html = renderToStaticMarkup(await invitationPage(null)({ params: Promise.resolve({ id }) }))
  assert.match(html, /This invitation link isn’t valid/)
  assert.match(html, /href="\/"/); assert.match(html, new RegExp(`href="/login\\?next=${encodeURIComponent(`/invitations/${id}`)}"`))
  assert.doesNotMatch(html, /\/signup/)
})

// Signed-in GET render of an invitation: the real read-only identity preview runs against a
// recording Prisma double. Any create/update/upsert/delete/$transaction call fails the test.
function signedInInvitationPage({ email = 'recipient@virginia.edu', userId = 'recipient', identities, invitation, configs }) {
  const calls = [], authCalls = []
  const read = (model, impl) => ({ [model]: new Proxy(impl, { get: (target, op) => { calls.push(`${model}.${String(op)}`); if (!(op in target)) throw Error(`write during GET render: ${model}.${String(op)}`); return target[op] } }) })
  const evaluate = where => where.id === invitation?.id && where.OR.some(c => c.schoolIdentityId === null ? !invitation.schoolIdentityId && invitation.email === c.email : c.schoolIdentityId.in.includes(invitation.schoolIdentityId))
  const prisma = new Proxy({
    ...read('user', { findUnique: async () => ({ email, disabledAt: null }) }),
    ...read('schoolIdentifierType', { findMany: async ({ where }) => configs.filter(c => c.emailDomain === where.emailDomain) }),
    ...read('schoolIdentity', { findMany: async ({ where }) => identities.filter(i => where.OR.some(c => c.schoolId === i.schoolId && c.identifierTypeId === i.identifierTypeId && c.normalizedIdentifier === i.normalizedIdentifier)) }),
    ...read('clubInvitation', { findFirst: async ({ where }) => evaluate(where) ? { ...invitation, club: { name: 'Virginia Venture Fund' } } : null }),
  }, { get: (target, key) => { if (!(key in target)) throw Error(`write during GET render: ${String(key)}`); return target[key] } })
  const account = { user: { id: userId, email }, supabaseUser: { id: userId, email, confirmation_sent_at: '2026-09-01', email_confirmed_at: '2026-10-01' }, impersonation: null }
  const page = load('app/(workspace)/invitations/[id]/page.tsx', {
    '@/utils/auth': { getSessionUser: async () => { authCalls.push('session'); return { data: { user: { id: userId } } } }, requireAuth: async () => { authCalls.push('require'); return account } },
    '@/utils/prisma': { prisma },
    '@/utils/profile-onboarding': { requireCompletedStudentProfile: async () => {} },
    '@/utils/verified-email-policy': { ...load('utils/verified-email-policy.ts'), requireVerifiedEmailPolicy: async () => {} },
    '@/utils/club-write-transaction': { clubWriteTransaction: () => { throw Error('write transaction during GET render') } },
    '@/lib/public-link-preview': { invitationPreview: forbidden },
    '@/components/invitation-response': { InvitationResponse: props => React.createElement('invitation-response', { 'data-id': props.id, 'data-owner': String(props.owner) }) },
  }).default
  return { page, calls, authCalls }
}
const uvaComputing = { id: 'computing', schoolId: 'school-uva', emailDomain: 'virginia.edu', normalization: 'TRIM_LOWERCASE', validationRegex: '^[a-z0-9]+$' }
const otherComputing = { id: 'other-computing', schoolId: 'school-other', emailDomain: 'other.edu', normalization: 'TRIM_LOWERCASE', validationRegex: '^[a-z0-9]+$' }
const ownerInvite = { id, schoolIdentityId: 'identity', requestedRole: 'OWNER', permissions: [], email: 'recipient@virginia.edu' }

test('signed-in invitation GET performs no write, even for a not-yet-bound identity, and verifies the session once', async () => {
  const h = signedInInvitationPage({ configs: [uvaComputing], invitation: ownerInvite, identities: [{ id: 'identity', schoolId: 'school-uva', identifierTypeId: 'computing', normalizedIdentifier: 'recipient', userId: null, verifiedAt: null }] })
  const html = renderToStaticMarkup(await h.page({ params: Promise.resolve({ id }) }))
  assert.match(html, /Claim Virginia Venture Fund/); assert.match(html, /data-owner="true"/)
  assert.deepEqual(h.calls.filter(c => /\.(create|update|upsert|delete)|\$transaction|\$queryRaw/.test(c)), [])
  assert.deepEqual(h.authCalls, ['session', 'require'])
  const source = fs.readFileSync('app/(workspace)/invitations/[id]/page.tsx', 'utf8')
  assert.doesNotMatch(source, /clubWriteTransaction|verifiedSchoolIdentities\(|auth\.getUser\(/)
})

test('signed-in invitation GET keeps identity binding: another account or another school sees no invitation', async () => {
  // The university identifier is already bound to a different account: fail closed, nothing written.
  let h = signedInInvitationPage({ configs: [uvaComputing], invitation: ownerInvite, identities: [{ id: 'identity', schoolId: 'school-uva', identifierTypeId: 'computing', normalizedIdentifier: 'recipient', userId: 'someone-else', verifiedAt: new Date() }] })
  await assert.rejects(h.page({ params: Promise.resolve({ id }) }), /manual review/)
  assert.deepEqual(h.calls.filter(c => /\.(create|update|upsert|delete)/.test(c)), [])
  // A different user at the same school: their identity differs, so the invitation is not found.
  h = signedInInvitationPage({ userId: 'intruder', email: 'intruder@virginia.edu', configs: [uvaComputing], invitation: ownerInvite, identities: [{ id: 'identity', schoolId: 'school-uva', identifierTypeId: 'computing', normalizedIdentifier: 'recipient', userId: null, verifiedAt: null }, { id: 'intruder-identity', schoolId: 'school-uva', identifierTypeId: 'computing', normalizedIdentifier: 'intruder', userId: 'intruder', verifiedAt: new Date() }] })
  let html = renderToStaticMarkup(await h.page({ params: Promise.resolve({ id }) }))
  assert.match(html, /Invitation unavailable/); assert.doesNotMatch(html, /invitation-response|Virginia Venture Fund/)
  // Same local part at another school: only that school's identity is considered.
  h = signedInInvitationPage({ userId: 'recipient-other', email: 'recipient@other.edu', configs: [uvaComputing, otherComputing], invitation: ownerInvite, identities: [{ id: 'identity', schoolId: 'school-uva', identifierTypeId: 'computing', normalizedIdentifier: 'recipient', userId: null, verifiedAt: null }, { id: 'other-identity', schoolId: 'school-other', identifierTypeId: 'other-computing', normalizedIdentifier: 'recipient', userId: null, verifiedAt: null }] })
  html = renderToStaticMarkup(await h.page({ params: Promise.resolve({ id }) }))
  assert.match(html, /Invitation unavailable/); assert.doesNotMatch(html, /invitation-response/)
  assert.deepEqual(h.calls.filter(c => /\.(create|update|upsert|delete)/.test(c)), [])
})

test('signed-out club access and club claim links show sign-in cards; access editor data is never read', async () => {
  const preview = { '@/lib/public-link-preview': { clubLinkPreview: async clubId => clubId === 'vvf' ? { name: 'Virginia Venture Fund' } : null } }
  const access = load('app/(workspace)/club-access/[clubId]/page.tsx', { ...preview, '@/utils/auth': { getSessionUser: async () => ({ data: { user: null } }) }, '@/actions/club-access': { getClubAccess: forbidden }, '@/components/club-access-editor': { ClubAccessEditor: () => null } }).default
  let html = renderToStaticMarkup(await access({ params: Promise.resolve({ clubId: 'vvf' }) }))
  assert.match(html, /Sign in to manage access for Virginia Venture Fund/); assert.match(html, /href="\/login\?next=%2Fclub-access%2Fvvf"/); assert.doesNotMatch(html, /\/signup/)
  html = renderToStaticMarkup(await access({ params: Promise.resolve({ clubId: 'missing' }) }))
  assert.match(html, /This club link isn’t valid/)
  const claims = load('app/(workspace)/club-claims/[clubId]/page.tsx', { ...signedOut, ...preview, '@/utils/auth': { requireAuth: forbidden }, '@/utils/prisma': { prisma: new Proxy({}, { get: forbidden }) }, '@/components/claim-form': { ClaimForm: () => null } }).default
  html = renderToStaticMarkup(await claims({ params: Promise.resolve({ clubId: 'vvf' }) }))
  assert.match(html, /Claim Virginia Venture Fund on OutClass/); assert.match(html, /href="\/signup\?next=%2Fclub-claims%2Fvvf"/)
  for (const layout of ['app/(workspace)/invitations/layout.tsx', 'app/(workspace)/club-access/layout.tsx', 'app/(workspace)/club-claims/layout.tsx']) assert.match(fs.readFileSync(layout, 'utf8'), /<AuthenticatedPageLayout optional>/, layout)
})

test('Explore stays private: signed-out visitors are sent to sign-in and the page is not in the sitemap or header', () => {
  const page = fs.readFileSync('app/(workspace)/explore/page.tsx', 'utf8')
  assert.match(page, /robots: privateRobots/); assert.doesNotMatch(page, /signedOut|PublicExplore/)
  assert.match(fs.readFileSync('components/student-workspace-page.tsx', 'utf8'), /if \(!user\) redirect\(`\/login\?next=/)
  assert.equal(fs.existsSync('lib/public-explore.ts'), false)
  assert.doesNotMatch(fs.readFileSync('components/landing/public-navigation.tsx', 'utf8'), /\/explore/)
  assert.doesNotMatch(fs.readFileSync('components/landing/public-footer.tsx', 'utf8'), /\/explore/)
})

test('unknown and expired short links share one unavailable 404 with sentence-case copy and Home / Sign in', async () => {
  const notFound = () => { throw Object.assign(Error('NEXT_NOT_FOUND'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }) }
  for (const status of ['not-found', 'invalid-target', 'expired']) {
    const page = load('app/(focus)/q/[code]/page.tsx', { 'next/navigation': { notFound, redirect: forbidden }, '@/lib/short-link-store': { resolveShortLink: async () => ({ status }) }, '@/utils/prisma': { prisma: {} } }).default
    await assert.rejects(page({ params: Promise.resolve({ code: 'NOPE' }) }), /NEXT_NOT_FOUND/)
  }
  const NotFound = load('app/(focus)/q/[code]/not-found.tsx').default
  const html = renderToStaticMarkup(React.createElement(NotFound))
  assert.match(html, /This link is unavailable/); assert.doesNotMatch(html, /expired code|isn’t recognized/i); assert.match(html, /href="\/"/); assert.match(html, /href="\/login"/)
  assert.equal(fs.existsSync('app/loading.tsx'), false)
})

test('sitemap lists public pages and indexable clubs; robots keeps every private disallow', async () => {
  const sitemap = load('app/sitemap.ts', { '@/lib/public-club-seo': { getIndexableClubs: async () => [{ id: 'club one' }] } }).default
  const urls = (await sitemap()).map(entry => entry.url.replace('https://www.out-class.net', ''))
  for (const url of ['/', '/uva', '/about', '/club/club%20one']) assert.ok(urls.includes(url), url)
  assert.equal(urls.includes('/explore'), false)
  const robots = load('app/robots.ts').default()
  for (const path of ['/api/', '/login', '/signup', '/settings/', '/invitations/', '/club-access/', '/club-claims/', '/club/*/workspace', '/check-in', '/voting/', '/preview']) assert.ok(robots.rules.disallow.includes(path), path)
})
