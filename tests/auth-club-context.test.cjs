const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadComponent } = require('./helpers/component-module.cjs')
const ctx = loadComponent('lib/auth-club-context.ts')

test('return paths to a public club page name the club; anything else does not', () => {
  assert.deepEqual(ctx.returnClub('/club/b90c1444-45ea-45bc-9b05-1f5a73c63301?follow=b90c1444-45ea-45bc-9b05-1f5a73c63301'), { ref: 'b90c1444-45ea-45bc-9b05-1f5a73c63301', follow: true })
  assert.deepEqual(ctx.returnClub('/club/tamid-at-uva?ref=fair'), { ref: 'tamid-at-uva', follow: false })
  assert.deepEqual(ctx.returnClub('/club/tamid/'), { ref: 'tamid', follow: false })
  for (const next of ['/', '/explore', '/club/tamid/workspace', '/club/', '//evil.example/club/tamid', 'https://evil.example/club/tamid', '/club/%2e%2e', '/club/a%20b', '/clubs/tamid'])
    assert.equal(ctx.returnClub(next), null, next)
})

test('context lines read as one sentence for each case', () => {
  assert.equal(ctx.clubContextLine('TAMID', true, 'signup'), 'Create your profile to follow TAMID. You’ll go right back to it.')
  assert.equal(ctx.clubContextLine('TAMID', false, 'signup'), 'Create your profile to continue to TAMID. You’ll go right back to it.')
  assert.equal(ctx.clubContextLine('TAMID', true, 'login'), 'Sign in to follow TAMID.')
  assert.equal(ctx.clubContextLine('TAMID', false, 'login'), 'Sign in to continue to TAMID.')
})

test('sign-up and sign-in look the club up through the public SEO projection only', () => {
  for (const file of ['app/signup/page.tsx', 'app/login/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /returnClub\(/, file)
    assert.match(source, /getPublicClubSeo\(target\.ref\)/, file)
    assert.match(source, /club=\{club && target \? \{ name: club\.name, follow: target\.follow \} : undefined\}/, file)
  }
  assert.match(fs.readFileSync('components/auth/login-auth-panel.tsx', 'utf8'), /description \?\? "Sign in with your UVA account\."/)
})
