'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Home's To-do already skips a draft for a club that stopped taking applications, but the Applications card still
// showed it as "Draft · 1 response saved" (or a past deadline), as if it could be finished. It now says the
// applications are closed.
test('home says a closed club draft is closed instead of inviting the student back', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components/views/student-dashboard-view.tsx'), 'utf8')
  const note = src.slice(src.indexOf('function applicationNote'), src.indexOf('/** My applications as stages'))
  assert.match(note, /return app\.draft\s*(\/\/[^\n]*\n\s*)?\? app\.intakeClosed\s*\? "Applications closed"\s*: app\.deadline/)
})
