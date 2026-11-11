const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const read = file => fs.readFileSync(file, 'utf8')
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : ''

/** Renders a client component with stub hooks; @/components/ui/* become named placeholder types. */
function harness(file, mocks) {
  const state = [], effects = []; let cursor = 0
  const react = {
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
    useRef: initial => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
    useEffect: (effect, deps) => { const i = cursor++; if (!state[i] || deps.some((v, j) => v !== state[i][j])) { state[i] = deps; effects.push(effect) } },
    useId: () => 'picker',
  }
  const cache = {}
  function load(target) {
    target = path.resolve(target); if (cache[target]) return cache[target].exports
    const mod = { exports: {} }; cache[target] = mod
    const out = ts.transpileModule(read(target), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
    new Function('require', 'module', 'exports', out)(name => {
      if (name === 'react') return react
      if (name in mocks) return mocks[name]
      if (name.startsWith('@/components/ui/') || name.startsWith('@/components/clubs/')) return new Proxy({}, { get: (_, key) => key })
      if (name.startsWith('./')) return load(path.join(path.dirname(target), name.slice(2) + '.tsx'))
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts')
      return require(name)
    }, mod, mod.exports)
    return mod.exports
  }
  const exported = load(file)
  return { exported, render: (Component, props) => { cursor = 0; return Component(props) }, flush: async () => { while (effects.length) effects.shift()(); await new Promise(r => setTimeout(r, 0)) } }
}

test('platform nav lists each destination once and the retired Activity link resolves to Audit Log', () => {
  const nav = read('lib/admin-navigation.ts')
  const { adminNavigation, adminSectionId } = (() => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(nav, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, m, m.exports); return m.exports })()
  for (const key of ['id', 'href', 'label']) assert.equal(new Set(adminNavigation.map(i => i[key])).size, adminNavigation.length, `duplicate nav ${key}`)
  assert.ok(!adminNavigation.some(i => i.id === 'activity'))
  assert.equal(adminSectionId('activity'), 'audit')
  assert.equal(adminSectionId('clubs'), 'clubs')
  const page = read('app/(workspace)/platform/[section]/page.tsx')
  assert.match(page, /adminSectionId\(/)
  assert.match(page, /section === "audit" \? <><AdminDirectory resource="audit" \/>.*view-sessions/)
  assert.match(read('components/shell/workspace-shell.tsx'), /adminSectionId\(pathname/)
})

test('CSV import offers a school picker with several schools and passes the chosen school to the import action', async () => {
  const calls = { search: [], run: [] }
  const row = { slug: 'debate', profile: { name: 'Debate' } }
  const h = harness('components/admin/admin-club-import.tsx', {
    '@/actions/admin-clubs': { getAdminClubs: async q => { calls.search.push(q); return { rows: [] } }, getAdminClub: async () => ({}), saveAdminClub: async () => ({}) },
    '@/actions/club-assets': { uploadClubAsset: async () => ({}) },
    '@/lib/club-profile-import': { clubProfileImportSchema: { parse: v => v }, importImageNames: () => [], runClubProfileImport: async (plan, images, schoolId, reason) => { calls.run.push({ schoolId, reason, rows: plan.length }) } },
  })
  const schools = [{ id: 'school-uva', name: 'University of Virginia' }, { id: 'school-vt', name: 'Virginia Tech' }]
  const props = { schools, onComplete() {} }
  let tree = nodes(h.render(h.exported.AdminClubImport, props))
  const select = tree.find(n => n.type === 'NativeSelect')
  assert.ok(select, 'school picker rendered when more than one school exists')
  assert.deepEqual(nodes(select.props.children).filter(n => n.type === 'option' && n.props.value).map(n => n.props.value), ['school-uva', 'school-vt'])
  const jsonInput = () => nodes(h.render(h.exported.AdminClubImport, props)).find(n => n.type === 'Input' && n.props.accept?.includes('json'))
  assert.equal(jsonInput().props.disabled, true, 'package cannot be chosen before a school')

  select.props.onChange({ target: { value: 'school-vt' } })
  const file = { size: 10, text: async () => JSON.stringify({ profiles: [row] }) }
  const input = jsonInput(); assert.equal(input.props.disabled, false)
  input.props.onChange({ target: { files: [file], value: 'x' } })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.search.length, 1)
  tree = nodes(h.render(h.exported.AdminClubImport, props))
  tree.find(n => n.type === 'Input' && n.props.maxLength === 1000).props.onChange({ target: { value: 'Approved researched import' } })
  tree = nodes(h.render(h.exported.AdminClubImport, props))
  const publish = tree.find(n => n.type === 'Button' && text(n).startsWith('Publish'))
  assert.equal(publish.props.disabled, false)
  publish.props.onClick(); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(calls.run, [{ schoolId: 'school-vt', reason: 'Approved researched import', rows: 1 }])
})

test('a single school needs no picker and is preselected', () => {
  const h = harness('components/admin/admin-club-import.tsx', { '@/actions/admin-clubs': {}, '@/actions/club-assets': {}, '@/lib/club-profile-import': { importImageNames: () => [] } })
  const tree = nodes(h.render(h.exported.AdminClubImport, { schools: [{ id: 'school-uva', name: 'University of Virginia' }], onComplete() {} }))
  assert.ok(!tree.some(n => n.type === 'NativeSelect'))
  assert.equal(tree.find(n => n.type === 'Input' && n.props.accept?.includes('json')).props.disabled, false)
  assert.match(read('components/admin/admin-clubs.tsx'), /data\.schools\.length>0&&<AdminClubImport schools=\{data\.schools\}/)
})

test('onboarding forms use searchable club and invitation pickers instead of raw-ID inputs', async () => {
  const source = read('components/admin/admin-onboarding.tsx')
  assert.doesNotMatch(source, /Club ID|Pending invitation ID|clubId: ""|studentField\("clubId"/)
  assert.equal((source.match(/<AdminClubPicker /g) || []).length, 2)
  const sent = [], clubs = []
  const h = harness('components/admin/admin-onboarding.tsx', {
    '@/actions/admin-workspace': { createAdminStudent: async () => {}, createAdminClub: async () => {}, changeAdminDesignatedLeader: async d => { sent.push(d) }, listAdminPendingOwnerInvitations: async id => { clubs.push(id); return [{ id: 'inv-1', email: 'old@virginia.edu', invitedName: 'Old Lead', expiresAt: '2026-12-01T00:00:00Z' }] } },
    '@/actions/platform-organization-onboarding': { getOrganizationOnboardingSchools: async () => [{ identifierTypeId: 'school-uva-computing-id', schoolName: 'University of Virginia', identifierLabel: 'UVA Computing ID' }] },
    '@/actions/admin-clubs': { getAdminClubs: async () => ({ rows: [] }) },
  })
  globalThis.crypto ??= require('node:crypto').webcrypto
  const draw = () => nodes(h.render(h.exported.AdminOnboarding, {}))
  draw(); await h.flush()
  draw().find(n => n.type === 'Button' && text(n) === 'Change designated leader').props.onClick()
  let tree = draw()
  const picker = tree.find(n => n.props?.label === 'Club')
  assert.ok(picker, 'leader form uses the club picker')
  assert.doesNotMatch(text(tree[0]), /Club ID|invitation ID/)
  picker.props.onChange({ id: '00000000-0000-4000-8000-000000000009', name: 'Debate Society', schoolName: 'University of Virginia' })
  draw(); await h.flush(); tree = draw()
  assert.deepEqual(clubs, ['00000000-0000-4000-8000-000000000009'])
  const invitation = tree.find(n => n.type === 'NativeSelect' && n.props.value === 'inv-1')
  assert.ok(invitation, 'the only pending owner invitation is preselected from the server read')
  assert.match(text(invitation.props.children), /Old Lead · old@virginia\.edu/)
})

test('pending owner invitation read requires fresh platform admin and returns only replaceable invitations', async () => {
  let query, checked
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read('actions/admin-workspace.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => ({
    'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/prisma': { prisma: { clubInvitation: { findMany: async q => { query = q; return [] } } } },
    '@/utils/platform-admin': { requirePlatformAdmin: async o => { checked = o; if (!o?.fresh) throw Error('not fresh'); return { id: 'actor' } } },
  })[name] ?? (name.startsWith('@/') ? {} : require(name)), mod, mod.exports)
  const api = mod.exports
  await assert.rejects(api.listAdminPendingOwnerInvitations('not-a-uuid'))
  assert.equal(query, undefined)
  await api.listAdminPendingOwnerInvitations('00000000-0000-4000-8000-000000000009')
  assert.equal(checked.fresh, true)
  assert.deepEqual(query.where, { clubId: '00000000-0000-4000-8000-000000000009', status: 'PENDING', requestedRole: 'OWNER', authoritySource: 'PLATFORM_ADMIN' })
  assert.deepEqual(Object.keys(query.select).sort(), ['email', 'expiresAt', 'id', 'invitedName'])
})

