const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const workspace = fs.readFileSync('components/club-workspace.tsx', 'utf8')
const navigation = fs.readFileSync('lib/product-navigation.ts', 'utf8')

test('a mistyped or stale workspace link says the page does not exist, not that access is missing', () => {
  assert.match(navigation, /export const workspacePageIds = \{/)
  assert.match(workspace, /const unknownPage = !\(workspacePageIds\[mode === "recruiting" \? "recruiting" : "club"\] as readonly string\[\]\)\.includes\(active\)/)
  assert.match(workspace, /unknownPage \? <div role="alert"[^>]*><p>This page doesn’t exist\. The link may be out of date\.<\/p>/)
  assert.match(workspace, /"Go to Recruiting" : "Go to club home"/)
  // Missing permission keeps its own message.
  assert.match(workspace, /<p role="alert">This section isn’t available with your current access\.<\/p>\)/)
})

test('every page id the navigation can link to is a known workspace page', () => {
  const block = /workspacePageIds = \{([\s\S]*?)\} as const/.exec(navigation)[1]
  const known = new Set([...block.matchAll(/"([a-z-]+)"/g)].map(m => m[1]))
  for (const id of navigation.matchAll(/item\("([a-z-]+)"/g)) assert.ok(known.has(id[1]), `${id[1]} is linked from navigation`)
  for (const id of ['overview', 'calendar', 'tasks', 'alumni']) assert.ok(known.has(id))
})
