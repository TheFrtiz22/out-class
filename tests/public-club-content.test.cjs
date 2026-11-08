const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { cleanPublicText, cleanPublicMarketing, presentPublicMarketing } = load('lib/public-club-content.ts')
const { profileStatistics } = load('lib/club-marketing.ts')

const researchPhrases = /Research source|Not published|Not disclosed|employment guarantee|Historical fall or spring evidence|not yet verified|reviewed sources|sources reviewed|No estimate is substituted|An OutClass listing/i

test('broad cleaning removes research sentences and clauses but keeps club content and abbreviations', () => {
  assert.equal(cleanPublicText('Inclusion is independent of recruiting season. Historical fall or spring evidence is not a current opening.'), '')
  assert.equal(cleanPublicText('UVA students; confirm current membership requirements with the club.'), 'UVA students.')
  assert.equal(cleanPublicText('Not published; ask the club.'), '')
  assert.equal(cleanPublicText('Members pitch to J.P. Morgan and St. Anne’s-Belfield. These are historical destinations, not placement guarantees.'), 'Members pitch to J.P. Morgan and St. Anne’s-Belfield.')
  assert.equal(cleanPublicText('Students from all years, per recruitment page copy.'), 'Students from all years.')
})

test('cleaning drops research links, empty sections, hedging FAQs and unknown metrics', () => {
  const m = cleanPublicMarketing({
    links: [{ label: 'Club website', url: 'https://example.org' }, { label: 'Research source 1', url: 'https://example.org/a' }, { label: 'Placement evidence', url: 'https://example.org/b' }],
    sections: [{ title: 'Club-reported scale', kind: 'impact', body: 'The undated homepage reports 46 members. These are website figures, not independently audited current totals.', cards: [] }, { title: 'Programs', kind: 'programs', body: 'Teams of five.', cards: [] }],
    faqs: [{ question: 'What is the acceptance rate?', answer: 'A reliable published club acceptance rate was not found in the reviewed sources. No estimate is substituted.' }, { question: 'Do I need experience?', answer: 'No.' }],
    metrics: [{ label: 'Projects (club website)', value: '282' }, { label: 'Members', value: 'Not disclosed' }],
    commitment: 'Not published; ask the club.', outcomesNote: 'No dates, placement rate or employment guarantee are asserted.', acceptanceSource: 'https://example.org/rate',
  })
  assert.deepEqual(m.links.map(l => l.label), ['Club website'])
  assert.deepEqual(m.sections.map(s => s.title), ['Programs'])
  assert.deepEqual(m.faqs.map(f => f.question), ['Do I need experience?'])
  assert.deepEqual(m.metrics, [{ label: 'Projects', value: '282' }])
  assert.equal(m.commitment, ''); assert.equal(m.outcomesNote, ''); assert.equal(m.acceptanceSource, '')
})

test('render-time presentation hides placeholders and package boilerplate without touching leader prose', () => {
  const leader = 'We study historical preservation and verified archives. Not every project is guaranteed funding.'
  const m = presentPublicMarketing({
    sections: [{ title: 'Recruitment', kind: 'recruitment', visible: true, body: 'Inclusion is independent of recruiting season. Historical fall or spring evidence is not a current opening.', cards: [] }, { title: 'About', kind: 'about', visible: true, body: leader, cards: [] }],
    faqs: [{ question: 'How do I learn more?', answer: 'Use the official website and links on this profile. An OutClass listing does not mean native applications are open.' }],
    links: [{ label: 'Research source 2', url: 'https://example.org' }],
    commitment: 'Not publicly published in the sources reviewed.', dues: 'Not published; ask the club.', eligibility: 'UVA students; confirm current membership requirements with the club.',
    outcomesNote: 'Selected firms. No dates, placement rate or employment guarantee are asserted.', acceptanceSource: 'https://example.org/rate',
  })
  assert.deepEqual(m.sections.map(s => s.body), [leader])
  assert.equal(m.faqs.length, 0); assert.equal(m.links.length, 0)
  assert.equal(m.commitment, ''); assert.equal(m.dues, ''); assert.equal(m.eligibility, 'UVA students.')
  assert.equal(m.outcomesNote, ''); assert.equal(m.acceptanceSource, '')
})

