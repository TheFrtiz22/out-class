// Club page: the website already has its globe icon in the header, so the About links must not repeat it as
// "Club website". It used to show both, pointing at the same page.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/clubs/marketing-profile.tsx'), 'utf8')

test('About links skip the link that is the club website', () => {
  assert.match(source, /m\.links\.filter\(l => l\.url && !samePage\(l\.url, m\.website\)\)/)
})

test('the same page matches across protocol, www, host case and trailing slash, not path case', () => {
  const body = source.match(/const samePage = \(a: string, b: string\) => \{\n([\s\S]*?)\n\}\n/)[1]
  const samePage = new Function('a', 'b', body.replace(/: string/g, ''))
  assert.equal(samePage('https://www.Club.org/', 'http://club.org'), true)
  assert.equal(samePage('https://club.org/join', 'https://club.org'), false)
  assert.equal(samePage('https://club.org', ''), false)
  assert.equal(samePage('https://club.org/Join', 'https://club.org/join'), false)
  assert.equal(samePage('https://CLUB.org/Join/', 'club.org/Join'), true)
})
