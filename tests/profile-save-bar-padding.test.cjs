const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// The profile editor's save bar is a card (Panel → oc-content-panel); the plain bar's `padding: 1rem 0`
// left "Published" and "Publish profile" touching the card's edges.
test("the profile editor's save bar keeps side padding inside its card", () => {
  const editor = fs.readFileSync("components/clubs/club-profile-editor.tsx", "utf8")
  assert.match(editor, /<Panel className="oc-settings-actions /)
  const css = fs.readFileSync("components/clubs/club-settings.css", "utf8")
  const rule = css.match(/\.oc-content-panel\.oc-settings-actions \{([^}]*)\}/)
  assert.ok(rule, "card save bar rule exists")
  assert.match(rule[1], /padding:\s*0\.75rem 1rem/)
  assert.ok(css.indexOf(".oc-content-panel.oc-settings-actions") > css.indexOf(".oc-settings-actions {"), "card rule follows the plain rule")
})
