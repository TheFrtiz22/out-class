const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "components/qr/public-club-page.tsx"), "utf8")

test("a signed-in student's browser tab names the club they are looking at", () => {
  assert.match(source, /import \{ useShellBindings \} from "@\/components\/shell\/workspace-shell-context"/)
  assert.match(source, /useShellBindings\(\{ title: club\.name \}\)/)
})