test('statistics never print unknown values or link to sources, and are labelled club-reported', () => {
  assert.equal(profileStatistics({ acceptanceRate: null, marketing: { showAcceptance: true, acceptanceNote: 'No verified published club acceptance rate.' } }).length, 0)
  const [rate] = profileStatistics({ acceptanceRate: 12, marketing: { acceptanceNote: 'No verified club-published rate found', acceptanceSource: 'https://example.org' } })
  assert.deepEqual(rate, { label: 'Club acceptance', value: '12%', detail: 'Club-reported' })
  const [cohort] = profileStatistics({ acceptanceRate: 3, marketing: { acceptanceNote: 'Spring 2026 · club-reported' } })
  assert.equal(cohort.detail, 'Spring 2026 · club-reported')
  assert.equal(profileStatistics({ marketing: { metrics: [{ label: 'Members', value: 'Not disclosed' }] } }).length, 0)
})

test('reviewed import packages carry no research notes or source links in public fields', () => {
  for (const file of ['profiles.json', 'commerce-expansion.json']) {
    const data = JSON.parse(fs.readFileSync(`docs/club-profile-design/${file}`, 'utf8'))
    for (const row of data.profiles) {
      const publicFields = JSON.stringify({ tagline: row.profile.tagline, description: row.profile.description, marketing: row.profile.marketing })
      assert.doesNotMatch(publicFields, researchPhrases, `${file} ${row.key}`)
      assert.equal(row.profile.marketing.acceptanceSource, '', `${file} ${row.key}`)
      assert.equal(row.profile.marketing.outcomesNote, '', `${file} ${row.key}`)
    }
  }
})

test('public club page: no logo wall, no unknown tiles, Follow instead of a device-only Subscribe', () => {
  const profile = fs.readFileSync('components/clubs/marketing-profile.tsx', 'utf8')
  const view = fs.readFileSync('components/views/club-profile-view.tsx', 'utf8')
  assert.doesNotMatch(profile, /Research source/)
  assert.match(profile, /Club-reported/)
  // Logos are hidden for now, not deleted: the switch is off and the list renders names only.
  assert.match(fs.readFileSync('lib/employer-marks.ts', 'utf8'), /export const SHOW_EMPLOYER_MARKS = false/)
  assert.match(profile, /SHOW_EMPLOYER_MARKS \? employerMark\(name\) : undefined/)
  assert.equal(fs.existsSync('components/clubs/subscribe-button.tsx'), false)
  assert.doesNotMatch(view, /Applications unavailable|email updates not yet available|Recruitment dates have not been published|No additional requirements have been published|No upcoming public events have been published/)
  assert.match(view, /Applications aren’t open yet · Follow/)
  // Visitor order: hero/action, about, what members do, recruitment, life, FAQ, events.
  const order = ['<MarketingProfile', '<AboutSection', '<MembersSection', 'id="club-recruitment"', '<LifeSection', '<FaqSection', 'id="club-events"'].map(token => view.indexOf(token))
  assert.ok(order.every(i => i > 0)); assert.deepEqual([...order].sort((a, b) => a - b), order)
  // Real clubs do not wait for device customization, so server HTML includes the h1.
  assert.match(view, /if \(!ready && !real\) return <LoadingState/)
})

test('content-fix apply writes only the reviewed plan and skips rows edited since the dry run', () => {
  const script = fs.readFileSync('scripts/clean-public-club-profiles.cjs', 'utf8')
  assert.match(script, /if \(!args\.plan\) throw Error\('--apply needs --plan=/)
  assert.match(script, /reviewed\.database !== database/)
  // Compare-and-set against the plan's reviewed `before`, then write the plan's reviewed `after`.
  assert.match(script, /current\.description !== item\.before\.description/)
  assert.match(script, /data: \{ tagline: item\.after\.tagline, description: item\.after\.description, marketing: item\.after\.marketing \}/)
  assert.doesNotMatch(script.slice(script.indexOf("if (!args.plan)")), /cleanPublicProfile\(/, 'apply never recomputes the cleanup')
})

test('editor and import previews include the About section (about sections, video, links)', () => {
  for (const file of ['components/clubs/club-profile-editor.tsx', 'components/admin/admin-club-import.tsx']) assert.match(fs.readFileSync(file, 'utf8'), /<AboutSection [^>]*profile=/, file)
})
