// Club-interest survey: answer schema (known ids only, at most six interests), chips that map to real
// directory categories, owner-only actions with an optimistic revision, support sessions locked out,
// and privacy: no club, applicant, export, search or support projection reads the answers.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function loader(mocks = {}) {
  const cache = new Map()
  const resolve = name => ['.ts', '.tsx'].map(ext => name + ext).find(file => fs.existsSync(path.join(root, file))) ?? name + '.ts'
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve(name.slice(2))) : require(name), mod, mod.exports)
    return mod.exports
  }
  return load
}
const survey = loader()('lib/interest-survey.ts')
const { surveyOptionMatches } = loader()('lib/club-suggestions.ts')

test('answers schema accepts known ids only, at most six interests, no duplicates, no extra fields', () => {
  const ok = { interests: ['consulting', 'tech'], goals: ['career', 'service'], weeklyHours: '3-5', selectivity: 'either', revision: 0 }
  assert.deepEqual(survey.interestSurveySaveSchema.parse(ok), ok)
  assert.deepEqual(survey.interestSurveySaveSchema.parse({ interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 3 }).revision, 3)
  const bad = patch => assert.throws(() => survey.interestSurveySaveSchema.parse({ ...ok, ...patch }), JSON.stringify(patch))
  bad({ interests: ['consulting', 'knitting'] })
  bad({ interests: ['Consulting'] })
  bad({ interests: survey.INTEREST_CHIPS.slice(0, 7).map(chip => chip.id) })
  bad({ interests: ['tech', 'tech'] })
  bad({ goals: ['fame'] })
  bad({ weeklyHours: '10+' })
  bad({ selectivity: 'maybe' })
  bad({ revision: -1 })
  bad({ userId: 'someone-else' })
  assert.equal(survey.INTEREST_CHIPS.length >= 6, true)
  assert.equal(new Set(survey.INTEREST_CHIPS.map(chip => chip.id)).size, survey.INTEREST_CHIPS.length, 'stable unique ids')
  for (const chip of survey.INTEREST_CHIPS) assert.match(chip.id, /^[a-z][a-z0-9-]{0,39}$/, 'ids fit the database check')
  assert.deepEqual(survey.CLUB_GOALS.map(goal => goal.label), ['Career', 'Community and friends', 'Service', 'Creative outlet', 'Competition', 'Leadership'])
  assert.deepEqual(survey.WEEKLY_HOURS.map(option => option.id), ['1-2', '3-5', '6+'])
  assert.deepEqual(survey.SELECTIVITY.map(option => option.label), ['Yes', 'No', 'Either'])
})

test('stored rows are read through the vocabulary: retired ids are dropped', () => {
  assert.deepEqual(survey.readInterestAnswers({ interests: ['tech', 'retired', 'tech'], goals: ['career', 'x'], weeklyHours: '9', selectivity: 'no' }),
    { interests: ['tech'], goals: ['career'], weeklyHours: null, selectivity: 'no' })
  assert.deepEqual(survey.readInterestAnswers(null), survey.emptyInterestAnswers)
})

