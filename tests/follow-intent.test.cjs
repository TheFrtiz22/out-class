const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {loadComponent}=require('./helpers/component-module.cjs')
const intent=loadComponent('lib/follow-intent.ts')
const auth=loadComponent('lib/auth.ts')

test('signed-out follow returns to the same page with the club to save', () => {
  assert.equal(intent.followReturnPath('/club/tamid','', 'tamid'),'/club/tamid?follow=tamid')
  assert.equal(intent.followReturnPath('/explore','?q=finance&follow=old','b90c1444-45ea-45bc-9b05-1f5a73c63301'),'/explore?q=finance&follow=b90c1444-45ea-45bc-9b05-1f5a73c63301')
  const signup=intent.authEntryWithReturn('/signup','/club/tamid?follow=tamid')
  assert.equal(signup,'/signup?next=%2Fclub%2Ftamid%3Ffollow%3Dtamid')
  // The return path survives the existing sign-up and sign-in guards untouched.
  const next=new URL(signup,'https://x.invalid').searchParams.get('next')
  assert.equal(auth.signupReturnPath(next),'/club/tamid?follow=tamid')
  assert.equal(auth.loginReturnPath(next),'/club/tamid?follow=tamid')
})

test('only a well-formed club id is read back, and it is removed once handled', () => {
  assert.equal(intent.readFollowIntent('?follow=tamid'),'tamid')
  assert.equal(intent.readFollowIntent('?follow=b90c1444-45ea-45bc-9b05-1f5a73c63301'),'b90c1444-45ea-45bc-9b05-1f5a73c63301')
  for (const bad of ['','?follow=','?follow=../x','?follow=a%20b','?follow=-x','?follow='+'a'.repeat(81)]) assert.equal(intent.readFollowIntent(bad),null,bad)
  assert.equal(intent.withoutFollowIntent('/club/tamid','?follow=tamid'),'/club/tamid')
  assert.equal(intent.withoutFollowIntent('/explore','?q=a&follow=tamid','#top'),'/explore?q=a#top')
})

test('signed-out Follow and Apply ask to create an account first, and the save finishes on return', () => {
  const button=fs.readFileSync('components/clubs/corkboard-button.tsx','utf8')
  assert.match(button,/authenticated \? void save\(\) : askToJoin\(\)/)
  assert.match(button,/readFollowIntent\(search\) !== club\.id/)
  assert.match(button,/history\.replaceState\([^)]*withoutFollowIntent/)
  assert.match(button,/if \(blocked\) return/)
  const dialog=fs.readFileSync('components/clubs/join-prompt-dialog.tsx','utf8')
  assert.ok(dialog.indexOf('authEntryWithReturn("/signup"')<dialog.indexOf('authEntryWithReturn("/login"'),'create account comes first')
  const profile=fs.readFileSync('components/views/club-profile-view.tsx','utf8')
  assert.match(profile,/real && !user\) \{[\s\S]{0,200}setJoinPrompt\(/)
  assert.doesNotMatch(profile,/Sign in to apply/)
})
