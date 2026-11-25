// A club with intake switched off showed "Applications unavailable" beside "Deadline · Dec 1", which read as an open
// window. The deadline now shows only while applications are open or to say they closed, and a closed club's profile
// says "Applications have closed" after its deadline rather than "aren't open yet".
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(n => n === '@/lib/scheduling-config' ? { SCHEDULING_TIMEZONE_LABEL: 'ET', schedulingDateTime: String } : require(n), mod, mod.exports)
  return mod.exports
}
const now = Date.parse('2026-11-25T12:00:00Z'), future = '2026-12-01T12:00:00Z', past = '2026-11-01T12:00:00Z'

test('the deadline shows only while open or once passed', () => {
  const { clubRecruitment } = load('lib/recruitment-presentation.ts')
  const off = clubRecruitment({ applicationAvailable: false, applicationDeadline: future }, now)
  assert.equal(off.label, 'Applications unavailable')
  assert.equal(off.showDeadline, false)
  assert.equal(clubRecruitment({ applicationAvailable: true, applicationDeadline: future }, now).showDeadline, true)
  assert.equal(clubRecruitment({ applicationAvailable: false, applicationDeadline: past }, now).showDeadline, true)
})

test('the directory card and the club page follow it', () => {
  const card = fs.readFileSync(path.join(root, 'components/clubs/discovery-card.tsx'), 'utf8')
  assert.match(card, /recruitment\.showDeadline && \(recruitment\.deadline \?/)
  const profile = fs.readFileSync(path.join(root, 'components/views/club-profile-view.tsx'), 'utf8')
  assert.match(profile, /recruitment\.expired \? "Applications have closed" : "Applications aren’t open yet"/)
})