test('every interest chip and goal maps to at least one real public directory category', () => {
  // lib/data.ts clubCategories (profile editor), the Club.category default, the seeded directory
  // entries and categories leaders use in fixtures.
  const data = read('lib/data.ts')
  const editor = [...data.match(/export const clubCategories[^=]*=\s*\[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1])
  assert.ok(editor.includes('Consulting') && editor.length >= 6)
  assert.match(read('prisma/schema.prisma'), /category\s+String\s+@default\("Social"\)/)
  const categories = [...editor, 'Social', 'Academic', 'Arts', 'Business', 'Finance']
  for (const option of [...survey.INTEREST_CHIPS, ...survey.CLUB_GOALS.filter(goal => goal.id !== 'leadership')]) {
    const hits = categories.filter(category => surveyOptionMatches(option, { category, tags: [] }))
    assert.ok(hits.length, `${option.id} maps to a directory category`)
  }
  // No category describes leadership yet; it matches clubs whose category or tags name it, and is otherwise stored only.
  assert.deepEqual(categories.filter(category => surveyOptionMatches(survey.CLUB_GOALS.find(g => g.id === 'leadership'), { category, tags: [] })), [])
})

const VIEW = { id: 'admin-view', targetUserId: 'alice' }
function harness({ impersonation = null, rows = {} } = {}) {
  const writes = []
  const prisma = {
    studentInterestProfile: {
      findUnique: async ({ where }) => rows[where.userId] ?? null,
      upsert: async ({ where, create, update }) => {
        writes.push(where.userId)
        const old = rows[where.userId]
        const next = old ? { ...old, ...update, revision: update.revision?.increment ? old.revision + update.revision.increment : old.revision } : { interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 0, completedAt: null, dismissedAt: null, ...create }
        rows[where.userId] = next
        return next
      },
    },
  }
  prisma.$transaction = async fn => fn({ ...prisma, $queryRaw: async () => [] })
  const load = loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'alice' }, impersonation }) },
    '@/utils/prisma': { prisma },
  })
  return { ...load('actions/interest-survey.ts'), rows, writes }
}
const answers = { interests: ['consulting'], goals: ['career'], weeklyHours: '1-2', selectivity: 'yes' }

test('save writes only the caller’s own row, bumps the revision and refuses a stale one', async () => {
  const h = harness({ rows: { bob: { interests: ['arts'], goals: [], weeklyHours: null, selectivity: null, revision: 4, completedAt: new Date(), dismissedAt: null } } })
  const first = await h.saveMyInterestSurvey({ ...answers, revision: 0 })
  assert.equal(first.ok, true)
  assert.deepEqual({ ...first.data }, { ...answers, revision: 1, completed: true, dismissed: false })
  assert.deepEqual(h.writes, ['alice'])
  const stale = await h.saveMyInterestSurvey({ ...answers, revision: 0 })
  assert.deepEqual([stale.ok, stale.code], [false, 'STALE'])
  // Naming another account is refused by the schema; nothing else can choose the row.
  await assert.rejects(h.saveMyInterestSurvey({ ...answers, revision: 1, userId: 'bob' }), /unrecognized_keys|Unrecognized/)
  await assert.rejects(h.saveMyInterestSurvey({ ...answers, interests: ['consulting', 'unknown'], revision: 1 }))
  await assert.rejects(h.saveMyInterestSurvey({ ...answers, interests: survey.INTEREST_CHIPS.slice(0, 7).map(c => c.id), revision: 1 }))
  assert.deepEqual(h.rows.bob.interests, ['arts'], 'another student’s row is untouched')
  assert.deepEqual(h.writes, ['alice'])
  const cleared = await h.saveMyInterestSurvey({ interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 1 })
  assert.deepEqual([cleared.data.completed, cleared.data.dismissed, cleared.data.revision], [false, true, 2], 'clearing retires the Home prompt')
})

test('dismissing the Home prompt keeps answers and revision; reads return the caller’s own row', async () => {
  const h = harness()
  assert.deepEqual(await h.getMyInterestSurvey(), { ...survey.emptyInterestAnswers, revision: 0, completed: false, dismissed: false })
  const dismissed = await h.dismissInterestSurveyPrompt()
  assert.deepEqual([dismissed.data.dismissed, dismissed.data.revision], [true, 0], 'a dismissal never makes an open form stale')
  assert.equal((await h.saveMyInterestSurvey({ ...answers, revision: 0 })).ok, true)
})

