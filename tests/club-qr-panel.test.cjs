const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('leaders get their club QR code beside the public profile they edit', () => {
  const panel = fs.readFileSync('components/clubs/club-qr-panel.tsx', 'utf8')
  const settings = fs.readFileSync('components/club-profile-settings.tsx', 'utf8')
  // Only the approved QR stack, pointed at the public club page by id (the short link survives renames).
  assert.match(panel, /from "@\/components\/qr\/qr-code-card"/)
  assert.match(panel, /path=\{clubSharePath\(club\.id\)\}/)
  assert.doesNotMatch(panel, /from "(qrcode|react-qr-code|qrcode\.react)"|api\.qrserver|chart\.googleapis/)
  // Shown before the editor for real clubs, so it is never buried; the demo club has no public page to scan to.
  assert.match(settings, /\{!demo\.isDemoEnabled && <ClubQrPanel club=\{club\} \/>\}/)
  assert.ok(settings.indexOf('<ClubQrPanel') < settings.indexOf('<ClubProfileEditor'), 'the QR panel comes before the profile editor')
})

test('club QR panel filenames are safe slugs', () => {
  const panel = fs.readFileSync('lib/club-qr.ts', 'utf8')
  const start = panel.indexOf('export function clubQrFilename')
  const body = panel.slice(start, panel.indexOf('\n}\n', start) + 2).replace(/^export /, '').replace(/: string/g, '')
  const clubQrFilename = new Function(`${body}; return clubQrFilename`)()
  assert.equal(clubQrFilename('McIntire Investment Institute'), 'mcintire-investment-institute-qr-code')
  assert.equal(clubQrFilename('  ★★ '), 'club-qr-code')
  assert.ok(clubQrFilename('a b '.repeat(60)).length <= 68)
  assert.doesNotMatch(clubQrFilename('a b '.repeat(60)), /--/)
})

test('the club QR code is one click from Home and Recruiting on web, and one tap from My club and Leader tools in the app', () => {
  const button = fs.readFileSync('components/clubs/club-qr-button.tsx', 'utf8')
  // The approved presenter (full screen, PNG/SVG, copy link) on the club's public page; the short link is only asked for on click.
  assert.match(button, /from "@\/components\/qr\/qr-presenter-dialog"/)
  assert.match(button, /createShortLink\(\{ target: path \}\)/)
  assert.match(button, /const path = clubSharePath\(club\.id\)/)
  assert.match(button, /if \(demo\.isDemoEnabled\) return null/)
  assert.doesNotMatch(button, /useEffect/, 'opening Home must not create a short link')
  assert.match(fs.readFileSync('components/club-home/club-home-actions.tsx', 'utf8'), /<ClubQrButton club=\{\{ id: clubId, name: clubName \}\} \/>/)
  assert.match(fs.readFileSync('components/recruiting-overview.tsx', 'utf8'), /<ClubQrButton club=\{\{ id: clubId, name: clubName \}\}/)
  const sheet = fs.readFileSync('mobile/src/components/share-sheet.tsx', 'utf8')
  assert.match(sheet, /export function clubShareTarget/)
  for (const file of ['mobile/src/components/explore/club-page-view.tsx', 'mobile/src/app/my-club/[clubId].tsx', 'mobile/src/app/leader/[clubId]/index.tsx'])
    assert.match(fs.readFileSync(file, 'utf8'), /target=\{clubShareTarget\(/, file)
  assert.match(fs.readFileSync('mobile/src/app/leader/[clubId]/index.tsx', 'utf8'), /"Club QR code"/)
  assert.match(fs.readFileSync('mobile/src/app/my-club/[clubId].tsx', 'utf8'), /label="Club QR code"/)
})
