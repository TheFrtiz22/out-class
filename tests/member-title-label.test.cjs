'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent } = require('./helpers/component-module.cjs')

// A member's detail panel showed "GENERAL MEMBER · Groups: None" (the raw role code). It now reads "General member",
// and a custom title still wins.
test('member title label is words, not the role code', () => {
  const { memberTitleLabel } = loadComponent('lib/copy/terms.ts')
  assert.equal(memberTitleLabel({ role: 'GENERAL_MEMBER' }), 'General member')
  assert.equal(memberTitleLabel({ role: 'RECRUITMENT_LEAD', title: '' }), 'Recruitment lead')
  assert.equal(memberTitleLabel({ role: 'PRESIDENT', title: '  Treasurer ' }), 'Treasurer')
  assert.equal(memberTitleLabel({ role: 'NEW_ROLE' }), 'New role')
  const src = fs.readFileSync(path.join(__dirname, '..', 'components/organization-member-management.tsx'), 'utf8')
  assert.match(src, /\{memberTitleLabel\(active\)\} · Groups:/)
  assert.doesNotMatch(src, /active\.role\.replaceAll\("_", " "\)/)
})
