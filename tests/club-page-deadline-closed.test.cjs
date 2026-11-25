const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const view=fs.readFileSync('components/views/club-profile-view.tsx','utf8')

test('a real club whose applications are not open does not show a future deadline beside "Applications aren’t open yet"',()=>{
  assert.match(view,/const deadlineText = recruitment\.deadline && \(!real \|\| recruitment\.showDeadline \|\| !!application\)/)
})

test('showDeadline stays false for a future deadline while intake is off',()=>{
  const lib=fs.readFileSync('lib/recruitment-presentation.ts','utf8')
  assert.match(lib,/const showDeadline = available \|\| expired/)
})
