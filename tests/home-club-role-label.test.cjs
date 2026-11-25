// Home › My Clubs labelled each club from the legacy `role` column (PRESIDENT / RECRUITMENT_LEAD / else "Member"),
// so a club's owner read "Member" on Home while My Clubs and Members said "Owner". Seen live in the QA club.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'components/views/student-dashboard-view.tsx'), 'utf8')
const mod = { exports: {} }
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'lib/copy/terms.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, mod, mod.exports)
const { membershipRoleLabel } = mod.exports

test('Home club tiles use the same role label as My Clubs and Members', () => {
  const tile = source.slice(source.indexOf('oc-home-club-tile'), source.indexOf('</a></li>)}</ul>', source.indexOf('oc-home-club-tile')))
  assert.match(tile, /<small>\{membershipRoleLabel\(m\)\}<\/small>/)
  assert.doesNotMatch(tile, /PRESIDENT|RECRUITMENT_LEAD/, 'the legacy role column no longer decides the label')
})

test('the shared label reads an owner as Owner, whatever the legacy role says', () => {
  assert.equal(membershipRoleLabel({ isOwner: true, accessRole: 'MEMBER', role: 'MEMBER' }), 'Owner')
  assert.equal(membershipRoleLabel({ isOwner: false, accessRole: 'INTERVIEWER' }), 'Interviewer')
  assert.equal(membershipRoleLabel({ isOwner: false, accessRole: 'RECRUITING_ADMIN' }), 'Recruiting Lead')
  assert.equal(membershipRoleLabel({ isOwner: false, accessRole: null }), 'Member')
})
