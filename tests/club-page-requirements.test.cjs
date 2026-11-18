const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const view=fs.readFileSync('components/views/club-profile-view.tsx','utf8')

test('the Standardized tests line appears only when a club requires tests',()=>{
  assert.match(view,/const testsRequired = !!club\.testRequirement && club\.testRequirement !== "OPTIONAL"/)
  assert.match(view,/const showRequirements = real && \(testsRequired \|\|/,'"optional" alone does not open Before you apply')
  assert.match(view,/\{testsRequired && <p className="oc-club-prose">Standardized tests: \{testRequirementLabels\[/)
  assert.doesNotMatch(view,/SAT and ACT optional|replaceAll\("_", " "\)/)
})

test('club pages links show only to members, and the old "Meetings, agendas and recaps" label is gone',()=>{
  assert.doesNotMatch(view,/Meetings, agendas and recaps/)
  assert.match(view,/<AboutSection profile=\{publicProfile\}>\s*\{user\?\.memberships\.some\(m => m\.clubId === club\.id\) && <nav aria-label="Club pages"/)
})
