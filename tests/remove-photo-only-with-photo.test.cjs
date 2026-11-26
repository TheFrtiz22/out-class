const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// Edit profile showed "Remove photo" even with no photo to remove (it then did nothing). The app already shows it
// only when there is a photo; the web dialog now matches.
test("Edit profile shows Remove photo only when there is a photo", () => {
  const web = fs.readFileSync("components/edit-student-profile-dialog.tsx", "utf8")
  assert.match(web, /\{draft\.headshotUrl && <Button type="button" variant="ghost" onClick=\{\(\) => \{ setPhotoSource\(null\); setDraft\(\{ \.\.\.draft, headshotUrl: null \}\) \}\}>Remove photo<\/Button>\}/)
  const app = fs.readFileSync("mobile/src/components/profile/edit-sheet.tsx", "utf8")
  assert.match(app, /\{draft\.headshotUrl \? <Button[^>]*label="Remove photo"/)
})
