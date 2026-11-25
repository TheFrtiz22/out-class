const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/applicant-review/staged-decisions-panel.tsx"), "utf8")

test("Decisions to send only shows its send button when there is something to send", () => {
  assert.match(src, /\{rows\.length > 0 && <Button disabled=\{busy \|\| !chosen\.length\} onClick=\{\(\) => void send\(\)\}>/)
  assert.match(src, /`Send all \$\{rows\.length\}`/)
})
