const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {loadComponent}=require('./helpers/component-module.cjs')
const share=loadComponent('lib/share-links.ts')
const payload={url:'https://www.out-class.net/club/abc',title:'TAMID at UVA',text:'Check out TAMID at UVA on OutClass'}

test('every channel gets the public link, encoded, and nothing else', () => {
  assert.deepEqual([...share.SHARE_CHANNELS],['messages','instagram','whatsapp','email','linkedin','x'])
  const enc=encodeURIComponent
  assert.equal(share.shareHref('messages',payload),`sms:?&body=${enc('Check out TAMID at UVA on OutClass https://www.out-class.net/club/abc')}`)
  assert.equal(share.shareHref('whatsapp',payload),`https://wa.me/?text=${enc('Check out TAMID at UVA on OutClass https://www.out-class.net/club/abc')}`)
  assert.equal(share.shareHref('email',payload),`mailto:?subject=${enc('TAMID at UVA')}&body=${enc('Check out TAMID at UVA on OutClass\n\nhttps://www.out-class.net/club/abc')}`)
  assert.equal(share.shareHref('linkedin',payload),`https://www.linkedin.com/sharing/share-offsite/?url=${enc(payload.url)}`)
  assert.equal(share.shareHref('x',payload),`https://x.com/intent/post?text=${enc(payload.text)}&url=${enc(payload.url)}`)
  assert.equal(share.shareHref('instagram',payload),share.INSTAGRAM_DIRECT_URL)
  for (const channel of share.SHARE_CHANNELS) assert.ok(share.SHARE_CHANNEL_LABELS[channel])
  assert.equal(share.opensWebsite('messages'),false); assert.equal(share.opensWebsite('email'),false); assert.equal(share.opensWebsite('x'),true)
})

test('share text is single-line and bounded; paths are public and encoded', () => {
  assert.equal(share.shareText('  Fall   kickoff\n night '),'Fall kickoff night')
  const long=share.shareText('x'.repeat(400)); assert.equal(long.length,180); assert.ok(long.endsWith('…'))
  assert.equal(share.clubSharePath('a b'),'/club/a%20b')
  assert.equal(share.eventSharePath('3f1c'),'/corkboard?event=3f1c')
  // A crafted title can't add extra query parameters to the link.
  assert.doesNotMatch(share.shareHref('x',{...payload,text:'a&url=https://evil.example'}),/&url=https:\/\/evil/)
})

test('clubs and published events use the one share sheet; demo and preview stay out', () => {
  const sheet=fs.readFileSync('components/share/share-sheet.tsx','utf8')
  assert.match(sheet,/navigator\.clipboard\.writeText/)
  assert.match(sheet,/typeof navigator\.share === "function"/)
  assert.match(sheet,/channel === "instagram"/)
  assert.match(sheet,/noopener noreferrer/)
  assert.match(fs.readFileSync('components/clubs/share-club-button.tsx','utf8'),/club\.source === "preview"\) return null[\s\S]*<ShareSheet/)
  assert.match(fs.readFileSync('components/share/event-share-button.tsx','utf8'),/isDemoEnabled\) return null/)
  assert.match(fs.readFileSync('components/events/public-event-board.tsx','utf8'),/<EventShareButton event=\{selected\}/)
  assert.match(fs.readFileSync('components/events/club-events.tsx','utf8'),/e\.status === "PUBLISHED"[^\n]*<EventShareButton/)
  const page=fs.readFileSync('app/(workspace)/corkboard/page.tsx','utf8')
  assert.match(page,/isUuid\(id\)/); assert.match(page,/getPublicCampusEvent\(id\)\.catch\(\(\) => null\)/)
})
