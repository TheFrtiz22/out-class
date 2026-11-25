// Interview room: after choosing a candidate, the "Interview complete" heading (focused by script for screen readers)
// showed the orange keyboard focus ring, as if it were a button.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("headings focused by script draw no focus ring; controls keep theirs", () => {
  const css = fs.readFileSync("app/globals.css", "utf8")
  assert.match(css, /:where\(a, button, input, textarea, select, \[tabindex\]\):focus-visible \{\n    outline: 2px solid var\(--ring\);/)
  assert.match(css, /:where\(h1, h2, h3, h4, h5, h6\)\[tabindex="-1"\]:focus-visible \{\n    outline: none;\n  \}/)
  // The interview room's closing heading is one of them.
  assert.match(fs.readFileSync("components/interview-kit-session.tsx", "utf8"), /<h2 ref=\{closingHeading\} tabIndex=\{-1\} data-candidate-focus>/)
})