test('saveAdminClub (the import action) rejects a school outside the admin scope before writing', async () => {
  const load = (file, mocks) => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.slice(2) + '.ts', mocks) : require(n), m, m.exports); return m.exports }
  const { profileDraft } = load('lib/club-marketing.ts', {})
  for (const school of [null, { id: 'school-closed', key: 'closed', active: false }, { id: 'school-vt', key: 'vt', active: true }]) {
    const writes = []
    const tx = { $queryRaw: async () => [], club: { create: async ({ data }) => { writes.push(data); return { id: 'new-club' } } }, school: { findUnique: async ({ where }) => school && where.id === school.id ? school : null }, auditLog: { create: async () => writes.push('audit') } }
    const api = load('actions/admin-clubs.ts', {
      '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class {} } }, '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
      '@/utils/platform-admin': { requirePlatformAdmin: async () => ({ id: 'admin' }) }, '@/utils/admin-transaction': { authorizeAdminTransaction: async () => {} },
      '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} }, '@/utils/admin-page': { adminPageLoad: async () => ({}), logAdminFailure: () => 'ADMIN-TEST' },
      'next/navigation': { redirect: () => { throw Error('Redirect') } }, 'next/cache': { revalidateTag() {}, revalidatePath() {} },
    })
    const r = await api.saveAdminClub({ slug: 'new-club', schoolId: school?.id || 'school-unknown', isDiscoverable: false, applicationOpen: false, applicationDeadline: null, profile: profileDraft({ name: 'New Club' }), reason: 'Approved researched import' })
    if (school?.active) { assert.equal(r.id, 'new-club'); assert.equal(writes[0].schoolId, 'school-vt') }
    else { assert.match(r.error, /School\/campus/); assert.deepEqual(writes, []) }
  }
})
