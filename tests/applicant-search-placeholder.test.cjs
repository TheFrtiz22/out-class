const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workspace = fs.readFileSync('components/views/leader-dashboard/live-leader-workspace.tsx', 'utf8')

test('the applicant search hint fits a phone-width search box', () => {
  const hint = /aria-label="Search applicants"\s*placeholder="([^"]+)"/.exec(workspace)?.[1]
  assert.equal(hint, 'Name, ID or major')
  assert.ok(hint.length <= 20, 'longer hints were cut off mid-word at 500px ("Name, anonymous ID, or maj")')
})
