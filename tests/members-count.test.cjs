'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

// The Members page listed people with no count anywhere, so a leader had to count rows to know the club's size.
test('the members list shows how many members or invitations it holds', () => {
  const src = fs.readFileSync('components/organization-member-management.tsx', 'utf8')
  assert.match(src, /\{rows\.length > 0 && <p className="text-sm text-muted-foreground" aria-live="polite">\{pluralize\(rows\.length, invitesOpen \? "invitation" : "member"\)\}<\/p>\}/)
  // The count sits right above the table it counts.
  assert.ok(src.indexOf('pluralize(rows.length, invitesOpen') < src.indexOf('caption={invitesOpen ? "Club invitations" : "Club members"}'))
})
