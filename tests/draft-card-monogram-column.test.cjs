'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

// On phones the Drafts card is a two-column grid: logo, then everything else. The rule put every child <div> in
// column 2, and a club without a logo image renders its monogram as a <div>, so the monogram sat on its own row
// above an indented title. The body is now targeted by class.
test('drafts card on phones places the body by class, not every div', () => {
  const css = read('components/applications/application-tracker.css')
  assert.doesNotMatch(css, /\.oc-application-management-row > div\b/)
  assert.match(css, /\.oc-application-management-row > \.oc-management-body, \.oc-application-management-row > \.oc-management-state, \.oc-application-management-row > button \{ grid-column: 2; \}/)
  assert.match(read('components/applications/application-management-card.tsx'), /<div className="oc-management-body min-w-0 flex-1"><h2>/)
})
