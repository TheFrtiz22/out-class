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
  // Shown after the editor for real clubs; the demo club has no public page to scan to.
  assert.match(settings, /\{!demo\.isDemoEnabled && <ClubQrPanel club=\{club\} \/>\}/)
})

test('club QR panel filenames are safe slugs', () => {
  const panel = fs.readFileSync('components/clubs/club-qr-panel.tsx', 'utf8')
  const start = panel.indexOf('export function clubQrFilename')
  const body = panel.slice(start, panel.indexOf('\n}\n', start) + 2).replace(/^export /, '').replace(/: string/g, '')
  const clubQrFilename = new Function(`${body}; return clubQrFilename`)()
  assert.equal(clubQrFilename('McIntire Investment Institute'), 'mcintire-investment-institute-qr-code')
  assert.equal(clubQrFilename('  ★★ '), 'club-qr-code')
  assert.ok(clubQrFilename('a b '.repeat(60)).length <= 68)
  assert.doesNotMatch(clubQrFilename('a b '.repeat(60)), /--/)
})
