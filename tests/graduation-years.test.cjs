// Graduation years are relative to the Eastern calendar year, so next fall's incoming
// class can always sign up and the range never needs a hand edit.
const { test, mock } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports)
  return mod.exports
}
const years = load('lib/graduation-years.ts')
const { academicProfileSchema } = load('lib/onboarding-schemas.ts')
const { profileSectionSchema } = load('lib/student-profile.ts')
const { invitationProfileDefaults } = load('lib/organization-claiming.ts')
const { validateRosterRows } = load('lib/roster-csv.ts')

const NOV_2026 = new Date('2026-11-12T15:00:00Z')
const MAR_2027 = new Date('2027-03-01T15:00:00Z')
// 11:30 PM Eastern on Dec 31, 2026 is already 2027 in UTC; Eastern still says 2026.
const LATE_DEC_2026 = new Date('2027-01-01T04:30:00Z')
const NEW_YEAR_2027 = new Date('2027-01-01T05:30:00Z') // 12:30 AM Eastern, Jan 1 2027

test('range is last year through six years ahead, by the Eastern calendar year', () => {
  assert.deepEqual(years.graduationYearRange(NOV_2026), { min: 2025, max: 2032 })
  assert.deepEqual(years.graduationYearRange(MAR_2027), { min: 2026, max: 2033 })
  assert.deepEqual(years.graduationYearRange(LATE_DEC_2026), { min: 2025, max: 2032 })
  assert.deepEqual(years.graduationYearRange(NEW_YEAR_2027), { min: 2026, max: 2033 })
  assert.deepEqual(years.graduationYearOptions(NOV_2026), ['2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032'])
})

test('2031 (next fall\'s incoming class) is accepted now, and the edges move each year', () => {
  assert.equal(years.isSupportedGraduationYear(2031, NOV_2026), true)
  assert.equal(years.isSupportedGraduationYear('2031', NOV_2026), true)
  assert.equal(years.isSupportedGraduationYear(2033, NOV_2026), false)
  assert.equal(years.isSupportedGraduationYear(2033, MAR_2027), true)
  assert.equal(years.isSupportedGraduationYear(2025, NOV_2026), true)
  assert.equal(years.isSupportedGraduationYear(2025, MAR_2027), false)
  assert.equal(years.isSupportedGraduationYear(2025, LATE_DEC_2026), true)
  assert.equal(years.isSupportedGraduationYear(2025, NEW_YEAR_2027), false)
  for (const bad of ['', ' ', '20311', '2031.5', 'abc', NaN, 2031.5]) assert.equal(years.isSupportedGraduationYear(bad, NOV_2026), false, String(bad))
  assert.equal(years.graduationYearMessage(NOV_2026), 'Choose a graduation year between 2025 and 2032')
})

test('client and server schemas share the rule and use the clock at parse time', (t) => {
  t.after(() => mock.timers.reset())
  mock.timers.enable({ apis: ['Date'], now: NOV_2026.getTime() })
  const education = gradYear => profileSectionSchema.safeParse({ section: 'education', major: 'Math', gradYear, satScore: null })
  assert.equal(academicProfileSchema.safeParse({ gradYear: '2031', major: 'Math' }).success, true)
  assert.equal(education(2031).success, true)
  const rejected = academicProfileSchema.safeParse({ gradYear: '2033', major: 'Math' })
  assert.equal(rejected.success, false)
  assert.deepEqual(rejected.error.issues.map(i => i.message), ['Choose a graduation year between 2025 and 2032'])
  assert.equal(education(2033).error.issues.find(i => i.path[0] === 'gradYear').message, 'Choose a graduation year between 2025 and 2032')
  assert.deepEqual(academicProfileSchema.safeParse({ gradYear: '', major: 'Math' }).error.issues.map(i => i.message), ['Graduation year is required'])

  mock.timers.setTime(MAR_2027.getTime()) // same schema instances, a year later
  assert.equal(academicProfileSchema.safeParse({ gradYear: '2033', major: 'Math' }).success, true)
  assert.equal(education(2033).success, true)
  assert.equal(education(2025).success, false)
})

test('invitation suggestions and roster import follow the same range', (t) => {
  t.after(() => mock.timers.reset())
  mock.timers.enable({ apis: ['Date'], now: NOV_2026.getTime() })
  assert.equal(invitationProfileDefaults([{ requestedRole: 'MEMBER', invitedName: 'Sarah Lee', invitedYear: '2031' }]).gradYear, '2031')
  assert.equal(invitationProfileDefaults([{ requestedRole: 'MEMBER', invitedName: 'Sarah Lee', invitedYear: '2040' }]).gradYear, '')
  const config = { normalization: 'TRIM_LOWERCASE', validationRegex: null }
  const [ok, bad] = validateRosterRows([{ name: 'A', year: '2031', computing_id: 'ab1cd' }, { name: 'B', year: '2040', computing_id: 'ef2gh' }], config)
  assert.equal(ok.status, 'READY')
  assert.deepEqual(bad.errors, ['Unsupported year; use 2025–2032 or leave blank'])
})

test('no hardcoded graduation-year lists remain in the touched surfaces', () => {
  for (const file of ['components/views/student-onboarding-wizard.tsx', 'components/organization-member-management.tsx', 'components/edit-student-profile-dialog.tsx', 'components/roster-csv-importer.tsx', 'actions/profile.ts', 'actions/organization-members.ts', 'lib/student-profile.ts', 'lib/onboarding-schemas.ts', 'lib/organization-claiming.ts', 'lib/roster-csv.ts']) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
    assert.doesNotMatch(source, /20(2[0-9]|30)[\s,"'\]]*(,|–|-|\.\.)\s*["']?20(2[0-9]|30)\b|min\(2020\)|max\(2030\)|202\[5-9\]/, file)
  }
  assert.match(fs.readFileSync(path.resolve(__dirname, '..', 'actions/profile.ts'), 'utf8'), /gradYear: graduationYearSchema/)
  assert.match(fs.readFileSync(path.resolve(__dirname, '..', 'actions/organization-members.ts'), 'utf8'), /invitedYear: z\.string\(\)\.refine\(year => isSupportedGraduationYear\(year\)/)
})
