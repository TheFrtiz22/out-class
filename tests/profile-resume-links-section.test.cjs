const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const view = fs.readFileSync('components/views/unified-student-profile-view.tsx', 'utf8')

test('the profile page shows the saved résumé and LinkedIn, not only a checklist tick', () => {
  assert.match(view, /"Résumé and links",\s*"links"/)
  assert.match(view, /const resume = resolveResumeUrl\(profile\.resumeUrl\)/)
  assert.match(view, /const linkedin = safeProfileUrl\(profile\.linkedinUrl\)/)
  assert.match(view, /View résumé<span className="sr-only"> \(opens in a new tab\)<\/span>/)
  assert.match(view, /LinkedIn profile<span className="sr-only"> \(opens in a new tab\)<\/span>/)
  assert.match(view, /rel="noopener noreferrer"/)
})
