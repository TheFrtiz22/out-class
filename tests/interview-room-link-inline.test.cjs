// My interviews: "Open the interview room" sat inside a sentence as a 40px inline-flex box, so on phones the wrapped
// line jumped far below the first. It is now an inline link whose vertical padding keeps a large tap area without
// changing the line height.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/interviews/interview-rooms-list.tsx'), 'utf8')

test('the interview room link flows with its sentence', () => {
  const link = source.match(/<Link className="([^"]*)" href=\{clubInterviewHref\(clubId, "interviewTab=rooms"\)\}>Open the interview room<\/Link>/)
  assert.ok(link, 'link present')
  assert.doesNotMatch(link[1], /inline-flex|min-h-/)
  assert.match(link[1], /py-2\.5/)
})
