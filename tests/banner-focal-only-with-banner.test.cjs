const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/clubs/club-profile-editor.tsx"), "utf8")

test("banner focal point fields only show once a cover banner is uploaded", () => {
  const i = src.indexOf("focal point (%)")
  assert.ok(i > 0, "focal point fields exist")
  const before = src.slice(Math.max(0, i - 400), i)
  assert.match(before, /\{draft\.bannerUrl && <div[^>]*data-banner-focal/, "focal point grid is gated on draft.bannerUrl")
})