test('support (view-as) sessions never see or change the answers', async () => {
  const h = harness({ impersonation: VIEW, rows: { alice: { interests: ['tech'], goals: [], weeklyHours: null, selectivity: null, revision: 1, completedAt: new Date(), dismissedAt: null } } })
  assert.equal(await h.getMyInterestSurvey(), null)
  for (const result of [await h.saveMyInterestSurvey({ ...answers, revision: 1 }), await h.dismissInterestSurveyPrompt()]) assert.deepEqual([result.ok, result.code], [false, 'FORBIDDEN'])
  assert.deepEqual(h.writes, [])
  const page = read('app/(workspace)/settings/interests/page.tsx')
  assert.match(page, /if \(impersonation\) return/)
  const hook = read('hooks/use-interest-survey.ts')
  assert.match(hook, /enabled = !!userId && !isImpersonating && !demo\.isDemoEnabled/)
})

test('privacy: only the owner’s actions and account deletion touch the table; no club, applicant, export, search or admin projection', () => {
  const allowed = new Set(['actions/interest-survey.ts', 'utils/account-deletion.ts'])
  const offenders = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(rel)
    else if (/\.(ts|tsx|cjs|mjs|js)$/.test(entry.name) && /studentInterestProfile|StudentInterestProfile|interestProfile/.test(fs.readFileSync(path.join(root, rel), 'utf8')) && !allowed.has(rel)) offenders.push(rel)
  } }
  for (const dir of ['actions', 'app', 'components', 'lib', 'utils', 'hooks', 'contexts', 'scripts']) walk(dir)
  // lib/account-deletion.ts names the relation in the deletion plan only.
  assert.deepEqual(offenders, ['lib/account-deletion.ts'])
  // Shared account, applicant and club projections select explicit fields; none names the relation.
  for (const file of ['lib/account-data.ts', 'actions/club-directory.ts', 'scripts/sync-typesense-public-clubs.cjs']) assert.doesNotMatch(read(file), /interest(Profile|s:)/i, file)
  // Suggestions read public directory fields only.
  assert.doesNotMatch(read('lib/club-suggestions.ts'), /prisma|fetch\(|actions\//)
})

test('privacy policy, deletion plan and settings describe the survey', () => {
  const { privacyPolicy } = loader({ '@/lib/seo': { LEGAL_ORGANIZATION_NAME: 'OutClassPlatforms LLC' } })('lib/legal-content.ts')
  assert.ok(privacyPolicy.sections[1].list.includes('Optional interests you choose in the club-interest survey, used only to suggest clubs to you; clubs cannot see them.'))
  const { userRelationDeletionPlan } = loader()('lib/account-deletion.ts')
  assert.deepEqual({ ...userRelationDeletionPlan.interestProfile, note: undefined }, { model: 'StudentInterestProfile', onDelete: 'Cascade', treatment: 'delete', note: undefined })
  assert.match(read('utils/account-deletion.ts'), /tx\.studentInterestProfile\.deleteMany\(\{ where: \{ userId \} \}\)/)
  const nav = loader()('lib/settings-navigation.ts')
  assert.equal(nav.personalSettingsSectionFor('/settings/interests').label, 'Interests')
  assert.ok(!nav.visiblePersonalSettingsSections(true).some(s => s.id === 'interests'), 'hidden in Demo Mode')
})

test('onboarding ends with the optional survey step; Home shows the one-time prompt', () => {
  const wizard = read('components/views/student-onboarding-wizard.tsx')
  assert.match(wizard, /\{ label: "Interests", icon: Compass \}/)
  assert.match(wizard, /setStep\(5\)/)
  assert.match(wizard, /const InterestSurveyForm = dynamic\(/, 'the survey loads in its own chunk')
  assert.match(wizard, /Skip for now/)
  const home = read('components/views/student-dashboard-view.tsx')
  assert.match(home, /<InterestSurveyPrompt \/>/)
  const prompt = read('components/interests/interest-survey-prompt.tsx')
  assert.match(prompt, /survey\.completed \|\| survey\.dismissed/)
  assert.match(prompt, /aria-label="Dismiss"/)
})
