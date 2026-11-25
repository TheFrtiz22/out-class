const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Admin › Event approvals: with a stale password/authenticator check, Reject showed "Review failed." because
// reviewCampusEvent used actionResult, which rethrows the AdminAccessError asking the admin to verify again.
// Every Server Action whose command can call requirePlatformAdmin must use adminActionResult instead.
function commandBody(source, name) {
  const start = source.search(new RegExp(`async function ${name}\\(`))
  if (start < 0) return ''
  const rest = source.slice(start + 1)
  const end = rest.search(/\n(export )?async function /)
  return end < 0 ? rest : rest.slice(0, end)
}

test('admin-reachable Server Actions return the verify-again refusal instead of throwing it', () => {
  const offenders = []
  for (const file of fs.readdirSync('actions').filter(name => name.endsWith('.ts'))) {
    const source = fs.readFileSync(path.join('actions', file), 'utf8')
    for (const match of source.matchAll(/return (\w*[aA]ctionResult)\(\(\) => (\w+)\(/g)) {
      const [, wrapper, command] = match
      if (wrapper === 'actionResult' && commandBody(source, command).includes('requirePlatformAdmin')) offenders.push(`${file}: ${command}`)
    }
  }
  assert.deepEqual(offenders, [])
})
